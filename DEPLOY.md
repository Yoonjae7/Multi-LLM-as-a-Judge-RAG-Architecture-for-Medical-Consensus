# Deploying MediRAG-West to Vercel

The site is a static frontend (`index.html`, `west.js`, `styles.css`) plus a
small set of Vercel Edge Functions under `/api` that call two free LLM
providers. Vercel auto-detects both halves, no build step and no framework
migration needed.

## 1. Get two free API keys

Both are genuinely free, no credit card:

- **Groq** (runs the three specialist agents) → https://console.groq.com/keys
- **Google AI Studio / Gemini** (runs the four SafeJudge judges) → https://aistudio.google.com/apikey

Two different providers on purpose: it means a judge never scores an answer
from its own model family, which is Constraint J1 in `research.html#s3`.

## 2. Add them to Vercel

In your Vercel project: **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `GROQ_API_KEY` | your Groq key |
| `GEMINI_API_KEY` | your Gemini key |

Redeploy after adding them (env var changes need a new deployment to take
effect on existing deployments).

## 3. Deploy

If the repo is already connected to a Vercel project, push to your default
branch and it deploys automatically. Otherwise:

```bash
npm i -g vercel
vercel link
vercel env add GROQ_API_KEY
vercel env add GEMINI_API_KEY
vercel deploy --prod
```

## 4. Local development

Copy `.env.example` to `.env.local` and fill in both keys, then:

```bash
vercel dev
```

This serves the static site and the `/api` functions together on
`localhost`, matching production.

## What each free tier can handle

One full question costs about 9 model calls (3 agents + 1 debate + 4 judges
+ 1 consensus, fewer if the emergency check or evidence check stops the
pipeline early). At roughly 1,000 requests/day on each provider's free
tier, that's a little over 100 full demo runs a day, shared across every
visitor since it's one API key. Comfortable for a supervisor demo or a
class, not built for public high-traffic use. If a provider rate-limits
you, the UI surfaces the real error message rather than failing silently.

## Files involved

```
api/
├── agent.js        one specialist agent, one Groq call
├── debate.js       cross-examination round, one Groq call
├── judge.js        one SafeJudge axis, one Gemini call
├── consensus.js    final synthesis prose, one Groq call
└── _lib/
    ├── llm.js       Groq/Gemini HTTP clients, error handling, JSON extraction
    ├── prompts.js    every system/user prompt
    └── http.js       small Response/JSON helpers
west.js              client-side orchestration, retrieval, visualisation
```

Retrieval (the "MediRAG-West" pipeline stage) and the emergency safety
check both run as plain JavaScript in the browser, not as API calls. That
is deliberate, not a shortcut: see `research.html#s3` for why the
safety-critical role does not need model capability.
