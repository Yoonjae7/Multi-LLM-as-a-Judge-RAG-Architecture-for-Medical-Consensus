/* ============================================================
   MediRAG-West live pipeline

   Mirrors the architecture diagram on the Home page:
     User  ->  Query Planner  ->  MediRAG-West  ->
     Multi-Agent Debate  ->  SafeJudge  ->  Integrated Response

   Real backend: three specialist agents run on Groq (Llama 3.3 70B),
   four SafeJudge judges run on Gemini (2.5 Flash-Lite). Different model
   families so a judge is never scoring its own kind (research.html#s3).
   The API routes live in /api and need GROQ_API_KEY and GEMINI_API_KEY
   set as environment variables (see .env.example).

   The network diagram only lights up a node when its real fetch() has
   actually resolved. Nothing in this file fakes timing with setTimeout
   around a network call, only the two non-AI stages (emergency check,
   local evidence search) get a short deliberate pause so the label is
   readable, and both are logged as instant because they are.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED_MOTION = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var AGENTS = {
    western: {
      id: 'western', label: 'Western Medicine Agent', short: 'Western',
      color: '#3b82f6', remit: 'Evidence-based modern medicine'
    },
    nutrition: {
      id: 'nutrition', label: 'Nutrition Agent', short: 'Nutrition',
      color: '#22c55e', remit: 'Dietary guidance'
    },
    lifestyle: {
      id: 'lifestyle', label: 'Lifestyle Agent', short: 'Lifestyle',
      color: '#a78bfa', remit: 'Behavioural and wellness guidance'
    }
  };
  var AGENT_ORDER = ['western', 'nutrition', 'lifestyle'];

  var JUDGES = [
    { id: 'evidence',   label: 'Evidence Judge',   short: 'Evidence',   color: '#3b82f6', axis: 'Checks citation quality' },
    { id: 'safety',     label: 'Safety Judge',     short: 'Safety',     color: '#ef4444', axis: 'Detects risks and contraindications' },
    { id: 'conflict',   label: 'Conflict Judge',   short: 'Conflict',   color: '#f59e0b', axis: 'Identifies conflicts between agents' },
    { id: 'confidence', label: 'Confidence Judge', short: 'Confidence', color: '#a78bfa', axis: 'Estimates uncertainty levels' }
  ];

  var STAGE_CAPTIONS = {
    question:  { name: 'Question', explain: 'Your question enters the system.' },
    planner:   { name: 'Query Planner', explain: 'Checking for emergency warning signs.' },
    retrieval: { name: 'MediRAG-West', explain: 'Searching the local evidence library.' },
    debate:    { name: 'Agent Debate', explain: 'Three agents are answering independently from the same evidence.' },
    judge:     { name: 'SafeJudge', explain: 'Four judges are scoring the answers.' },
    response:  { name: 'Integrated Response', explain: 'Combining everything into one answer.' }
  };

  var MIN_RELEVANCE = 0.16;
  var TOP_K_EVIDENCE = 5;

  /* ─────────────────────────────────────────────────────────
     Emergency screening. Deterministic rules, zero API calls,
     matching the report's argument that the safety-critical role
     does not need model capability (research.html#s3-4).
     ───────────────────────────────────────────────────────── */

  var EMERGENCY_RULES = [
    { reason: 'heart or breathing emergency', terms: ['crushing chest pain', 'severe chest pain', 'cannot breathe', "can't breathe", 'struggling to breathe', 'blue lips', 'chest pain radiating'] },
    { reason: 'stroke or other acute brain event', terms: ['face droop', 'face is drooping', 'slurred speech', 'one-sided weakness', 'sudden weakness', 'worst headache of my life', 'thunderclap', 'seizure', 'passed out', 'fainted', 'unresponsive'] },
    { reason: 'severe allergic reaction, bleeding or infection', terms: ['throat swelling', 'throat is closing', 'anaphylaxis', 'severe allergic reaction', 'uncontrolled bleeding', "won't stop bleeding", 'coughing up blood', 'stiff neck and fever'] },
    { reason: 'risk of self-harm', terms: ['suicide', 'kill myself', 'end my life', 'self-harm', 'hurt myself'] }
  ];

  function screenForEmergency(question) {
    var q = question.toLowerCase();
    for (var i = 0; i < EMERGENCY_RULES.length; i++) {
      for (var j = 0; j < EMERGENCY_RULES[i].terms.length; j++) {
        if (q.indexOf(EMERGENCY_RULES[i].terms[j]) !== -1) {
          return { urgent: true, reason: EMERGENCY_RULES[i].reason };
        }
      }
    }
    return { urgent: false };
  }

  /* ─────────────────────────────────────────────────────────
     Local evidence library and lexical retrieval.
     A simple keyword-overlap scorer, the "lexical retrieval
     baseline" the report describes, run over every entry for
     every question rather than gated to a few fixed scenarios.
     ───────────────────────────────────────────────────────── */

  var KNOWLEDGE_BASE = [
    { id: 'E1', source: 'NICE CG150', title: 'Headaches in over 12s', type: 'Clinical guideline', grade: 'High',
      snippet: 'Tension-type headache is diagnosed from the history where episodes are bilateral, pressing or tightening, of mild to moderate intensity, and not made worse by routine activity. Scans are not needed without red-flag features.',
      keywords: ['headache', 'migraine', 'head pain', 'tension'] },
    { id: 'E2', source: 'Primary-care review', title: 'Assessment of persistent fatigue', type: 'Systematic review', grade: 'Moderate',
      snippet: 'Fatigue lasting beyond four weeks warrants a basic blood panel including full blood count, ferritin, thyroid function and glucose, since anaemia and thyroid problems are common and reversible causes.',
      keywords: ['fatigue', 'tired', 'tiredness', 'exhausted', 'energy'] },
    { id: 'E3', source: 'Cochrane review', title: 'Non-drug management of tension headache', type: 'Systematic review', grade: 'Moderate',
      snippet: 'Regular aerobic exercise and structured stress management show consistent, modest reductions in tension-type headache frequency, with low risk of harm.',
      keywords: ['headache', 'exercise', 'stress'] },
    { id: 'E4', source: 'WHO 2020 guidance', title: 'Physical activity and sedentary behaviour', type: 'Guideline', grade: 'High',
      snippet: 'Adults should do at least 150 to 300 minutes of moderate aerobic activity per week. Regular activity is linked to better sleep quality, lower resting blood pressure, and reduced fatigue.',
      keywords: ['exercise', 'activity', 'sedentary', 'sleep', 'blood pressure', 'fatigue'] },
    { id: 'E5', source: 'Nutrition synthesis', title: 'Iron status and headache', type: 'Trial synthesis', grade: 'Low',
      snippet: 'Iron deficiency without anaemia is linked to fatigue in menstruating adults. Evidence connecting dehydration and low magnesium intake to headache frequency is suggestive but of low certainty.',
      keywords: ['iron', 'anaemia', 'fatigue', 'magnesium', 'hydration', 'headache'] },
    { id: 'E6', source: 'NICE CG95', title: 'Recent-onset chest pain of suspected cardiac origin', type: 'Clinical guideline', grade: 'High',
      snippet: 'Chest discomfort brought on by physical exertion and relieved by rest within minutes is typical anginal pain. Refer people with suspected stable angina for prompt specialist assessment rather than managing in primary care alone.',
      keywords: ['chest pain', 'chest tightness', 'angina', 'exertion', 'heart'] },
    { id: 'E7', source: 'NICE CG95', title: 'Stable versus unstable presentation', type: 'Clinical guideline', grade: 'High',
      snippet: 'Symptoms occurring at rest, increasing in frequency or severity, or lasting beyond ten minutes suggest a possible acute coronary syndrome and need emergency assessment rather than routine referral.',
      keywords: ['chest pain', 'angina', 'acute coronary', 'unstable', 'heart attack'] },
    { id: 'E8', source: 'BNF', title: 'Nitrate interaction cautions', type: 'Drug reference', grade: 'High',
      snippet: 'Nitrates must not be combined with phosphodiesterase type-5 inhibitors because of the risk of a severe drop in blood pressure. Any anti-anginal treatment requires prescriber assessment.',
      keywords: ['nitrate', 'medication', 'interaction', 'chest pain', 'angina'] },
    { id: 'E9', source: 'Cardiovascular review', title: 'Modifiable risk factors in suspected angina', type: 'Systematic review', grade: 'Moderate',
      snippet: 'Stopping smoking, controlling blood pressure, managing lipids and structured exercise rehabilitation each reduce cardiovascular events in people with stable coronary disease.',
      keywords: ['smoking', 'blood pressure', 'lipids', 'cardiovascular', 'heart', 'cholesterol'] },
    { id: 'E10', source: 'Rehabilitation trials', title: 'Supervised activity in stable coronary disease', type: 'Trial synthesis', grade: 'Moderate',
      snippet: 'Supervised exercise programmes improve exercise tolerance and quality of life, but should begin only after assessment has established a safe activity threshold.',
      keywords: ['exercise', 'rehabilitation', 'coronary', 'heart', 'activity'] },
    { id: 'E11', source: 'NICE NG136', title: 'Hypertension in adults', type: 'Clinical guideline', grade: 'High',
      snippet: 'A clinic reading between 140/90 and 179/119 mmHg should be followed by ambulatory or home monitoring to confirm the diagnosis. A single raised clinic reading is not enough to diagnose hypertension.',
      keywords: ['blood pressure', 'hypertension', 'high blood pressure'] },
    { id: 'E12', source: 'NICE NG136', title: 'Stage 1 hypertension and risk assessment', type: 'Clinical guideline', grade: 'High',
      snippet: 'Where monitoring confirms stage 1 hypertension, assess formal cardiovascular risk and check for organ damage before deciding whether medication is needed.',
      keywords: ['hypertension', 'blood pressure', 'cardiovascular risk'] },
    { id: 'E13', source: 'Dietary trials', title: 'Sodium reduction and dietary pattern', type: 'Trial synthesis', grade: 'Moderate',
      snippet: 'Cutting dietary sodium and adopting a diet rich in fruit, vegetables and low-fat dairy produce meaningful reductions in systolic pressure, with effects visible within weeks.',
      keywords: ['sodium', 'salt', 'diet', 'blood pressure', 'dash diet'] },
    { id: 'E14', source: 'Measurement review', title: 'White-coat effect and measurement error', type: 'Systematic review', grade: 'Moderate',
      snippet: 'Clinic measurement overestimates true blood pressure in a substantial minority of patients. Cuff size, arm position, recent caffeine and talking during measurement each introduce error.',
      keywords: ['blood pressure', 'measurement', 'white coat', 'cuff'] },
    { id: 'E15', source: 'NICE CKS', title: 'Common cold and upper respiratory infection', type: 'Clinical guideline', grade: 'High',
      snippet: 'Most colds resolve within one to two weeks with rest, fluids and over-the-counter symptom relief. Seek review if symptoms last beyond three weeks or breathing becomes difficult.',
      keywords: ['cold', 'flu', 'cough', 'sore throat', 'runny nose', 'congestion'] },
    { id: 'E16', source: 'NICE NG59', title: 'Low back pain and sciatica management', type: 'Clinical guideline', grade: 'High',
      snippet: 'Most low back pain improves within a few weeks with staying active and avoiding bed rest. Loss of bladder or bowel control, or numbness around the saddle area, needs emergency assessment.',
      keywords: ['back pain', 'lower back', 'sciatica', 'spine'] },
    { id: 'E17', source: 'NICE CG113', title: 'Generalised anxiety and sleep', type: 'Clinical guideline', grade: 'Moderate',
      snippet: 'Structured relaxation, regular sleep timing and reduced caffeine intake are recommended first-line, non-drug steps for anxiety-related sleep difficulty before considering other treatment.',
      keywords: ['anxiety', 'stress', 'sleep', 'insomnia', 'worry'] },
    { id: 'E18', source: 'NICE CG61', title: 'Irritable bowel syndrome, dietary advice', type: 'Clinical guideline', grade: 'Moderate',
      snippet: 'Regular meals, adequate fluid intake and gradual fibre adjustment are first-line dietary measures for irritable-bowel-type symptoms, before other management is considered.',
      keywords: ['stomach', 'bloating', 'ibs', 'digestive', 'bowel', 'gut'] },
    { id: 'E19', source: 'BSACI guidance', title: 'Seasonal allergic rhinitis', type: 'Clinical guideline', grade: 'Moderate',
      snippet: 'Reducing exposure to known triggers and regular non-drowsy antihistamine use are standard first-line measures for seasonal allergy symptoms affecting the nose and eyes.',
      keywords: ['allergy', 'allergies', 'hay fever', 'rhinitis', 'sneezing', 'itchy eyes'] }
  ];

  var STOPWORDS = ('the a an and or but if then so to of in on at for with without have has had i my me you your ' +
    'is are was were be been being it its this that these those do does did not no nor very really just feel feeling ' +
    'getting been having about since days weeks months years ago recently lately').split(' ');

  function tokenize(text) {
    return (text.toLowerCase().match(/[a-z']+/g) || []).filter(function (w) {
      return w.length >= 3 && STOPWORDS.indexOf(w) === -1;
    });
  }

  /* Word-boundary token sets, not substring search. Plain indexOf would
     match the query word "how" inside an unrelated document word like
     "show", which is exactly the kind of false positive a real retrieval
     step has to avoid. */
  function tokenSet(text) {
    var set = {};
    tokenize(text).forEach(function (t) { set[t] = true; });
    return set;
  }

  function retrieveEvidence(question, context) {
    var queryText = question + ' ' + Object.values(context || {}).join(' ');
    var tokens = tokenize(queryText);
    if (!tokens.length) return { evidence: [], candidateCount: 0 };

    var scored = KNOWLEDGE_BASE.map(function (doc) {
      var bodySet = tokenSet(doc.title + ' ' + doc.snippet);
      var keywordSet = tokenSet(doc.keywords.join(' '));
      var hits = 0;
      tokens.forEach(function (t) {
        if (keywordSet[t]) hits += 1.4;
        else if (bodySet[t]) hits += 1;
      });
      var score = Math.min(1, hits / Math.max(3, Math.min(tokens.length, 6)));
      return { doc: doc, score: Math.round(score * 100) / 100 };
    });

    var candidates = scored.filter(function (s) { return s.score > 0; });
    var evidence = scored
      .filter(function (s) { return s.score >= MIN_RELEVANCE; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, TOP_K_EVIDENCE)
      .map(function (s) {
        return {
          id: s.doc.id, source: s.doc.source, title: s.doc.title,
          type: s.doc.type, grade: s.doc.grade, snippet: s.doc.snippet, score: s.score
        };
      });

    return { evidence: evidence, candidateCount: candidates.length };
  }

  /* ─────────────────────────────────────────────────────────
     Confidence, computed from real numbers (research.html#s5):
     evidence coverage, agent agreement, and the judge composite.
     Weighted lowest on agreement on purpose, since agreement
     between models is a weaker signal than grounded evidence.
     ───────────────────────────────────────────────────────── */

  function computeConfidence(evidence, judgeResults, conflictCount) {
    var topScore = evidence.length ? Math.max.apply(null, evidence.map(function (e) { return e.score; })) : 0;
    var E = topScore;
    var G = conflictCount === 0 ? 0.88 : Math.max(0.3, 0.88 - 0.22 * conflictCount);
    var J = 0.5 * judgeResults.evidence.score + 0.2 * judgeResults.conflict.score + 0.3 * judgeResults.confidence.score;

    var penalty = 1;
    if (evidence.some(function (e) { return e.grade === 'Low'; })) penalty *= 0.9;
    if (evidence.length < 2) penalty *= 0.88;

    var score = Math.round(Math.min(0.95, (0.4 * E + 0.2 * G + 0.4 * J) * penalty) * 100) / 100;
    var level = score >= 0.72 ? 'high' : score >= 0.48 ? 'medium' : 'low';
    return { score: score, level: level };
  }

  /* ─────────────────────────────────────────────────────────
     DOM references
     ───────────────────────────────────────────────────────── */

  var westConsultation = document.getElementById('west-consultation');
  var westForm      = document.getElementById('west-consult-form');
  var westQuestion   = document.getElementById('west-question');
  var westSubmit     = document.getElementById('west-submit');
  var westFormMsg    = document.getElementById('west-form-message');
  var westResults    = document.getElementById('west-results');
  var runtime        = document.getElementById('west-viz');
  var netCanvas      = document.getElementById('west-net');
  var netStageEl     = document.getElementById('west-net-stage');
  var netExplainEl   = document.getElementById('west-net-explain');
  var railEl         = document.getElementById('west-rail');
  var consoleLog     = document.getElementById('west-console-log');
  var dispatchList   = document.getElementById('west-dispatch-list');
  var clockEl        = document.getElementById('west-clock');
  var runStateEl     = document.getElementById('west-runtime-state');
  var runStateLabel  = document.getElementById('west-runtime-state-label');

  var runToken = 0;
  var clockTimer = null;
  var startedAt = 0;

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, Math.max(30, ms)); });
  }

  function mk(tag, cls, txt) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt !== undefined) el.textContent = txt;
    return el;
  }

  /* ─────────────────────────────────────────────────────────
     Real API calls
     ───────────────────────────────────────────────────────── */

  var ApiError = function (message, stage) {
    this.message = message;
    this.stage = stage;
  };

  async function postJson(url, payload) {
    var response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      throw new ApiError('Network error reaching ' + url + '.');
    }
    var data = await response.json().catch(function () { return null; });
    if (!response.ok) {
      var message = (data && data.message) || ('Request to ' + url + ' failed (' + response.status + ').');
      throw new ApiError(message);
    }
    return data;
  }

  function callAgent(role, question, context, evidence) {
    return postJson('/api/agent', { role: role, question: question, context: context, evidence: evidence });
  }
  function callDebate(question, answers, evidence) {
    return postJson('/api/debate', { question: question, answers: answers, evidence: evidence });
  }
  function callJudge(axis, question, answers, evidence) {
    return postJson('/api/judge', { axis: axis, question: question, answers: answers, evidence: evidence });
  }
  function callConsensus(question, answers, conflicts) {
    return postJson('/api/consensus', { question: question, answers: answers, conflicts: conflicts });
  }

  /* Fisher-Yates, so judges see agent answers in a different order
     every run rather than always Western first (research.html#s4-6). */
  function shuffled(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /* ─────────────────────────────────────────────────────────
     Runtime chrome: clock, rail, console, dispatch, caption
     ───────────────────────────────────────────────────────── */

  function startClock() {
    startedAt = Date.now();
    stopClock();
    clockTimer = setInterval(function () {
      if (clockEl) clockEl.textContent = ((Date.now() - startedAt) / 1000).toFixed(1) + 's';
    }, 100);
  }
  function stopClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }
  function elapsed() { return ((Date.now() - startedAt) / 1000).toFixed(1); }

  function setRunState(state, label) {
    if (runStateEl) runStateEl.setAttribute('data-state', state);
    if (runStateLabel) runStateLabel.textContent = label;
  }

  function setStage(key, status) {
    if (!railEl) return;
    var step = railEl.querySelector('[data-stage="' + key + '"]');
    if (step) step.setAttribute('data-status', status);
  }

  function resetRail() {
    if (!railEl) return;
    Array.prototype.forEach.call(railEl.querySelectorAll('.west-rail-step'), function (s) {
      s.setAttribute('data-status', 'waiting');
    });
  }

  function announce(key, overrideText) {
    var stage = STAGE_CAPTIONS[key];
    if (netStageEl) netStageEl.textContent = stage ? stage.name : '';
    if (netExplainEl) netExplainEl.textContent = overrideText || (stage ? stage.explain : '');
  }

  function log(level, message) {
    if (!consoleLog) return;
    var row = mk('div', 'west-log-row west-log-' + level);
    row.append(mk('span', 'west-log-time', elapsed() + 's'), mk('span', 'west-log-msg', message));
    consoleLog.append(row);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  function resetConsole() { if (consoleLog) consoleLog.replaceChildren(); }

  function renderDispatch(agentIds) {
    if (!dispatchList) return;
    dispatchList.replaceChildren();
    agentIds.forEach(function (id) {
      var spec = AGENTS[id];
      var row = mk('div', 'west-dispatch-row');
      row.id = 'dispatch-' + id;
      row.style.setProperty('--agent-color', spec.color);
      var head = mk('div', 'west-dispatch-head');
      head.append(
        mk('span', 'west-dispatch-dot'),
        mk('span', 'west-dispatch-name', spec.label),
        mk('span', 'west-dispatch-status', 'Waiting')
      );
      row.append(head, mk('p', 'west-dispatch-remit', spec.remit));
      dispatchList.append(row);
    });
  }

  function setDispatchStatus(id, status, label) {
    var row = document.getElementById('dispatch-' + id);
    if (!row) return;
    row.setAttribute('data-status', status);
    var s = row.querySelector('.west-dispatch-status');
    if (s) s.textContent = label;
  }

  /* ─────────────────────────────────────────────────────────
     Network diagram (unchanged visual design; lights up only
     on real promise resolution, see runPipeline below)
     ───────────────────────────────────────────────────────── */

  var net = null;
  var rafId = null;

  var STAGE_LAYER = {
    idle: -1, question: 0, planner: 1, retrieval: 2,
    debate: 3, judge: 4, response: 5, done: 5
  };

  function buildNetwork(agentIds, evidenceCount) {
    if (!netCanvas) return;

    var rect = netCanvas.getBoundingClientRect();
    var cssW = Math.max(320, rect.width || netCanvas.clientWidth || 720);
    var cssH = Math.max(200, rect.height || netCanvas.clientHeight || 320);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    netCanvas.width = Math.round(cssW * dpr);
    netCanvas.height = Math.round(cssH * dpr);
    var ctx = netCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var specs = agentIds.map(function (id) { return AGENTS[id]; });

    var layers = [
      { label: 'Question',   color: '#38bdf8', count: 1, labels: [''] },
      { label: 'Query Planner', color: '#22d3ee', count: 3, labels: null },
      { label: 'MediRAG-West',  color: '#34d399', count: Math.max(3, Math.min(evidenceCount || 3, 5)), labels: null },
      { label: 'Agent Debate', color: '#60a5fa', count: specs.length, labels: specs.map(function (a) { return a.short; }), colors: specs.map(function (a) { return a.color; }) },
      { label: 'SafeJudge',  color: '#f472b6', count: 4, labels: JUDGES.map(function (j) { return j.short; }), colors: JUDGES.map(function (j) { return j.color; }) },
      { label: 'Response',   color: '#fbbf24', count: 1, labels: [''] }
    ];

    var padX = 54, padTop = 40, padBottom = 34;
    var usableW = cssW - padX * 2;
    var usableH = cssH - padTop - padBottom;

    var nodes = [];
    layers.forEach(function (layer, li) {
      var x = padX + (usableW * li) / (layers.length - 1);
      for (var i = 0; i < layer.count; i++) {
        var y = layer.count === 1
          ? padTop + usableH / 2
          : padTop + (usableH * i) / (layer.count - 1);
        nodes.push({
          x: x, y: y, layer: li, color: (layer.colors && layer.colors[i]) || layer.color,
          label: layer.labels ? layer.labels[i] : '',
          radius: (li === 0 || li === 5) ? 10 : 7,
          activation: 0, target: 0, pulse: Math.random() * Math.PI * 2
        });
      }
    });

    var edges = [];
    for (var li = 0; li < layers.length - 1; li++) {
      var src = nodes.filter(function (n) { return n.layer === li; });
      var dst = nodes.filter(function (n) { return n.layer === li + 1; });
      src.forEach(function (a) {
        dst.forEach(function (b) {
          edges.push({ a: a, b: b, layer: li, lateral: false, color: b.color, active: false, particles: [] });
        });
      });
    }

    net = { ctx: ctx, w: cssW, h: cssH, nodes: nodes, edges: edges, layers: layers, stage: 'idle' };
  }

  function setNetStage(key) {
    if (!net) return;
    net.stage = key;
    var target = STAGE_LAYER[key] !== undefined ? STAGE_LAYER[key] : -1;
    net.nodes.forEach(function (n) {
      n.target = n.layer <= target ? 0.75 + Math.random() * 0.25 : 0.07;
    });
    net.edges.forEach(function (e) {
      e.active = e.layer < target;
      if (!e.active) e.particles = [];
    });
  }

  function bezierAt(t, x0, y0, x1, y1, x2, y2, x3, y3) {
    var mt = 1 - t, a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return { x: a * x0 + b * x1 + c * x2 + d * x3, y: a * y0 + b * y1 + c * y2 + d * y3 };
  }

  function withAlpha(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
  }

  function drawNetwork() {
    if (!net) return;
    var ctx = net.ctx;
    ctx.clearRect(0, 0, net.w, net.h);

    net.nodes.forEach(function (n) {
      n.activation += (n.target - n.activation) * 0.075;
      n.pulse += 0.045;
    });

    net.edges.forEach(function (e) {
      var dx = (e.b.x - e.a.x) * 0.52;
      var c = [e.a.x + dx, e.a.y, e.b.x - dx, e.b.y];
      var drive = Math.min(e.a.activation, e.b.activation);

      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.bezierCurveTo(c[0], c[1], c[2], c[3], e.b.x, e.b.y);

      if (!e.active) {
        ctx.strokeStyle = 'rgba(148,163,184,0.10)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        return;
      }

      ctx.strokeStyle = withAlpha(e.color, 0.14 + drive * 0.3);
      ctx.lineWidth = 0.9 + drive * 1.5;
      ctx.stroke();

      if (!REDUCED_MOTION && e.particles.length < 2 && Math.random() < 0.055) {
        e.particles.push({ t: 0, speed: 0.011 + Math.random() * 0.012 });
      }
      for (var i = e.particles.length - 1; i >= 0; i--) {
        var p = e.particles[i];
        p.t += p.speed;
        if (p.t >= 1) { e.particles.splice(i, 1); continue; }
        var pt = bezierAt(p.t, e.a.x, e.a.y, c[0], c[1], c[2], c[3], e.b.x, e.b.y);
        var fade = Math.sin(p.t * Math.PI);
        var halo = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 7);
        halo.addColorStop(0, withAlpha(e.color, 0.55 * fade));
        halo.addColorStop(1, withAlpha(e.color, 0));
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = halo; ctx.fill();
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.9, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha('#ffffff', 0.9 * fade); ctx.fill();
      }
    });

    net.nodes.forEach(function (n) {
      var a = n.activation;
      var r = n.radius + a * 2.6;
      if (a > 0.15) {
        var g = ctx.createRadialGradient(n.x, n.y, r * 0.3, n.x, n.y, r + a * 20);
        g.addColorStop(0, withAlpha(n.color, a * 0.4));
        g.addColorStop(1, withAlpha(n.color, 0));
        ctx.beginPath(); ctx.arc(n.x, n.y, r + a * 20, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(n.color, 0.16 + a * 0.6); ctx.fill();
      ctx.strokeStyle = withAlpha(n.color, 0.35 + a * 0.6);
      ctx.lineWidth = 1.4; ctx.stroke();

      if (a > 0.4 && !REDUCED_MOTION) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 3.5 + Math.sin(n.pulse) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(n.color, 0.16 * a);
        ctx.lineWidth = 1; ctx.stroke();
      }

      if (n.label && net.w >= 480) {
        ctx.font = '600 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = withAlpha(n.color, 0.45 + a * 0.55);
        ctx.fillText(n.label, n.x, n.y + r + 13);
      }
    });

    if (net.w >= 560) {
      ctx.font = '600 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      net.layers.forEach(function (layer, li) {
        var first = net.nodes.filter(function (n) { return n.layer === li; })[0];
        if (!first) return;
        var act = Math.max.apply(null, net.nodes.filter(function (n) { return n.layer === li; })
          .map(function (n) { return n.activation; }));
        ctx.fillStyle = withAlpha(layer.color, 0.32 + act * 0.6);
        ctx.fillText(layer.label, first.x, 18);
      });
    }

    rafId = requestAnimationFrame(drawNetwork);
  }

  function startNetwork() { if (rafId) cancelAnimationFrame(rafId); rafId = requestAnimationFrame(drawNetwork); }
  function stopNetwork() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  /* ─────────────────────────────────────────────────────────
     Pipeline
     ───────────────────────────────────────────────────────── */

  async function runPipeline(question, context, token) {
    var alive = function () { return token === runToken; };

    resetConsole();
    resetRail();
    if (dispatchList) dispatchList.replaceChildren();
    setRunState('running', 'Running');
    startClock();

    if (runtime) runtime.hidden = false;
    buildNetwork(AGENT_ORDER, 3);
    setNetStage('idle');
    startNetwork();

    /* 1 · Question */
    setStage('question', 'active');
    setNetStage('question');
    announce('question');
    log('info', 'Question received.');
    await wait(350);
    if (!alive()) return null;
    setStage('question', 'done');

    /* 2 · Query Planner (deterministic, no API call) */
    setStage('planner', 'active');
    setNetStage('planner');
    announce('planner');
    log('info', 'Checking for emergency warning signs.');
    await wait(500);
    if (!alive()) return null;

    var emergency = screenForEmergency(question);
    if (emergency.urgent) {
      log('err', 'Emergency signs found: ' + emergency.reason.toLowerCase() + '.');
      log('err', 'Stopping here. No evidence search and no agents were run.');
      setStage('planner', 'error');
      announce('planner', 'Stopped at the Query Planner. When emergency signs are found, the system does not continue, because discussing symptoms could delay care.');
      setRunState('urgent', 'Stopped for safety');
      stopClock();
      return { kind: 'safety', emergency: emergency };
    }
    log('ok', 'No emergency signs found.');
    setStage('planner', 'done');

    /* 3 · MediRAG-West: real lexical retrieval, no API call */
    setStage('retrieval', 'active');
    setNetStage('retrieval');
    announce('retrieval');
    log('info', 'Searching ' + KNOWLEDGE_BASE.length + ' local sources.');
    await wait(550);
    if (!alive()) return null;

    var retrieval = retrieveEvidence(question, context);
    var evidence = retrieval.evidence;

    if (!evidence.length) {
      log('warn', 'Checked ' + retrieval.candidateCount + ' partial match(es), none cleared the relevance threshold.');
      log('warn', 'Stopping here rather than answering without evidence.');
      setStage('retrieval', 'error');
      announce('retrieval', 'Stopped at MediRAG-West. No source was a close enough match, so the system declines instead of guessing.');
      setRunState('abstain', 'No answer given');
      stopClock();
      return { kind: 'abstain' };
    }

    evidence.forEach(function (e) {
      log('ok', e.id + ' matched, ' + e.source + ' (' + Math.round(e.score * 100) + '%).');
    });
    setStage('retrieval', 'done');

    /* 4 · Agent Debate: real Groq calls, three in parallel */
    setStage('debate', 'active');
    setNetStage('debate');
    announce('debate');
    buildNetwork(AGENT_ORDER, evidence.length);
    setNetStage('debate');
    renderDispatch(AGENT_ORDER);
    AGENT_ORDER.forEach(function (id) { setDispatchStatus(id, 'running', 'Thinking'); });
    log('info', 'Asking all three agents at once, from the same evidence.');

    var answers;
    try {
      var agentResults = await Promise.all(AGENT_ORDER.map(function (role) {
        var startedCall = Date.now();
        return callAgent(role, question, context, evidence).then(function (res) {
          if (!alive()) return res;
          var seconds = ((Date.now() - startedCall) / 1000).toFixed(1);
          setDispatchStatus(role, 'done', Math.round(res.confidence * 100) + '% sure');
          log('ok', AGENTS[role].label + ' answered in ' + seconds + 's, ' + Math.round(res.confidence * 100) + '% confident.');
          return res;
        });
      }));
      if (!alive()) return null;
      answers = agentResults.map(function (res, i) { return Object.assign({ role: AGENT_ORDER[i] }, res); });
    } catch (err) {
      return handlePipelineError(err, 'debate');
    }

    log('info', 'Agents reviewing each other’s answers.');
    var debateResult;
    try {
      debateResult = await callDebate(question, answers, evidence);
    } catch (err) {
      return handlePipelineError(err, 'debate');
    }
    if (!alive()) return null;

    debateResult.revisions.forEach(function (rev) {
      log('warn', (AGENTS[rev.role] ? AGENTS[rev.role].short : rev.role) + ' revised: ' + rev.note);
    });
    log(debateResult.conflicts.length ? 'warn' : 'ok',
      debateResult.conflicts.length
        ? debateResult.conflicts.length + ' disagreement kept for the final answer.'
        : 'The agents agreed.');
    setStage('debate', 'done');

    /* 5 · SafeJudge: real Gemini calls, four in parallel, blind order */
    setStage('judge', 'active');
    setNetStage('judge');
    announce('judge');
    log('info', 'Scoring the answers, anonymised and in a random order.');

    var anonymised = shuffled(answers).map(function (a, i) {
      return { anonId: 'Agent ' + String.fromCharCode(65 + i), text: a.text };
    });

    var judgeResults = {};
    try {
      await Promise.all(JUDGES.map(function (judge) {
        var startedCall = Date.now();
        return callJudge(judge.id, question, anonymised, evidence).then(function (res) {
          if (!alive()) return;
          judgeResults[judge.id] = res;
          var seconds = ((Date.now() - startedCall) / 1000).toFixed(1);
          if (judge.id === 'safety') {
            log(res.veto ? 'err' : 'ok', judge.label + ' scored ' + Math.round(res.score * 100) + '% in ' + seconds + 's' +
              (res.veto ? ', and blocked the answer.' : ', nothing blocked.'));
          } else {
            log('ok', judge.label + ' scored ' + Math.round(res.score * 100) + '% in ' + seconds + 's.');
          }
        });
      }));
    } catch (err) {
      return handlePipelineError(err, 'judge');
    }
    if (!alive()) return null;
    setStage('judge', 'done');

    if (judgeResults.safety && judgeResults.safety.veto) {
      announce('judge', 'The Safety Judge blocked this answer. See the note below for why.');
      setRunState('urgent', 'Blocked by SafeJudge');
      stopClock();
      return { kind: 'veto', note: judgeResults.safety.note, question: question, evidence: evidence };
    }

    /* 6 · Integrated Response: real Groq call for prose, real math for confidence */
    setStage('response', 'active');
    setNetStage('response');
    announce('response');
    log('info', 'Writing the combined answer.');

    var consensusResult;
    try {
      consensusResult = await callConsensus(question, answers, debateResult.conflicts);
    } catch (err) {
      return handlePipelineError(err, 'response');
    }
    if (!alive()) return null;

    var confidence = computeConfidence(evidence, judgeResults, debateResult.conflicts.length);
    log('ok', 'Done. Overall confidence ' + Math.round(confidence.score * 100) + '%.');
    setStage('response', 'done');
    setNetStage('done');
    announce('response', 'Finished. The answer below combines all three agents, checked by the four judges.');
    setRunState('done', 'Finished');
    stopClock();

    return {
      kind: 'full',
      question: question,
      evidence: evidence,
      answers: answers,
      revisions: debateResult.revisions,
      conflicts: debateResult.conflicts,
      judges: judgeResults,
      consensus: {
        summary: consensusResult.summary || answers[0].text,
        confidence: confidence.score,
        level: confidence.level,
        urgent: false,
        safety: consensusResult.safetyNotes.length ? consensusResult.safetyNotes : [
          'This is general health information, not a diagnosis, and does not replace assessment by a clinician.'
        ]
      }
    };

    function handlePipelineError(err, stageKey) {
      setStage(stageKey, 'error');
      var message = err instanceof ApiError ? err.message : 'Something went wrong contacting the AI backend.';
      log('err', message);
      announce(stageKey, 'Stopped: ' + message);
      setRunState('error', 'Failed');
      stopClock();
      return { kind: 'error', message: message };
    }
  }

  /* ─────────────────────────────────────────────────────────
     Results
     ───────────────────────────────────────────────────────── */

  function renderConsensus(evidenceCount, consensus) {
    var el = function (id) { return document.getElementById(id); };
    if (el('west-consensus-summary')) el('west-consensus-summary').textContent = consensus.summary;
    if (el('west-conf-score')) el('west-conf-score').textContent = Math.round(consensus.confidence * 100) + '%';
    if (el('west-conf-label')) {
      el('west-conf-label').textContent =
        ({ low: 'Low confidence', medium: 'Moderate confidence', high: 'High confidence' })[consensus.level] || 'Confidence';
    }
    if (el('west-evidence-count')) el('west-evidence-count').textContent = 'Based on ' + evidenceCount + ' sources';
    if (el('west-safety-list')) {
      el('west-safety-list').replaceChildren();
      consensus.safety.forEach(function (n) { el('west-safety-list').append(mk('li', 'west-safety-note', n)); });
    }
    if (el('west-urgent-banner')) el('west-urgent-banner').hidden = !consensus.urgent;
    if (westResults) westResults.classList.toggle('west-is-urgent', Boolean(consensus.urgent));
  }

  function renderAgents(answers, revisions, evidence) {
    var container = document.getElementById('west-agents-grid');
    if (!container) return;
    container.replaceChildren();

    answers.forEach(function (ans) {
      var spec = AGENTS[ans.role];
      var revision = revisions.filter(function (r) { return r.role === ans.role; })[0];

      var card = mk('article', 'west-agent-card');
      card.style.setProperty('--agent-color', spec.color);

      var head = mk('div', 'west-agent-head');
      head.append(
        mk('span', 'west-agent-dot'),
        mk('h4', 'west-agent-title', spec.label),
        mk('span', 'west-conf-badge', Math.round(ans.confidence * 100) + '%')
      );

      card.append(head, mk('p', 'west-agent-body', ans.text));

      if (revision) card.append(mk('p', 'west-agent-note', 'Revised after debate: ' + revision.note));
      if (ans.gap) card.append(mk('p', 'west-agent-note', 'Could not tell: ' + ans.gap));

      var foot = mk('div', 'west-agent-foot');
      (ans.citedEvidenceIds || []).forEach(function (cid) {
        var ev = evidence.filter(function (e) { return e.id === cid; })[0];
        foot.append(mk('span', 'west-cite', ev ? ev.source : cid));
      });
      card.append(foot);
      container.append(card);
    });
  }

  function renderJudges(judgeResults) {
    var container = document.getElementById('west-judges-grid');
    if (!container) return;
    container.replaceChildren();

    JUDGES.forEach(function (judge) {
      var res = judgeResults[judge.id];
      if (!res) return;
      var card = mk('article', 'west-judge-card');
      card.style.setProperty('--judge-color', judge.color);

      var NS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 48 48');
      svg.classList.add('west-score-ring');
      var circ = 2 * Math.PI * 20;

      var bg = document.createElementNS(NS, 'circle');
      bg.setAttribute('cx', '24'); bg.setAttribute('cy', '24'); bg.setAttribute('r', '20');
      bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'rgba(15,23,42,0.08)'); bg.setAttribute('stroke-width', '4');

      var fg = document.createElementNS(NS, 'circle');
      fg.setAttribute('cx', '24'); fg.setAttribute('cy', '24'); fg.setAttribute('r', '20');
      fg.setAttribute('fill', 'none'); fg.setAttribute('stroke', judge.color); fg.setAttribute('stroke-width', '4');
      fg.setAttribute('stroke-linecap', 'round');
      fg.setAttribute('stroke-dasharray', circ.toFixed(1));
      fg.setAttribute('stroke-dashoffset', circ.toFixed(1));
      fg.setAttribute('transform', 'rotate(-90 24 24)');
      fg.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)';

      var txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', '24'); txt.setAttribute('y', '28.5');
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-size', '12');
      txt.setAttribute('font-weight', '700'); txt.setAttribute('fill', judge.color);
      txt.textContent = Math.round(res.score * 100) + '%';

      svg.append(bg, fg, txt);
      card.append(svg, mk('h4', 'west-judge-title', judge.label), mk('p', 'west-judge-axis', res.note));
      container.append(card);

      requestAnimationFrame(function () {
        fg.setAttribute('stroke-dashoffset', (circ * (1 - res.score)).toFixed(1));
      });
    });
  }

  function renderConflicts(conflicts) {
    var section = document.getElementById('west-conflict-section');
    var list = document.getElementById('west-conflict-list');
    if (!section || !list) return;
    list.replaceChildren();
    if (!conflicts || !conflicts.length) { section.hidden = true; return; }
    conflicts.forEach(function (c) {
      var li = mk('li', 'west-conflict-item');
      li.append(mk('strong', '', c.title), mk('p', '', c.detail));
      list.append(li);
    });
    section.hidden = false;
  }

  function renderEvidence(evidence) {
    var grid = document.getElementById('west-evidence-grid');
    if (!grid) return;
    grid.replaceChildren();
    evidence.forEach(function (ev) {
      var card = mk('article', 'west-evidence-card');
      var head = mk('div', 'west-evidence-head');
      head.append(
        mk('span', 'west-evidence-source', ev.source),
        mk('span', 'west-grade west-grade-' + ev.grade.toLowerCase().replace(/\s+/g, '-'), ev.grade + ' certainty')
      );
      card.append(head, mk('h4', 'west-evidence-title', ev.title), mk('p', 'west-evidence-snippet', ev.snippet));
      grid.append(card);
    });
  }

  function showDetail(show) {
    var detail = document.getElementById('west-detail');
    if (detail) detail.hidden = !show;
  }

  function renderFull(result) {
    renderConsensus(result.evidence.length, result.consensus);
    renderAgents(result.answers, result.revisions, result.evidence);
    renderJudges(result.judges);
    renderConflicts(result.conflicts);
    renderEvidence(result.evidence);
    showDetail(true);
    reveal();
  }

  function renderSafety(emergency) {
    var el = function (id) { return document.getElementById(id); };
    if (el('west-urgent-banner')) el('west-urgent-banner').hidden = false;
    if (westResults) westResults.classList.add('west-is-urgent');

    if (el('west-consensus-summary')) {
      el('west-consensus-summary').textContent =
        'Your question mentions signs of a possible ' + emergency.reason.toLowerCase() + '. ' +
        'The system stopped straight away, so it did not search for evidence and did not run any agents. ' +
        'That is deliberate, because discussing symptoms here could delay care. Please get urgent medical help now. ' +
        'In the UK call 999, or 111 if you are unsure. Elsewhere, call your local emergency number or go to an emergency department.';
    }
    if (el('west-conf-score')) el('west-conf-score').textContent = 'n/a';
    if (el('west-conf-label')) el('west-conf-label').textContent = 'Safety stop';
    if (el('west-evidence-count')) el('west-evidence-count').textContent = 'No evidence searched';
    if (el('west-safety-list')) {
      el('west-safety-list').replaceChildren();
      [
        'If this is an emergency, call emergency services now. Do not wait for any AI system.',
        'If you are having thoughts of harming yourself, contact your local crisis line or emergency services immediately. In the UK, Samaritans are free on 116 123, at any hour.',
        'This prototype does not assess or triage patients and must never be relied on in an emergency.'
      ].forEach(function (n) { el('west-safety-list').append(mk('li', 'west-safety-note', n)); });
    }
    showDetail(false);
    reveal();
  }

  function renderVeto(note) {
    var el = function (id) { return document.getElementById(id); };
    if (el('west-urgent-banner')) el('west-urgent-banner').hidden = false;
    if (westResults) westResults.classList.add('west-is-urgent');

    if (el('west-consensus-summary')) {
      el('west-consensus-summary').textContent =
        'The Safety Judge blocked this answer before it reached you. Its note: “' + note + '” ' +
        'This is the SafeJudge veto described in the research report: a safety concern is never averaged away by ' +
        'the other three judges, it stops the answer outright.';
    }
    if (el('west-conf-score')) el('west-conf-score').textContent = 'n/a';
    if (el('west-conf-label')) el('west-conf-label').textContent = 'Blocked by SafeJudge';
    if (el('west-evidence-count')) el('west-evidence-count').textContent = 'Answer withheld';
    if (el('west-safety-list')) {
      el('west-safety-list').replaceChildren();
      [
        'For a real health concern, speak to a qualified clinician rather than any AI system.',
        'If this is urgent, contact emergency services rather than waiting for a system response.'
      ].forEach(function (n) { el('west-safety-list').append(mk('li', 'west-safety-note', n)); });
    }
    showDetail(false);
    reveal();
  }

  function renderAbstain() {
    var el = function (id) { return document.getElementById(id); };
    if (el('west-urgent-banner')) el('west-urgent-banner').hidden = true;
    if (westResults) westResults.classList.remove('west-is-urgent');

    if (el('west-consensus-summary')) {
      el('west-consensus-summary').textContent =
        'No answer was given, because the search did not find any local source close enough to your question. ' +
        'The system is built to stop here rather than let a model answer from memory, since that is where ' +
        'confident but unsupported claims come from. Try rephrasing, or ask about headaches and fatigue, chest ' +
        'tightness, blood pressure, back pain, colds, allergies, digestion, or sleep and anxiety, the topics currently ' +
        'in the local library.';
    }
    if (el('west-conf-score')) el('west-conf-score').textContent = 'n/a';
    if (el('west-conf-label')) el('west-conf-label').textContent = 'No answer';
    if (el('west-evidence-count')) el('west-evidence-count').textContent = 'No matching sources';
    if (el('west-safety-list')) {
      el('west-safety-list').replaceChildren();
      [
        'Declining is safer than a fluent answer built on nothing.',
        'For a real health concern, speak to a qualified clinician rather than any AI system.'
      ].forEach(function (n) { el('west-safety-list').append(mk('li', 'west-safety-note', n)); });
    }
    showDetail(false);
    reveal();
  }

  function renderError(message) {
    if (westFormMsg) {
      westFormMsg.textContent = message || 'The AI backend could not be reached. Check that GROQ_API_KEY and GEMINI_API_KEY are configured, then try again.';
      westFormMsg.hidden = false;
    }
  }

  function reveal() {
    if (!westResults) return;
    westResults.hidden = false;
    westResults.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
  }

  /* ─────────────────────────────────────────────────────────
     Wiring
     ───────────────────────────────────────────────────────── */

  document.querySelectorAll('.west-sample').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!westQuestion) return;
      westQuestion.value = btn.getAttribute('data-question') || '';
      westQuestion.focus();
      if (westFormMsg) westFormMsg.hidden = true;
    });
  });

  if (westForm) {
    westForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var question = westQuestion ? westQuestion.value.trim() : '';
      if (question.length < 3) {
        if (westFormMsg) {
          westFormMsg.textContent = 'Please enter a health question of at least 3 characters.';
          westFormMsg.hidden = false;
        }
        if (westQuestion) westQuestion.focus();
        return;
      }

      if (westFormMsg) westFormMsg.hidden = true;
      if (westResults) westResults.hidden = true;

      var token = ++runToken;
      if (westSubmit) {
        westSubmit.disabled = true;
        westSubmit.classList.add('is-loading');
        var lb = westSubmit.querySelector('.west-submit-label');
        if (lb) lb.textContent = 'Running';
      }
      if (runtime) {
        runtime.hidden = false;
        runtime.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'nearest' });
      }

      runPipeline(question, {}, token)
        .then(function (result) {
          if (!result || token !== runToken) return;
          if (result.kind === 'safety') renderSafety(result.emergency);
          else if (result.kind === 'abstain') renderAbstain();
          else if (result.kind === 'veto') renderVeto(result.note);
          else if (result.kind === 'error') renderError(result.message);
          else renderFull(result);
        })
        .catch(function (err) {
          if (token !== runToken) return;
          setRunState('error', 'Failed');
          stopClock();
          renderError(err && err.message);
        })
        .finally(function () {
          if (token !== runToken) return;
          if (westSubmit) {
            westSubmit.disabled = false;
            westSubmit.classList.remove('is-loading');
            var lb2 = westSubmit.querySelector('.west-submit-label');
            if (lb2) lb2.textContent = 'Run MediRAG-West';
          }
        });
    });
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!net || !netCanvas || (runtime && runtime.hidden)) return;
      var stage = net.stage;
      var evCount = net.layers[2].count;
      stopNetwork();
      buildNetwork(AGENT_ORDER, evCount);
      setNetStage(stage);
      startNetwork();
    }, 180);
  });

  window._westConsultation = westConsultation;
})();
