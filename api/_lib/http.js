/* Small response helpers shared by every Edge function. */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch (err) {
    return null;
  }
}

function methodNotAllowed() {
  return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405);
}

function badRequest(message) {
  return json({ error: 'bad_request', message }, 400);
}

export { json, readJsonBody, methodNotAllowed, badRequest };
