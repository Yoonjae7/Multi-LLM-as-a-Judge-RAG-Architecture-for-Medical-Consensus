import { callGroq, errorPayload } from './_lib/llm.js';
import { agentSystemPrompt, agentUserPrompt, AGENT_BRIEFS } from './_lib/prompts.js';
import { json, readJsonBody, methodNotAllowed, badRequest } from './_lib/http.js';

export const config = { runtime: 'edge' };

/* One specialist agent, one Groq call. The client fans this out three
   times in parallel (western, nutrition, lifestyle) and lights up each
   network node only when its own response actually comes back. */
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed();

  const body = await readJsonBody(request);
  if (!body || typeof body.question !== 'string' || !Array.isArray(body.evidence)) {
    return badRequest('Expected { role, question, context, evidence }.');
  }
  const role = AGENT_BRIEFS[body.role] ? body.role : 'western';
  if (!body.evidence.length) return badRequest('evidence must be a non-empty array.');

  try {
    const { parsed, model } = await callGroq(
      agentSystemPrompt(role),
      agentUserPrompt(body.question, body.context || {}, body.evidence),
      { temperature: 0.25, maxTokens: 500 }
    );

    const confidence = clamp01(parsed.confidence, 0.6);
    return json({
      role,
      text: typeof parsed.text === 'string' && parsed.text.trim() ? parsed.text.trim() : 'No answer was returned.',
      confidence,
      strength: ['Low', 'Moderate', 'High'].includes(parsed.strength) ? parsed.strength : 'Moderate',
      citedEvidenceIds: Array.isArray(parsed.cited_evidence_ids) ? parsed.cited_evidence_ids.filter((id) => typeof id === 'string') : [],
      gap: typeof parsed.gap === 'string' ? parsed.gap : '',
      model
    });
  } catch (err) {
    const { status, body: errBody } = errorPayload(err);
    return json(errBody, status);
  }
}

function clamp01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}
