import { callGroq, errorPayload } from './_lib/llm.js';
import { debateSystemPrompt, debateUserPrompt } from './_lib/prompts.js';
import { json, readJsonBody, methodNotAllowed, badRequest } from './_lib/http.js';

export const config = { runtime: 'edge' };

/* Cross-examination stage, one combined Groq call rather than one per
   agent, since the point is to compare answers against each other. */
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed();

  const body = await readJsonBody(request);
  if (!body || typeof body.question !== 'string' || !Array.isArray(body.answers) || !body.answers.length) {
    return badRequest('Expected { question, answers, evidence }.');
  }

  try {
    const { parsed, model } = await callGroq(
      debateSystemPrompt(),
      debateUserPrompt(body.question, body.answers, body.evidence || []),
      { temperature: 0.2, maxTokens: 500 }
    );

    const revisions = Array.isArray(parsed.revisions)
      ? parsed.revisions
          .filter((r) => r && typeof r.note === 'string')
          .map((r) => ({ role: String(r.role || ''), note: r.note.trim() }))
      : [];
    const conflicts = Array.isArray(parsed.conflicts)
      ? parsed.conflicts
          .filter((c) => c && typeof c.detail === 'string')
          .map((c) => ({ title: String(c.title || 'Disagreement'), detail: c.detail.trim() }))
      : [];

    return json({ revisions, conflicts, model });
  } catch (err) {
    const { status, body: errBody } = errorPayload(err);
    return json(errBody, status);
  }
}
