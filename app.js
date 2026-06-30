(function () {
  const toggle = document.querySelector('.view-toggle');
  const buttons = document.querySelectorAll('.toggle-btn');
  const homeView = document.getElementById('home-view');
  const demoView = document.getElementById('demo-view');
  const nav = document.querySelector('.nav');

  if (!toggle || !homeView || !demoView) return;

  function setView(view) {
    const isDemo = view === 'demo';

    document.body.classList.toggle('demo-mode', isDemo);
    toggle.classList.toggle('is-demo', isDemo);

    buttons.forEach(function (btn) {
      const active = btn.dataset.view === view;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    homeView.hidden = isDemo;
    demoView.hidden = !isDemo;

    if (nav) {
      nav.hidden = isDemo;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setView(btn.dataset.view);
    });
  });

  const demoOptions = document.querySelector('.demo-options');
  const prototypeStatus = document.querySelector('.prototype-status');
  const tcmConsultation = document.getElementById('tcm-consultation');

  function setDemoMode(mode) {
    document.querySelectorAll('.demo-option').forEach(function (el) {
      const active = el.dataset.mode === mode;
      el.classList.toggle('is-selected', active);
      el.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    if (demoOptions) {
      demoOptions.classList.remove('mode-west', 'mode-tcm', 'mode-both');
      demoOptions.classList.add('mode-' + mode);
    }

    const tcmActive = mode === 'tcm';
    if (tcmConsultation) tcmConsultation.hidden = !tcmActive;
    if (prototypeStatus) {
      prototypeStatus.hidden = tcmActive;
      if (!tcmActive) {
        const title = prototypeStatus.querySelector('strong');
        const description = prototypeStatus.querySelector('span:last-child');
        if (title) title.textContent = 'Not included in this TCM MVP';
        if (description) description.textContent = 'Select TCM to try the working retrieval prototype. Western and integrative modes remain placeholders.';
      }
    }
  }

  document.querySelectorAll('.demo-option').forEach(function (option) {
    option.addEventListener('click', function () {
      setDemoMode(option.dataset.mode);
    });
  });

  setDemoMode('tcm');

  const API_BASE_URL = window.MEDIRAG_API_BASE_URL || 'http://localhost:8000';
  const tcmForm = document.getElementById('tcm-consult-form');
  const tcmQuestion = document.getElementById('tcm-question');
  const tcmSubmit = document.getElementById('tcm-submit');
  const tcmFormMessage = document.getElementById('tcm-form-message');
  const tcmResults = document.getElementById('tcm-results');

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderEmpty(container, message) {
    container.replaceChildren(makeElement('p', 'tcm-empty', message));
  }

  function renderPatterns(patterns) {
    const container = document.getElementById('tcm-patterns');
    if (!container) return;
    container.replaceChildren();
    if (!patterns.length) {
      renderEmpty(container, 'No TCM pattern is suggested for this safety-first response.');
      return;
    }
    patterns.forEach(function (item, index) {
      const article = makeElement('article', 'tcm-list-item');
      const header = makeElement('div', 'tcm-list-item-header');
      header.append(makeElement('span', 'tcm-index', String(index + 1)), makeElement('h4', '', item.pattern));
      article.append(header, makeElement('p', '', item.rationale));
      if (item.matching_symptoms && item.matching_symptoms.length) {
        const matches = makeElement('div', 'tcm-match-list');
        item.matching_symptoms.forEach(function (symptom) {
          matches.append(makeElement('span', '', symptom));
        });
        article.append(matches);
      }
      container.append(article);
    });
  }

  function renderFormulas(formulas) {
    const container = document.getElementById('tcm-formulas');
    if (!container) return;
    container.replaceChildren();
    if (!formulas.length) {
      renderEmpty(container, 'No herb or formula examples are shown for this response.');
      return;
    }
    formulas.forEach(function (item) {
      const article = makeElement('article', 'tcm-list-item');
      const header = makeElement('div', 'tcm-list-item-header');
      header.append(makeElement('span', 'tcm-type-pill', item.type), makeElement('h4', '', item.name));
      article.append(header, makeElement('p', '', item.purpose));
      const warning = makeElement('p', 'tcm-inline-warning', item.safety_warning);
      article.append(warning);
      container.append(article);
    });
  }

  function renderEvidence(evidence) {
    const container = document.getElementById('tcm-evidence');
    if (!container) return;
    container.replaceChildren();
    if (!evidence.length) {
      renderEmpty(container, 'Evidence retrieval was intentionally skipped for this safety response.');
      return;
    }
    evidence.forEach(function (item, index) {
      const article = makeElement('article', 'tcm-evidence-item');
      const top = makeElement('div', 'tcm-evidence-top');
      const sourceBlock = makeElement('div', '');
      sourceBlock.append(makeElement('span', 'tcm-citation', '[' + (index + 1) + '] ' + item.source_type), makeElement('h4', '', item.title));
      const score = Math.round(Number(item.relevance_score || 0) * 100);
      top.append(sourceBlock, makeElement('strong', 'tcm-relevance', score + '% match'));
      const meter = makeElement('div', 'tcm-relevance-meter');
      const fill = makeElement('span', '');
      fill.style.width = Math.max(2, Math.min(100, score)) + '%';
      meter.append(fill);
      article.append(top, makeElement('p', '', item.snippet), meter, makeElement('cite', '', item.source));
      container.append(article);
    });
  }

  function renderSafety(notes) {
    const container = document.getElementById('tcm-safety-notes');
    if (!container) return;
    container.replaceChildren();
    notes.forEach(function (note) {
      container.append(makeElement('li', '', note));
    });
  }

  function renderTCMResult(data) {
    const score = Math.round(Number(data.confidence.score || 0) * 100);
    const generationSource = data.generation_source || (data.generation_mode === 'llm' ? 'siliconflow_llm' : data.generation_mode === 'safety' ? 'safety_rule' : 'mock_fallback');
    const modeLabel = generationSource === 'siliconflow_llm'
      ? 'AI generated with local evidence'
      : generationSource === 'safety_rule'
        ? 'Safety rule'
        : 'Local medical library fallback';
    const sourceLabel = generationSource === 'siliconflow_llm'
      ? 'generation_source: siliconflow_llm'
      : generationSource === 'safety_rule'
        ? 'generation_source: safety_rule'
        : 'generation_source: mock_fallback';
    const modelLabel = data.llm_model ? 'llm_model: ' + data.llm_model : 'llm_model: local';
    const groundingLabel = generationSource === 'siliconflow_llm'
      ? 'Grounding: LLM answer grounded by local retrieved evidence.'
      : generationSource === 'safety_rule'
        ? 'Grounding: safety rule response; TCM generation was bypassed.'
        : 'Grounding: local fallback answer generated from retrieved TCM evidence.';

    document.getElementById('tcm-summary').textContent = data.tcm_perspective;
    document.getElementById('tcm-grounding-note').textContent = groundingLabel;
    document.getElementById('tcm-confidence-score').textContent = score + '%';
    document.getElementById('tcm-confidence-level').textContent = data.confidence.level + ' confidence';
    document.getElementById('tcm-confidence-reason').textContent = data.confidence.reason;
    document.getElementById('tcm-disclaimer').textContent = data.disclaimer;
    document.getElementById('tcm-generation-mode').textContent = modeLabel;
    document.getElementById('tcm-generation-source').textContent = sourceLabel;
    document.getElementById('tcm-llm-model').textContent = modelLabel;

    const llmError = document.getElementById('tcm-llm-error');
    if (llmError) {
      if (data.llm_error) {
        llmError.hidden = false;
        llmError.textContent = data.llm_error === 'LLM_API_KEY is missing'
          ? 'No LLM API key is configured. This answer is generated from the local TCM medical knowledge base.'
          : 'The AI provider or network is temporarily unavailable, so this answer is generated from the local TCM medical knowledge base. llm_error: ' + data.llm_error;
      } else {
        llmError.hidden = true;
        llmError.textContent = '';
      }
    }

    const urgent = document.getElementById('tcm-urgent');
    urgent.hidden = !data.urgent;
    tcmResults.classList.toggle('is-urgent', Boolean(data.urgent));
    renderPatterns(data.possible_patterns || []);
    renderFormulas(data.related_herbs_or_formulas || []);
    renderEvidence(data.evidence || []);
    renderSafety(data.safety_notes || []);
    tcmResults.hidden = false;
    tcmResults.setAttribute('aria-busy', 'false');
    tcmResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showFormMessage(message) {
    tcmFormMessage.textContent = message;
    tcmFormMessage.hidden = false;
  }

  document.querySelectorAll('.tcm-sample').forEach(function (button) {
    button.addEventListener('click', function () {
      tcmQuestion.value = button.dataset.question || '';
      tcmQuestion.focus();
      tcmFormMessage.hidden = true;
    });
  });

  if (tcmForm) {
    tcmForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const formData = new FormData(tcmForm);
      const question = String(formData.get('question') || '').trim();
      tcmFormMessage.hidden = true;

      if (question.length < 3) {
        showFormMessage('Please enter a health question of at least 3 characters.');
        tcmQuestion.focus();
        return;
      }

      const payload = {
        question: question,
        context: {
          age: String(formData.get('age') || '').trim(),
          gender: String(formData.get('gender') || '').trim(),
          duration: String(formData.get('duration') || '').trim(),
          medications: String(formData.get('medications') || '').trim(),
          pregnancy: String(formData.get('pregnancy') || '').trim(),
          allergies: String(formData.get('allergies') || '').trim()
        }
      };

      tcmSubmit.disabled = true;
      tcmSubmit.classList.add('is-loading');
      tcmSubmit.querySelector('.tcm-submit-label').textContent = 'Retrieving evidence…';
      tcmResults.setAttribute('aria-busy', 'true');

      try {
        const response = await fetch(API_BASE_URL + '/api/tcm/consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });
        let data = {};
        try {
          data = await response.json();
        } catch (_) {
          throw new Error('The backend returned an unreadable response.');
        }
        if (!response.ok) {
          throw new Error(typeof data.detail === 'string' ? data.detail : 'The consultation could not be completed.');
        }
        renderTCMResult(data);
      } catch (error) {
        const offline = error instanceof TypeError;
        showFormMessage(offline
          ? 'The TCM-RAG backend is not reachable. Start it on http://localhost:8000, then try again.'
          : error.message || 'Something went wrong. Please try again.');
        tcmResults.setAttribute('aria-busy', 'false');
      } finally {
        tcmSubmit.disabled = false;
        tcmSubmit.classList.remove('is-loading');
        tcmSubmit.querySelector('.tcm-submit-label').textContent = 'Run TCM-RAG';
      }
    });
  }

  const languageButtons = document.querySelectorAll('.language-btn');
  const translations = {
    en: {
      lang: 'en',
      title: 'Multi-LLM-as-a-Judge RAG Architecture for Medical Consensus',
      nav: ['About', 'Architecture', 'Research'],
      view: ['Home', 'Demo'],
      heroEyebrow: 'University of Nottingham · Research Internship',
      heroTitle: 'Multi-LLM-as-a-Judge RAG Architecture for Medical Consensus',
      heroLead: 'A multi-agent healthcare AI framework combining Retrieval-Augmented Generation, Agentic AI, and LLM-as-a-Judge to deliver evidence-grounded, explainable health information across Western Medicine, Traditional Chinese Medicine, Nutrition, and Lifestyle Medicine.',
      supervisor: 'Supervisor',
      intern: 'Research Intern',
      major: 'BSc (Hons) Computer Science with AI',
      aboutTitle: 'Research Problem',
      aboutLead: 'Current healthcare AI assistants suffer from critical limitations.',
      problems: [
        '<strong>Hallucinations</strong> — Models generate plausible but unsupported medical claims without grounding in authoritative sources.',
        '<strong>Lack of evidence transparency</strong> — Responses rarely cite clinical guidelines, literature, or explain the strength of underlying evidence.',
        '<strong>Conflicting paradigms</strong> — Systems cannot reconcile recommendations from different medical traditions and knowledge bases.',
        '<strong>Poor safety governance</strong> — Unsafe advice, contraindications, and unsupported claims often pass through without automated review.',
        '<strong>Limited explainability</strong> — Users receive single opaque answers rather than transparent reasoning, uncertainty, or disagreement.'
      ],
      visionLabel: 'Research Vision',
      vision: 'To develop a trustworthy and explainable healthcare AI ecosystem that intelligently integrates knowledge from multiple medical paradigms, verifies recommendations through evidence-aware AI judges, and provides transparent, safety-conscious health guidance — transforming healthcare AI from a single-answer chatbot into a virtual multidisciplinary advisory board.',
      archTitle: 'System Architecture',
      archLead: 'From health question to retrieved evidence, specialist debate, safety judging, and final consensus.',
      inputKicker: 'Input',
      inputTitle: 'Question Intake',
      inputLead: 'User context is interpreted and routed into the correct medical knowledge paths.',
      userTitle: 'User',
      userDesc: 'Asks a health question',
      plannerTitle: 'Query Planner',
      plannerDesc: 'Analyzes the question and plans retrieval and agents',
      retrievalKicker: 'Retrieval',
      retrievalTitle: 'Dual Evidence Grounding',
      retrievalLead: 'Western medicine and TCM evidence sources are retrieved separately before being reconciled.',
      westRetrievalDesc: 'Modern medicine retrieval',
      tcmRetrievalDesc: 'Traditional Chinese Medicine retrieval',
      debateKicker: 'Governance',
      debateTitle: 'Debate, Judge, Consensus',
      debateLead: 'Specialist agents propose answers, then SafeJudge checks evidence, risk, conflict, and confidence.',
      debateLabel: 'Multi-Agent Debate',
      debateDesc: 'Domain-specific agents independently generate recommendations and rationales',
      agents: [
        ['Western Medicine Agent', 'Evidence-based modern medicine'],
        ['TCM Agent', 'TCM theory, syndrome differentiation, herbal knowledge'],
        ['Nutrition Agent', 'Dietary guidance'],
        ['Lifestyle Agent', 'Behavioral and wellness guidance']
      ],
      judgeLabel: 'SafeJudge',
      judgeDesc: 'LLM-as-a-Judge evaluates, verifies, and scores all agent outputs',
      judges: [
        ['Evidence Judge', 'Checks citation quality'],
        ['Safety Judge', 'Detects risks and contraindications'],
        ['Conflict Judge', 'Identifies conflicts between paradigms'],
        ['Confidence Judge', 'Estimates uncertainty levels']
      ],
      outputTitle: 'Integrated Response',
      outputDesc: 'Synthesized, evidence-aware, and safety-validated recommendation',
      outputItems: ['Summary of recommendations', 'Evidence & citations', 'Agreements & disagreements', 'Safety notes', 'Confidence score'],
      researchTitle: 'Research Questions',
      researchLead: 'Key questions guiding the investigation.',
      questions: [
        'Can multi-agent retrieval and reasoning improve the factual accuracy and completeness of healthcare question answering compared with conventional RAG systems?',
        'Can LLM-as-a-Judge mechanisms effectively detect hallucinations, unsafe recommendations, and unsupported claims in healthcare AI outputs?',
        'How can AI systems reconcile recommendations from different medical paradigms while maintaining transparency and user trust?',
        'Does multi-agent debate and consensus-building improve healthcare answer quality compared with single-agent generation?',
        'How should healthcare AI communicate evidence strength, uncertainty, and conflicting viewpoints to end users?',
        'Can integrative healthcare AI increase user confidence and perceived trustworthiness without sacrificing scientific rigor?'
      ],
      demoEyebrow: 'MediConsensus Demo',
      demoTitle: 'Choose a consultation mode',
      demoLead: 'Select which medical knowledge base to query for your health question.',
      demoOptions: [
        ['Western Medicine', 'Evidence-based modern medicine via MediRAG-West'],
        ['TCM', 'Traditional Chinese Medicine via TCM-RAG'],
        ['Western Medicine + TCM', 'Integrative dual-paradigm consultation']
      ],
      statusTitle: 'Prototyping in progress',
      statusDesc: 'Consultation workflow and medical retrieval outputs are under active development.',
      footer: '© 2026 University of Nottingham Research Internship',
      footerSub: 'Multi-LLM-as-a-Judge RAG Architecture for Medical Consensus'
    },
    ko: {
      lang: 'ko',
      title: '의료 합의를 위한 Multi-LLM-as-a-Judge RAG 아키텍처',
      nav: ['소개', '아키텍처', '연구'],
      view: ['홈', '데모'],
      heroEyebrow: '노팅엄 대학교 · 연구 인턴십',
      heroTitle: '의료 합의를 위한 Multi-LLM-as-a-Judge RAG 아키텍처',
      heroLead: '검색 증강 생성, 에이전트 AI, LLM-as-a-Judge를 결합한 다중 에이전트 헬스케어 AI 프레임워크로, 서양의학, 중의학, 영양, 생활의학 전반에서 근거 기반의 설명 가능한 건강 정보를 제공합니다.',
      supervisor: '지도교수',
      intern: '연구 인턴',
      major: '컴퓨터공학 및 AI 학사과정',
      aboutTitle: '연구 문제',
      aboutLead: '현재 헬스케어 AI 어시스턴트는 중요한 한계를 가지고 있습니다.',
      problems: [
        '<strong>환각</strong> — 모델이 권위 있는 근거 없이 그럴듯하지만 뒷받침되지 않는 의학적 주장을 생성합니다.',
        '<strong>근거 투명성 부족</strong> — 답변이 임상 지침, 문헌, 근거의 강도를 충분히 제시하지 못합니다.',
        '<strong>의학 패러다임 충돌</strong> — 서로 다른 의학 전통과 지식 기반의 권고를 조화롭게 다루기 어렵습니다.',
        '<strong>안전성 관리 부족</strong> — 위험한 조언, 금기, 상호작용, 근거 없는 주장이 자동 검증 없이 통과할 수 있습니다.',
        '<strong>설명 가능성 부족</strong> — 사용자는 투명한 추론, 불확실성, 의견 차이가 아닌 단일한 불투명 답변만 받기 쉽습니다.'
      ],
      visionLabel: '연구 비전',
      vision: '여러 의학 패러다임의 지식을 지능적으로 통합하고, 근거 인식형 AI judge로 권고를 검증하며, 투명하고 안전 중심의 건강 안내를 제공하는 신뢰 가능한 헬스케어 AI 생태계를 개발합니다. 단일 답변 챗봇을 가상의 다학제 자문위원회로 확장하는 것이 목표입니다.',
      archTitle: '시스템 아키텍처',
      archLead: '건강 질문에서 근거 검색, 전문가 토론, 안전성 판단, 최종 합의까지 이어지는 흐름입니다.',
      inputKicker: '입력',
      inputTitle: '질문 접수',
      inputLead: '사용자 맥락을 해석하고 알맞은 의학 지식 경로로 라우팅합니다.',
      userTitle: '사용자',
      userDesc: '건강 질문을 입력합니다',
      plannerTitle: '쿼리 플래너',
      plannerDesc: '질문을 분석하고 검색 및 에이전트 구성을 계획합니다',
      retrievalKicker: '검색',
      retrievalTitle: '이중 근거 기반 검색',
      retrievalLead: '서양의학과 중의학 근거를 각각 검색한 뒤 조화롭게 통합합니다.',
      westRetrievalDesc: '현대 의학 검색',
      tcmRetrievalDesc: '중의학 검색',
      debateKicker: '거버넌스',
      debateTitle: '토론, 판단, 합의',
      debateLead: '전문 에이전트가 답변을 제안하고 SafeJudge가 근거, 위험, 충돌, 신뢰도를 점검합니다.',
      debateLabel: '다중 에이전트 토론',
      debateDesc: '분야별 에이전트가 독립적으로 권고와 근거를 생성합니다',
      agents: [
        ['서양의학 에이전트', '근거 기반 현대 의학'],
        ['중의학 에이전트', '변증, 중약 지식, 중의학 이론'],
        ['영양 에이전트', '식이 및 영양 안내'],
        ['생활습관 에이전트', '행동 및 웰니스 안내']
      ],
      judgeLabel: 'SafeJudge',
      judgeDesc: 'LLM-as-a-Judge가 모든 에이전트 출력을 평가, 검증, 점수화합니다',
      judges: [
        ['근거 Judge', '인용 품질 점검'],
        ['안전 Judge', '위험과 금기 탐지'],
        ['충돌 Judge', '패러다임 간 충돌 식별'],
        ['신뢰도 Judge', '불확실성 추정']
      ],
      outputTitle: '통합 응답',
      outputDesc: '근거 인식형, 안전성 검증형 종합 권고',
      outputItems: ['권고 요약', '근거 및 인용', '합의와 불일치', '안전 참고사항', '신뢰도 점수'],
      researchTitle: '연구 질문',
      researchLead: '연구를 이끄는 핵심 질문입니다.',
      questions: [
        '다중 에이전트 검색과 추론은 기존 RAG 시스템보다 헬스케어 질의응답의 정확성과 완성도를 높일 수 있는가?',
        'LLM-as-a-Judge 메커니즘은 헬스케어 AI 출력의 환각, 위험 권고, 근거 없는 주장을 효과적으로 탐지할 수 있는가?',
        'AI 시스템은 투명성과 신뢰를 유지하면서 서로 다른 의학 패러다임의 권고를 어떻게 조화시킬 수 있는가?',
        '다중 에이전트 토론과 합의 형성은 단일 에이전트 생성보다 답변 품질을 개선하는가?',
        '헬스케어 AI는 근거의 강도, 불확실성, 상충되는 관점을 사용자에게 어떻게 전달해야 하는가?',
        '통합 헬스케어 AI는 과학적 엄밀성을 유지하면서 사용자 신뢰와 신뢰감을 높일 수 있는가?'
      ],
      demoEyebrow: 'MediConsensus 데모',
      demoTitle: '상담 모드 선택',
      demoLead: '건강 질문에 사용할 의학 지식 기반을 선택하세요.',
      demoOptions: [
        ['서양의학', 'MediRAG-West 기반 근거 중심 현대 의학'],
        ['중의학', 'TCM-RAG 기반 전통 중의학'],
        ['서양의학 + 중의학', '두 패러다임을 통합한 상담']
      ],
      statusTitle: '프로토타입 제작 중',
      statusDesc: '상담 워크플로우와 의료 검색 출력은 현재 개발 중입니다.',
      footer: '© 2026 노팅엄 대학교 연구 인턴십',
      footerSub: '의료 합의를 위한 Multi-LLM-as-a-Judge RAG 아키텍처'
    },
    zh: {
      lang: 'zh-Hans',
      title: '面向医疗共识的 Multi-LLM-as-a-Judge RAG 架构',
      nav: ['关于', '架构', '研究'],
      view: ['首页', '演示'],
      heroEyebrow: '诺丁汉大学 · 研究实习',
      heroTitle: '面向医疗共识的 Multi-LLM-as-a-Judge RAG 架构',
      heroLead: '一个多智能体医疗 AI 框架，结合检索增强生成、智能体 AI 与 LLM-as-a-Judge，为西医、中医、营养和生活方式医学提供有证据支撑、可解释的健康信息。',
      supervisor: '指导老师',
      intern: '研究实习生',
      major: '计算机科学与人工智能荣誉学士',
      aboutTitle: '研究问题',
      aboutLead: '当前医疗 AI 助手仍存在关键限制。',
      problems: [
        '<strong>幻觉</strong> — 模型可能生成看似合理但缺乏权威证据支持的医学说法。',
        '<strong>证据透明度不足</strong> — 回答很少引用临床指南、文献，或解释证据强度。',
        '<strong>医学范式冲突</strong> — 系统难以协调不同医学传统和知识库中的建议。',
        '<strong>安全治理不足</strong> — 不安全建议、禁忌和无证据主张可能未经自动审查就输出。',
        '<strong>可解释性有限</strong> — 用户往往只得到单一且不透明的答案，而非清晰的推理、不确定性或分歧。'
      ],
      visionLabel: '研究愿景',
      vision: '构建可信且可解释的医疗 AI 生态系统，智能整合多种医学范式的知识，通过证据感知的 AI judge 验证建议，并提供透明、注重安全的健康指导，将医疗 AI 从单一答案聊天机器人转变为虚拟的多学科咨询委员会。',
      archTitle: '系统架构',
      archLead: '从健康问题到证据检索、专家讨论、安全评审与最终共识。',
      inputKicker: '输入',
      inputTitle: '问题接入',
      inputLead: '解析用户上下文，并路由到合适的医学知识路径。',
      userTitle: '用户',
      userDesc: '提出健康问题',
      plannerTitle: '查询规划器',
      plannerDesc: '分析问题并规划检索与智能体',
      retrievalKicker: '检索',
      retrievalTitle: '双证据 grounding',
      retrievalLead: '西医与中医证据源分别检索，再进行协调。',
      westRetrievalDesc: '现代医学检索',
      tcmRetrievalDesc: '中医检索',
      debateKicker: '治理',
      debateTitle: '讨论、评审、共识',
      debateLead: '专业智能体提出答案，SafeJudge 检查证据、风险、冲突和置信度。',
      debateLabel: '多智能体讨论',
      debateDesc: '不同领域的智能体独立生成建议与理由',
      agents: [
        ['西医智能体', '循证现代医学'],
        ['中医智能体', '中医理论、辨证、草药知识'],
        ['营养智能体', '饮食指导'],
        ['生活方式智能体', '行为与健康生活指导']
      ],
      judgeLabel: 'SafeJudge',
      judgeDesc: 'LLM-as-a-Judge 对所有智能体输出进行评估、验证和评分',
      judges: [
        ['证据 Judge', '检查引用质量'],
        ['安全 Judge', '检测风险和禁忌'],
        ['冲突 Judge', '识别范式之间的冲突'],
        ['置信度 Judge', '估计不确定性']
      ],
      outputTitle: '综合响应',
      outputDesc: '经过证据感知与安全验证的综合建议',
      outputItems: ['建议摘要', '证据与引用', '一致与分歧', '安全提示', '置信度评分'],
      researchTitle: '研究问题',
      researchLead: '指导本研究的关键问题。',
      questions: [
        '多智能体检索与推理能否相比传统 RAG 系统提升医疗问答的事实准确性和完整性？',
        'LLM-as-a-Judge 机制能否有效检测医疗 AI 输出中的幻觉、不安全建议和无证据主张？',
        'AI 系统如何在保持透明度和用户信任的同时协调不同医学范式的建议？',
        '多智能体讨论与共识构建是否能比单智能体生成提高医疗答案质量？',
        '医疗 AI 应如何向用户传达证据强度、不确定性和相互冲突的观点？',
        '整合式医疗 AI 能否在不牺牲科学严谨性的前提下提升用户信心和可信度感知？'
      ],
      demoEyebrow: 'MediConsensus 演示',
      demoTitle: '选择咨询模式',
      demoLead: '选择用于健康问题的医学知识库。',
      demoOptions: [
        ['西医', '通过 MediRAG-West 提供循证现代医学'],
        ['中医', '通过 TCM-RAG 提供传统中医'],
        ['西医 + 中医', '双范式整合咨询']
      ],
      statusTitle: '原型开发中',
      statusDesc: '咨询流程和医学检索输出仍在积极开发中。',
      footer: '© 2026 诺丁汉大学研究实习',
      footerSub: '面向医疗共识的 Multi-LLM-as-a-Judge RAG 架构'
    }
  };

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setHTML(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.innerHTML = value;
  }

  function setTextList(selector, values) {
    document.querySelectorAll(selector).forEach(function (element, index) {
      if (values[index] !== undefined) {
        element.textContent = values[index];
      }
    });
  }

  function applyLanguage(lang) {
    const t = translations[lang] || translations.en;
    document.documentElement.lang = t.lang;
    document.title = t.title;

    setTextList('.toggle-btn', t.view);
    setTextList('.nav a', t.nav);
    setText('.hero .eyebrow', t.heroEyebrow);
    setText('.hero h1', t.heroTitle);
    setText('.hero .lead', t.heroLead);
    setText('.team-list li:first-child .member-role', t.supervisor);
    document.querySelectorAll('.team-list li:not(:first-child) .member-role').forEach(function (el) {
      el.textContent = t.intern;
    });
    document.querySelectorAll('.member-major').forEach(function (el) {
      el.textContent = t.major;
    });

    setText('#about h2', t.aboutTitle);
    setText('#about .section-header p', t.aboutLead);
    document.querySelectorAll('#about .plain-list li').forEach(function (el, index) {
      if (t.problems[index]) el.innerHTML = t.problems[index];
    });
    setText('.vision-label', t.visionLabel);
    setText('.vision p:last-child', t.vision);

    setText('#architecture .section-header h2', t.archTitle);
    setText('#architecture .section-header p', t.archLead);
    setText('.arch-stage-input .metric-kicker', t.inputKicker);
    setText('.arch-stage-input h3', t.inputTitle);
    setText('.arch-stage-input .arch-stage-header p', t.inputLead);
    setText('.arch-stage-input [data-layer="1"] strong', t.userTitle);
    setText('.arch-stage-input [data-layer="1"] .node-text span', t.userDesc);
    setText('.arch-stage-input [data-layer="2"] strong', t.plannerTitle);
    setText('.arch-stage-input [data-layer="2"] .node-text span', t.plannerDesc);

    setText('.arch-stage-retrieval .metric-kicker', t.retrievalKicker);
    setText('.arch-stage-retrieval h3', t.retrievalTitle);
    setText('.arch-stage-retrieval .arch-stage-header p', t.retrievalLead);
    setText('.arch-stage-retrieval .node-blue .node-text span', t.westRetrievalDesc);
    setText('.arch-stage-retrieval .node-green .node-text span', t.tcmRetrievalDesc);

    setText('.arch-stage-governance .metric-kicker', t.debateKicker);
    setText('.arch-stage-governance h3', t.debateTitle);
    setText('.arch-stage-governance .arch-stage-header p', t.debateLead);
    setText('.layer-debate .container-label', t.debateLabel);
    setText('.layer-debate .container-desc', t.debateDesc);
    document.querySelectorAll('.layer-debate .arch-node').forEach(function (el, index) {
      if (t.agents[index]) {
        el.querySelector('strong').textContent = t.agents[index][0];
        el.querySelector('span').textContent = t.agents[index][1];
      }
    });
    setText('.layer-judge .container-label', t.judgeLabel);
    setText('.layer-judge .container-desc', t.judgeDesc);
    document.querySelectorAll('.layer-judge .arch-node').forEach(function (el, index) {
      if (t.judges[index]) {
        el.querySelector('strong').textContent = t.judges[index][0];
        el.querySelector('span').textContent = t.judges[index][1];
      }
    });
    setText('.arch-node-output .node-text strong', t.outputTitle);
    setText('.arch-node-output .node-text span', t.outputDesc);
    setTextList('.node-output-list li', t.outputItems);

    setText('#research h2', t.researchTitle);
    setText('#research .section-header p', t.researchLead);
    setTextList('.rq-list li', t.questions);

    setText('.demo-section .eyebrow', t.demoEyebrow);
    setText('.demo-title', t.demoTitle);
    setText('.demo-lead', t.demoLead);
    document.querySelectorAll('.demo-option').forEach(function (el, index) {
      if (t.demoOptions[index]) {
        el.querySelector('.demo-option-label').textContent = t.demoOptions[index][0];
        el.querySelector('.demo-option-desc').textContent = t.demoOptions[index][1];
      }
    });
    setText('.prototype-status strong', t.statusTitle);
    setText('.prototype-status span:last-child', t.statusDesc);
    setText('.site-footer p:first-child', t.footer);
    setText('.footer-sub', t.footerSub);

    languageButtons.forEach(function (button) {
      const active = button.dataset.lang === lang;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  languageButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      applyLanguage(button.dataset.lang);
    });
  });
})();
