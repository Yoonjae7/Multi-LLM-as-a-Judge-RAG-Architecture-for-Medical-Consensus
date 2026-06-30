from __future__ import annotations

import re
from dataclasses import dataclass

from .knowledge_base import KNOWLEDGE_BASE, KnowledgeEntry


@dataclass(frozen=True)
class RetrievalResult:
    entry: KnowledgeEntry
    score: float
    matched_terms: tuple[str, ...]


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.casefold()).strip()


def _english_tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z][a-z-]{2,}", text.casefold()))


def retrieve(question: str, context_text: str = "", top_k: int = 4) -> list[RetrievalResult]:
    query = _normalise(f"{question} {context_text}")
    query_tokens = _english_tokens(query)
    ranked: list[RetrievalResult] = []

    for entry in KNOWLEDGE_BASE:
        matched_terms = tuple(term for term in entry.keywords if _normalise(term) in query)
        symptom_matches = tuple(symptom for symptom in entry.symptoms if _normalise(symptom) in query)
        entry_tokens = _english_tokens(" ".join(entry.keywords + entry.symptoms + (entry.topic,)))
        token_overlap = len(query_tokens & entry_tokens)

        raw_score = len(matched_terms) * 2.2 + len(symptom_matches) * 1.4 + token_overlap * 0.45
        denominator = max(4.5, min(10.0, len(query_tokens) * 0.75 + 4.0))
        score = min(1.0, raw_score / denominator)
        ranked.append(RetrievalResult(entry=entry, score=round(score, 3), matched_terms=matched_terms))

    ranked.sort(key=lambda item: (item.score, len(item.matched_terms)), reverse=True)
    return ranked[: max(1, min(top_k, 6))]


def analyse_query(results: list[RetrievalResult]) -> tuple[list[str], list[str]]:
    keywords: list[str] = []
    domains: list[str] = []
    for result in results:
        for term in result.matched_terms:
            if term not in keywords:
                keywords.append(term)
        for domain in result.entry.domains:
            if domain not in domains:
                domains.append(domain)
    return keywords[:10], domains[:6]

