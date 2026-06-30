import os

import pytest

os.environ["LLM_API_KEY"] = ""

from fastapi.testclient import TestClient

from main import app
from tcm import agent


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "TCM-RAG"


def test_consult_returns_structured_mock_response_without_api_key() -> None:
    response = client.post(
        "/api/tcm/consult",
        json={
            "question": "I often feel tired, have poor appetite and cold hands. What might this mean from a TCM perspective?",
            "context": {"age": "24", "gender": "", "duration": "3 months", "medications": "", "pregnancy": "no", "allergies": ""},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "TCM-RAG"
    assert data["generation_mode"] == "mock"
    assert data["generation_source"] == "mock_fallback"
    assert data["llm_error"] == "LLM_API_KEY is missing"
    assert data["llm_model"]
    assert data["possible_patterns"]
    assert all("Wind-cold" not in item["pattern"] for item in data["possible_patterns"])
    assert all("Heart blood" not in item["pattern"] for item in data["possible_patterns"])
    assert len(data["evidence"]) == 4
    assert "diagnosis" in data["disclaimer"].lower()


def test_empty_question_has_friendly_validation_error() -> None:
    response = client.post("/api/tcm/consult", json={"question": "", "context": {}})
    assert response.status_code == 422
    assert "health question" in response.json()["detail"].lower()


def test_emergency_question_bypasses_tcm_generation() -> None:
    response = client.post(
        "/api/tcm/consult",
        json={"question": "I have crushing chest pain and cannot breathe", "context": {}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["urgent"] is True
    assert data["generation_mode"] == "safety"
    assert data["generation_source"] == "safety_rule"
    assert data["llm_error"] is None
    assert data["possible_patterns"] == []
    assert data["related_herbs_or_formulas"] == []
    assert "urgent" in data["tcm_perspective"].lower()


def test_context_adds_medication_safety_note() -> None:
    response = client.post(
        "/api/tcm/consult",
        json={"question": "I have poor sleep and feel tired", "context": {"medications": "warfarin"}},
    )
    assert response.status_code == 200
    assert any("medication" in note.lower() for note in response.json()["safety_notes"])


def test_unknown_query_does_not_offer_unmatched_formulas() -> None:
    response = client.post(
        "/api/tcm/consult",
        json={"question": "What does this prototype do?", "context": {}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["possible_patterns"] == []
    assert data["related_herbs_or_formulas"] == []


def test_serious_condition_uses_clinician_first_response() -> None:
    response = client.post(
        "/api/tcm/consult",
        json={"question": "Can TCM cure my cancer?", "context": {}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["urgent"] is True
    assert data["generation_mode"] == "safety"
    assert data["generation_source"] == "safety_rule"
    assert "clinician" in data["tcm_perspective"].lower()
    assert data["related_herbs_or_formulas"] == []


@pytest.mark.parametrize("question", ["我有点失眠", "最近头痛，嗓子痒痒的"])
def test_common_chinese_symptoms_retrieve_local_evidence(question: str) -> None:
    response = client.post("/api/tcm/consult", json={"question": question, "context": {}})
    assert response.status_code == 200
    data = response.json()
    assert data["generation_source"] == "mock_fallback"
    assert data["llm_error"] == "LLM_API_KEY is missing"
    assert data["evidence"]
    assert any(chunk["relevance_score"] > 0 for chunk in data["evidence"])


def test_plain_text_llm_response_is_preserved(monkeypatch: pytest.MonkeyPatch) -> None:
    class DummyClient:
        model = "Qwen/Qwen2.5-7B-Instruct"

        @property
        def configured(self) -> bool:
            return True

        async def generate(self, request, results):
            return agent.LLMGeneration(
                raw_content="SiliconFlow plain text answer for insomnia.",
                parsed_json=None,
                model=self.model,
            )

    monkeypatch.setattr(agent, "OpenAICompatibleClient", DummyClient)

    response = client.post("/api/tcm/consult", json={"question": "I have trouble sleeping", "context": {}})
    assert response.status_code == 200
    data = response.json()
    assert data["generation_mode"] == "llm"
    assert data["generation_source"] == "siliconflow_llm"
    assert data["llm_model"] == "Qwen/Qwen2.5-7B-Instruct"
    assert data["llm_error"] is None
    assert data["tcm_perspective"] == "SiliconFlow plain text answer for insomnia."


def test_llm_provider_failure_falls_back_with_safe_error(monkeypatch: pytest.MonkeyPatch) -> None:
    class FailingClient:
        model = "Qwen/Qwen2.5-7B-Instruct"

        @property
        def configured(self) -> bool:
            return True

        async def generate(self, request, results):
            raise agent.LLMProviderError("Network error while contacting LLM provider")

    monkeypatch.setattr(agent, "OpenAICompatibleClient", FailingClient)

    response = client.post("/api/tcm/consult", json={"question": "最近头痛，嗓子痒痒的", "context": {}})
    assert response.status_code == 200
    data = response.json()
    assert data["generation_mode"] == "mock"
    assert data["generation_source"] == "mock_fallback"
    assert data["llm_error"] == "Network error while contacting LLM provider"
    assert data["possible_patterns"]


def test_chinese_llm_cleanup_removes_mixed_english_fragments() -> None:
    text = "主要CM 认为 this is two pattern hypotheses. TCM perspective: 可能和失眠有关 G G G。"
    cleaned = agent._clean_llm_text(text, chinese=True)
    assert "CM" not in cleaned
    assert "TCM" not in cleaned
    assert "hypotheses" not in cleaned
    assert "pattern" not in cleaned
    assert "主要中医" in cleaned
