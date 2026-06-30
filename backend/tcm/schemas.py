from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class UserContext(BaseModel):
    age: str = Field(default="", max_length=40)
    gender: str = Field(default="", max_length=80)
    duration: str = Field(default="", max_length=160)
    medications: str = Field(default="", max_length=500)
    pregnancy: str = Field(default="", max_length=80)
    allergies: str = Field(default="", max_length=500)


class TCMConsultRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    context: UserContext = Field(default_factory=UserContext)

    @field_validator("question")
    @classmethod
    def question_must_contain_text(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Please enter a health question of at least 3 characters.")
        return value


class QueryAnalysis(BaseModel):
    keywords: list[str]
    possible_domains: list[str]


class PossiblePattern(BaseModel):
    pattern: str
    rationale: str
    matching_symptoms: list[str]


class RelatedHerbOrFormula(BaseModel):
    name: str
    type: Literal["herb", "formula"]
    purpose: str
    safety_warning: str


class EvidenceChunk(BaseModel):
    source: str
    title: str
    source_type: str
    snippet: str
    relevance_score: float = Field(ge=0, le=1)


class Confidence(BaseModel):
    level: Literal["low", "medium", "high"]
    score: float = Field(ge=0, le=1)
    reason: str


class TCMConsultResponse(BaseModel):
    mode: Literal["TCM-RAG"] = "TCM-RAG"
    generation_mode: Literal["mock", "llm", "safety"]
    generation_source: Literal["siliconflow_llm", "mock_fallback", "safety_rule"]
    llm_model: str
    llm_error: str | None = None
    urgent: bool = False
    query_analysis: QueryAnalysis
    tcm_perspective: str
    possible_patterns: list[PossiblePattern]
    related_herbs_or_formulas: list[RelatedHerbOrFormula]
    evidence: list[EvidenceChunk]
    safety_notes: list[str]
    confidence: Confidence
    disclaimer: str
