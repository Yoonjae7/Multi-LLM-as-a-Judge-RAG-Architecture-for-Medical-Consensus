import { callGroq, errorPayload } from './_lib/llm.js';
import { consensusSystemPrompt, consensusUserPrompt } from './_lib/prompts.js';
import { json, readJsonBody, methodNotAllowed, badRequest } from './_lib/http.js';

export const config = { runtime: 'edge' };

/* Final synthesis call. The confidence score itself is computed
   deterministically on the client from real evidence and judge scores
   (research.html#s5), not asked of the model, only the prose is generated. */
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed();

  const body = await readJsonBody(request);
  if (!body || typeof body.question !== 'string' || !Array.isArray(body.answers) || !body.answers.length) {
    return badRequest('Expected { question, answers, conflicts }.');
  }

  try {
    const { parsed, model } = await callGroq(
      consensusSystemPrompt(),
      consensusUserPrompt(body.question, body.answers, body.conflicts || []),
      { temperature: 0.3, maxTokens: 500 }
    );

    const safetyNotes = Array.isArray(parsed.safety_notes)
      ? parsed.safety_notes.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
      : [];

    return json({
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : '',
      safetyNotes,
      model
    });
  } catch (err) {
    const { status, body: errBody } = errorPayload(err);
    return json(errBody, status);
  }
}
