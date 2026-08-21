/* Prompt builders for MediRAG-West. Every prompt constrains the model to
   the evidence it was given and forbids diagnosis, dosing, and prescribing,
   matching the disclaimer in the research report (research.html#s5). */

const AGENT_BRIEFS = {
  western: {
    label: 'Western Medicine Agent',
    brief: 'You cover what the condition may be, red-flag symptoms, when to seek professional care, and medication cautions.'
  },
  nutrition: {
    label: 'Nutrition Agent',
    brief: 'You cover dietary factors that have real mechanistic or trial support for this question.'
  },
  lifestyle: {
    label: 'Lifestyle Agent',
    brief: 'You cover sleep, activity, behaviour and stress factors relevant to this question.'
  }
};

const BASE_RULES = [
  'Use only the supplied evidence. Do not use outside medical knowledge or invent sources.',
  'Do not diagnose, prescribe, name a dose, or tell the user to start, stop or change a medication.',
  'If the evidence is thin, say so plainly instead of sounding more certain than you are.',
  'Write two to four plain sentences a layperson can follow. No headings, no bullet points, no markdown.'
].join(' ');

function agentSystemPrompt(role) {
  const spec = AGENT_BRIEFS[role] || AGENT_BRIEFS.western;
  return (
    `You are the ${spec.label} inside a research prototype multi-agent medical question answering system. ` +
    `${spec.brief} ${BASE_RULES} ` +
    'Return strict JSON with this exact shape: ' +
    '{"text":"...","confidence":0.0,"strength":"Low|Moderate|High","cited_evidence_ids":["E1"],"gap":"one sentence on what you could not tell from the evidence given"}. ' +
    'confidence is your own calibrated 0 to 1 estimate. strength describes how strong the cited evidence is, not how sure you sound.'
  );
}

function agentUserPrompt(question, context, evidence) {
  const evidenceBlock = evidence
    .map((e) => `[${e.id}] ${e.source}, ${e.grade} certainty: ${e.title}. ${e.snippet}`)
    .join('\n');
  const contextLine = context && Object.keys(context).length
    ? `Non-identifying context provided: ${JSON.stringify(context)}\n`
    : '';
  return (
    `User question: ${question}\n${contextLine}\n` +
    `Retrieved evidence:\n${evidenceBlock}\n\n` +
    'Answer from this evidence only. Cite the evidence ids you actually relied on.'
  );
}

function debateSystemPrompt() {
  return (
    'You are the cross-examination stage in a multi-agent medical prototype. Three specialist agents have each ' +
    'answered the same question from the same evidence. Read their answers and decide, for each agent, whether ' +
    'anything they said overstates the evidence, and whether any two agents materially disagree (not just differ ' +
    'in emphasis). Be concise. ' +
    'Return strict JSON: {"revisions":[{"role":"western|nutrition|lifestyle","note":"one sentence on what should be ' +
    'softened or corrected, or omit this agent if nothing needs revising"}],"conflicts":[{"title":"short label",' +
    '"detail":"one to two sentences on the disagreement and how to resolve it"}]}. ' +
    'Return empty arrays if there is nothing to flag. Do not invent disagreements that are not really there.'
  );
}

function debateUserPrompt(question, answers, evidence) {
  const answerBlock = answers
    .map((a) => `${a.role} (stated confidence ${a.confidence}): ${a.text}`)
    .join('\n\n');
  const evidenceIds = evidence.map((e) => `${e.id} (${e.grade})`).join(', ');
  return (
    `Question: ${question}\n\nEvidence available: ${evidenceIds}\n\nAgent answers:\n${answerBlock}`
  );
}

const JUDGE_BRIEFS = {
  evidence: {
    label: 'Evidence Judge',
    task: 'Check whether every claim traces back to the supplied evidence and whether the cited evidence ids actually support what is claimed.'
  },
  safety: {
    label: 'Safety Judge',
    task: 'Check for contraindications, missed red flags, drug interaction risks, or advice that could delay proper care.'
  },
  conflict: {
    label: 'Conflict Judge',
    task: 'Check whether the agents materially disagree with each other, as opposed to just covering different ground.'
  },
  confidence: {
    label: 'Confidence Judge',
    task: 'Check whether the certainty in each answer is proportionate to the strength of the evidence behind it.'
  }
};

function judgeSystemPrompt(axis) {
  const spec = JUDGE_BRIEFS[axis] || JUDGE_BRIEFS.evidence;
  const vetoClause = axis === 'safety'
    ? ' If you find a real safety problem serious enough that this answer should not reach the user as written, set veto to true.'
    : '';
  return (
    `You are the ${spec.label} in a multi-agent medical prototype, scoring anonymised agent answers. ${spec.task} ` +
    `Score independently. Do not let a good score on one aspect inflate your score on this one.${vetoClause} ` +
    'Return strict JSON: {"score":0.0,"note":"one to two sentences explaining the score"' +
    (axis === 'safety' ? ',"veto":false' : '') + '}.'
  );
}

function judgeUserPrompt(question, answers, evidence) {
  const evidenceBlock = evidence.map((e) => `[${e.id}] ${e.grade}: ${e.title}`).join('\n');
  const answerBlock = answers.map((a) => `${a.anonId}: ${a.text}`).join('\n\n');
  return (
    `Question: ${question}\n\nEvidence used:\n${evidenceBlock}\n\nAnonymised agent answers:\n${answerBlock}`
  );
}

function consensusSystemPrompt() {
  return (
    'You write the final combined answer for a multi-agent medical research prototype. You are given the specialist ' +
    'agent answers, the conflicts between them, and safety judge notes. Merge them into one coherent answer in plain ' +
    'language, four to six sentences, that a layperson can follow. Mention any real disagreement between agents ' +
    'rather than hiding it. Do not diagnose, prescribe, or name a dose. ' +
    'Return strict JSON: {"summary":"...","safety_notes":["...", "..."]}. ' +
    'safety_notes should be two to four short, concrete, actionable notes, always including when to seek urgent care ' +
    'if that is relevant to the question.'
  );
}

function consensusUserPrompt(question, answers, conflicts) {
  const answerBlock = answers.map((a) => `${a.role}: ${a.text}`).join('\n\n');
  const conflictBlock = conflicts.length
    ? conflicts.map((c) => `${c.title}: ${c.detail}`).join('\n')
    : 'None.';
  return (
    `Question: ${question}\n\nAgent answers:\n${answerBlock}\n\nUnresolved disagreement:\n${conflictBlock}`
  );
}

export {
  AGENT_BRIEFS,
  JUDGE_BRIEFS,
  agentSystemPrompt,
  agentUserPrompt,
  debateSystemPrompt,
  debateUserPrompt,
  judgeSystemPrompt,
  judgeUserPrompt,
  consensusSystemPrompt,
  consensusUserPrompt
};
