# MediRAG-West

MediRAG-West is a research prototype for evidence-grounded Western medicine question answering. It combines local retrieval, three specialist agents, a cross-examination round, four independent LLM judges, and a final consensus response.

The project provides educational health information only. It does not diagnose, prescribe, recommend doses, or replace qualified medical care.

## Architecture

1. A deterministic safety screen checks the question for urgent warning signs.
2. A lexical retriever searches the local Western medicine evidence library.
3. Western medicine, nutrition, and lifestyle agents independently answer from the same retrieved evidence.
4. A debate stage flags overstatement and material disagreement.
5. Evidence, safety, conflict, and confidence judges score anonymised answers.
6. A consensus stage produces one evidence-aware response with safety notes and a deterministic confidence score.

Specialist agents and synthesis run on Groq. Judges run on Gemini so a model family does not judge its own output.

## Project structure

```text
.
├── index.html             Home page and live demo
├── west.js                Western medicine retrieval and browser orchestration
├── app.js                 Home/demo navigation
├── research.html          Research report
├── styles.css             Site and demo styling
├── api
│   ├── agent.js           Specialist agent endpoint
│   ├── debate.js          Cross-examination endpoint
│   ├── judge.js           Independent judge endpoint
│   ├── consensus.js       Final synthesis endpoint
│   └── _lib
│       ├── http.js        Request and response helpers
│       ├── llm.js         Groq and Gemini clients
│       └── prompts.js     Grounding and safety prompts
├── .env.example
└── DEPLOY.md
```

## Run locally

Requirements:

- Node.js 18 or newer
- Vercel CLI
- Groq and Gemini API keys

Copy the environment template and add your keys:

```bash
cp .env.example .env.local
```

Then run:

```bash
npm install -g vercel
vercel dev
```

Open the local URL printed by Vercel. The frontend and `/api` functions must be served together for the full pipeline to work.

## Environment variables

```dotenv
GROQ_API_KEY=
GEMINI_API_KEY=
```

Never commit real API keys. See [DEPLOY.md](DEPLOY.md) for deployment instructions.

## Validation

Run the repository checks with:

```bash
npm test
```

The checks validate JavaScript syntax across the frontend and API functions. Clinical review and real-provider integration testing are still required before any research claims or public use.

## Safety and limitations

- The local evidence library is deliberately small and supports a limited set of common questions.
- Lexical retrieval is a transparent baseline, not a production clinical search engine.
- The emergency screen is conservative but cannot detect every urgent presentation.
- Generated claims are constrained to retrieved evidence, but LLM output still requires review.
- Confidence is an experimental system score, not a probability of clinical correctness.
- No part of this prototype should be used for diagnosis, prescribing, or emergency decision-making.
