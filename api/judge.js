import { callGemini, errorPayload } from './_lib/llm.js';
import { judgeSystemPrompt, judgeUserPrompt, JUDGE_BRIEFS } from './_lib/prompts.js';
import { json, readJsonBody, methodNotAllowed, badRequest } from './_lib/http.js';

export const config = { runtime: 'edge' };

/* One judge axis, one Gemini call. Agents run on Groq (a different model
   family), and the client anonymises and shuffles answer order before
   calling this endpoint, so scoring is blind by construction. */
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed();

  const body = await readJsonBody(request);
  if (!body || typeof body.question !== 'string' || !Array.isArray(body.answers) || !body.answers.length) {
    return badRequest('Expected { axis, question, answers, evidence }.');
  }
  const axis = JUDGE_BRIEFS[body.axis] ? body.axis : 'evidence';

  try {
    const { parsed, model } = await callGemini(
      judgeSystemPrompt(axis),
      judgeUserPrompt(body.question, body.answers, body.evidence || []),
      { temperature: 0.15, maxTokens: 300 }
    );

    const score = clamp01(parsed.score, 0.5);
    const result = {
      axis,
      score,
      note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : 'No explanation was returned.',
      model
    };
    if (axis === 'safety') result.veto = parsed.veto === true;
    return json(result);
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
