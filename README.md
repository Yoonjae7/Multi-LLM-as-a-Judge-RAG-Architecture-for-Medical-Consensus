# MediConsensus TCM-RAG MVP

This branch contains a lightweight, research-only MVP for the Traditional Chinese Medicine (TCM) retrieval path shown in the MediConsensus architecture. Western medicine and integrative modes remain placeholders.

The flow is:

1. Accept a health question and optional user context.
2. Run deterministic emergency-phrase safety triage.
3. Rank a local curated TCM knowledge base with keyword overlap.
4. Generate a structured TCM perspective with an OpenAI-compatible LLM when configured.
5. Fall back to a deterministic response when no API key is present or the provider fails.
6. Return pattern hypotheses, educational formula examples, evidence chunks, citations, safety notes, and confidence.

> This is an educational research prototype, not a diagnosis or prescription. It must not be used to delay professional care or to start, stop, or change medication.

## Project structure

```text
.
├── index.html                  # Existing landing page plus TCM consultation panel
├── app.js                      # Demo mode, API call, and safe result rendering
├── styles.css                  # Existing style plus responsive TCM components
└── backend
    ├── main.py                 # FastAPI app and POST /api/tcm/consult
    ├── requirements.txt
    ├── .env.example
    ├── tests/test_api.py
    └── tcm
        ├── agent.py            # Safety gate, LLM adapter, deterministic fallback
        ├── knowledge_base.py   # 12 local curated demo entries
        ├── retriever.py        # Keyword ranking and query analysis
        ├── safety.py           # Emergency phrase rules
        └── schemas.py          # Request and response models
```

## Run the backend

PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

The API is available at `http://localhost:8000`, interactive documentation at `http://localhost:8000/docs`, and health status at `http://localhost:8000/health`.

An API key is **optional**. With `LLM_API_KEY=` left blank, the server returns deterministic mock responses grounded in the same retrieved evidence.

## Optional SiliconFlow / OpenAI-compatible configuration

Edit `backend/.env` (never commit it):

```dotenv
LLM_PROVIDER=siliconflow
LLM_API_KEY=your_key_here
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
EMBEDDING_MODEL=BAAI/bge-m3
RERANK_MODEL=BAAI/bge-reranker-v2-m3
```

`EMBEDDING_MODEL` and `RERANK_MODEL` are recorded for the next hybrid-search iteration. The current MVP intentionally uses the transparent local keyword retriever and therefore makes no embedding or reranking API calls.

Any provider exposing an OpenAI-compatible `POST /chat/completions` endpoint can be used by changing `LLM_BASE_URL` and `LLM_MODEL`. Provider errors or malformed model output automatically trigger the safe local fallback.

## Run the frontend

Open a second PowerShell window from the repository root:

```powershell
python -m http.server 5500
```

Then open `http://localhost:5500`, choose **Demo**, and use the selected **TCM** mode.

The default backend URL is `http://localhost:8000`. To point the static frontend elsewhere, set this before `app.js` loads:

```html
<script>window.MEDIRAG_API_BASE_URL = "https://your-api.example.com";</script>
```

If the backend is not running, the form shows a friendly connection message and the rest of the page continues to work.

## API contract

`POST /api/tcm/consult`

```json
{
  "question": "I often feel tired, have poor appetite and cold hands. What might this mean from a TCM perspective?",
  "context": {
    "age": "24",
    "gender": "",
    "duration": "3 months",
    "medications": "",
    "pregnancy": "no",
    "allergies": ""
  }
}
```

The response includes `generation_mode` (`mock`, `llm`, or `safety`), `generation_source`, `llm_model`, `llm_error`, and `urgent` in addition to the structured TCM fields. Evidence is always server-selected; the LLM cannot invent citation records.

Generation source values:

- `siliconflow_llm` means the OpenAI-compatible SiliconFlow call succeeded.
- `mock_fallback` means the backend used the local TCM knowledge base because `LLM_API_KEY` is missing or the provider/network call failed. In this case `llm_error` contains a short safe reason such as `LLM_API_KEY is missing`.
- `safety_rule` means an urgent safety rule bypassed TCM generation.

## Sample questions

- `I often feel tired, have poor appetite and cold hands. What might this mean from a TCM perspective?`
- `Stress makes me irritable and bloated, and I sigh often. How might TCM describe this pattern?`
- `I have poor sleep, vivid dreams and occasional palpitations. What TCM patterns could be considered?`
- `我有点失眠`
- `最近头痛，嗓子痒痒的`
- Safety test: `I have crushing chest pain and cannot breathe.`

The safety test should return `urgent: true`, no TCM pattern or formula suggestion, and immediate-care guidance.

## Tests

With the backend virtual environment active:

```powershell
cd backend
pytest -q
```

The tests cover health status, structured no-key fallback, friendly validation, emergency triage, medication-context safety notes, Chinese symptom retrieval, plain-text LLM preservation, and provider-failure fallback.

## MVP limitations

- The 21-entry knowledge base is a demo corpus, not a clinical reference database.
- Retrieval is lexical and deliberately inspectable; semantic embeddings and reranking are future work.
- Pattern differentiation normally requires a fuller history and qualified examination, including tongue and pulse findings where appropriate.
- Formula names are educational examples only. No dose, preparation, or treatment instruction is produced.
