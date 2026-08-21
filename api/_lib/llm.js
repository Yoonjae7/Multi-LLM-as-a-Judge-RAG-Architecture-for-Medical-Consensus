/* Shared LLM client helpers for MediRAG-West Edge functions.
   Two providers on purpose: agents run on Groq, judges run on Gemini.
   Different model families means a judge never scores its own kind,
   which is Constraint J1 from the research report (see research.html#s3). */

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

class LLMError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind || 'provider_error'; // 'missing_key' | 'rate_limited' | 'provider_error' | 'bad_response'
  }
}

/* typeof guards against a bare undeclared identifier, so this is safe to
   call outside Node/Edge (e.g. from a browser test harness) where
   `process` does not exist at all. */
function getEnv(name) {
  return typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
}

/* Models occasionally wrap JSON in prose or code fences. Extract the
   first well-formed JSON object rather than trusting raw output. */
function parseJsonLoose(text) {
  if (typeof text !== 'string') return null;
  let candidate = text.trim();
  if (candidate.startsWith('```')) {
    const lines = candidate.split('\n');
    if (lines[0].trim().startsWith('```')) lines.shift();
    if (lines.length && lines[lines.length - 1].trim().startsWith('```')) lines.pop();
    candidate = lines.join('\n').trim();
  }
  const attempts = [candidate];
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) attempts.push(candidate.slice(start, end + 1));
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (err) {
      continue;
    }
  }
  return null;
}

async function callGroq(systemPrompt, userPrompt, { temperature = 0.2, maxTokens = 900 } = {}) {
  const apiKey = getEnv('GROQ_API_KEY');
  if (!apiKey) throw new LLMError('GROQ_API_KEY is not configured on the server.', 'missing_key');

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
  } catch (err) {
    throw new LLMError('Network error while contacting Groq.', 'provider_error');
  }

  if (response.status === 429) throw new LLMError('Groq rate limit reached. Try again shortly.', 'rate_limited');
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new LLMError(`Groq returned HTTP ${response.status}. ${detail.slice(0, 200)}`, 'provider_error');
  }

  const data = await response.json().catch(() => null);
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new LLMError('Groq returned an empty response.', 'bad_response');

  const parsed = parseJsonLoose(content);
  if (!parsed) throw new LLMError('Groq did not return valid JSON.', 'bad_response');
  return { parsed, model: GROQ_MODEL };
}

async function callGemini(systemPrompt, userPrompt, { temperature = 0.2, maxTokens = 900 } = {}) {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) throw new LLMError('GEMINI_API_KEY is not configured on the server.', 'missing_key');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json'
        }
      })
    });
  } catch (err) {
    throw new LLMError('Network error while contacting Gemini.', 'provider_error');
  }

  if (response.status === 429) throw new LLMError('Gemini rate limit reached. Try again shortly.', 'rate_limited');
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new LLMError(`Gemini returned HTTP ${response.status}. ${detail.slice(0, 200)}`, 'provider_error');
  }

  const data = await response.json().catch(() => null);
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const content = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '';
  if (!content) throw new LLMError('Gemini returned an empty response.', 'bad_response');

  const parsed = parseJsonLoose(content);
  if (!parsed) throw new LLMError('Gemini did not return valid JSON.', 'bad_response');
  return { parsed, model: GEMINI_MODEL };
}

function errorPayload(err) {
  const kind = err instanceof LLMError ? err.kind : 'provider_error';
  const status = kind === 'missing_key' ? 500 : kind === 'rate_limited' ? 429 : 502;
  return { status, body: { error: kind, message: err.message || 'Unknown provider error' } };
}

export { callGroq, callGemini, parseJsonLoose, LLMError, errorPayload, GROQ_MODEL, GEMINI_MODEL };
