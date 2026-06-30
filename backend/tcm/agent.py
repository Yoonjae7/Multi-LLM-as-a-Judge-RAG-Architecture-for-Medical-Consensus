from __future__ import annotations

from dataclasses import dataclass
import json
import os
import re
from typing import Any

import httpx

from .knowledge_base import FORMULA_WARNING
from .retriever import RetrievalResult, analyse_query, retrieve
from .safety import check_emergency
from .schemas import (
    Confidence,
    EvidenceChunk,
    PossiblePattern,
    QueryAnalysis,
    RelatedHerbOrFormula,
    TCMConsultRequest,
    TCMConsultResponse,
)


DISCLAIMER = (
    "For educational and research purposes only. This is not a medical diagnosis or a "
    "prescription and does not replace care from a qualified healthcare professional or "
    "licensed TCM practitioner. Do not start, stop, or change prescribed medicine based on this response."
)

BASE_SAFETY_NOTES = [
    "Do not stop or change prescribed medication without speaking with the prescribing clinician.",
    "Herbs and formulas can cause side effects and interact with medicines; product quality and correct identification also matter.",
    "Pregnancy or breastfeeding, allergies, liver or kidney disease, bleeding disorders, and planned surgery require individual professional review before any herbal product is used.",
]

ZH_EVIDENCE_SUMMARIES: dict[str, tuple[str, str]] = {
    "heart-blood-deficiency": ("心血不足", "本地证据提示：睡眠不安、多梦、心悸、健忘或面色偏淡时，中医辨证可能会考虑心血不足。"),
    "heart-yin-deficiency-insomnia": ("心阴不足", "本地证据提示：失眠若伴心烦、口干、盗汗或夜间烦热等表现，中医辨证可能会考虑心阴不足。"),
    "liver-yang-rising-headache": ("肝阳上亢", "本地证据提示：头痛若伴头晕、烦躁、面部发热或上冲感，中医辨证可能会考虑肝阳上亢。"),
    "wind-dryness-lung-throat": ("风燥犯肺", "本地证据提示：嗓子痒、咽干、干咳或少痰时，中医辨证可能会考虑风燥犯肺。"),
    "wind-heat": ("风热外袭", "本地证据提示：发热、咽部不适、口渴、咳嗽或黄痰等表现，中医辨证可能会考虑风热外袭。"),
    "liver-fire-rising": ("肝火上扰", "本地证据提示：头部发热、头痛、口苦、烦躁或咽部不适等热象明显时，中医辨证可能会考虑肝火上扰。"),
    "food-stagnation": ("食积或胃失和降", "本地证据提示：腹胀、嗳气、反酸、口臭或进食后不适时，中医辨证可能会考虑食积或胃失和降。"),
    "spleen-dampness": ("湿困脾胃", "本地证据提示：身体困重、腹胀、大便黏滞或食欲下降时，中医辨证可能会考虑湿困脾胃。"),
    "liver-spleen-disharmony": ("肝郁脾虚", "本地证据提示：压力大、腹胀、胃口不好、情绪紧张和消化波动同时出现时，中医辨证可能会考虑肝郁脾虚。"),
    "spleen-qi-deficiency": ("脾气不足", "本地证据提示：乏力、胃口不好、腹胀、便溏等表现同时出现时，中医辨证可能会考虑脾气不足。"),
    "liver-qi-stagnation": ("肝气郁结", "本地证据提示：压力大、情绪不舒、胸胁或腹部胀满、叹气等表现同时出现时，中医辨证可能会考虑肝气郁结。"),
}


@dataclass(frozen=True)
class LLMGeneration:
    raw_content: str
    parsed_json: dict[str, Any] | None
    model: str


class LLMProviderError(Exception):
    """A safe, user-displayable provider error with no secrets attached."""


def _context_text(request: TCMConsultRequest) -> str:
    return " ".join(
        value
        for value in request.context.model_dump().values()
        if isinstance(value, str) and value.strip()
    )


def _evidence(results: list[RetrievalResult]) -> list[EvidenceChunk]:
    return [
        EvidenceChunk(
            source=result.entry.source,
            title=result.entry.topic,
            source_type=result.entry.source_type,
            snippet=result.entry.snippet,
            relevance_score=result.score,
        )
        for result in results
    ]


def _confidence(results: list[RetrievalResult]) -> Confidence:
    best = results[0].score if results else 0.0
    supporting = sum(1 for result in results if result.score >= 0.25)
    score = min(0.86, 0.28 + best * 0.5 + min(supporting, 3) * 0.05)
    score = round(score, 2)
    if score >= 0.72:
        level = "high"
    elif score >= 0.48:
        level = "medium"
    else:
        level = "low"
    reason = (
        f"Keyword retrieval found {supporting} meaningfully matching local evidence "
        f"chunk(s); the strongest relevance score was {best:.2f}. Pattern differentiation "
        "still requires history, tongue/pulse findings, examination, and clinical judgment."
    )
    return Confidence(level=level, score=score, reason=reason)


def _safety_notes(request: TCMConsultRequest, results: list[RetrievalResult]) -> list[str]:
    notes = list(BASE_SAFETY_NOTES)
    if request.context.medications.strip():
        notes.append("Because current medication was reported, a pharmacist or clinician should check every proposed herb/formula for interactions.")
    if request.context.pregnancy.strip() and request.context.pregnancy.casefold() not in {"no", "not pregnant", "n/a"}:
        notes.append("Pregnancy status was reported; do not use the listed herbal examples without obstetric and qualified TCM review.")
    if request.context.allergies.strip():
        notes.append("Allergies were reported; verify every ingredient and excipient with a pharmacist or qualified practitioner.")
    for result in results:
        for note in result.entry.safety_notes:
            if note not in notes:
                notes.append(note)
    return notes[:8]


def _mock_content(results: list[RetrievalResult]) -> tuple[str, list[PossiblePattern], list[RelatedHerbOrFormula]]:
    meaningful = [result for result in results if result.score >= 0.2]
    selected = meaningful[:3]
    pattern_names = [result.entry.pattern for result in selected]
    if meaningful:
        perspective = (
            "From a TCM educational perspective, the reported features overlap most with "
            + ", ".join(pattern_names)
            + ". These are hypotheses for pattern differentiation, not diagnoses. A practitioner would also ask about onset, aggravating factors, sleep, appetite, bowel/urinary changes, and examine the tongue and pulse before drawing a conclusion."
        )
    else:
        return (
            "The small demonstration knowledge base did not find a strong symptom match. "
            "A safe TCM interpretation would require more detail and an in-person assessment; no pattern should be inferred from the current information alone."
        ), [], []

    patterns = [
        PossiblePattern(
            pattern=result.entry.pattern,
            rationale=result.entry.rationale,
            matching_symptoms=list(result.matched_terms) or list(result.entry.symptoms[:2]),
        )
        for result in selected
    ]

    formula_items: list[RelatedHerbOrFormula] = []
    seen: set[str] = set()
    for result in selected:
        for formula in result.entry.formulas:
            if formula["name"] in seen:
                continue
            seen.add(formula["name"])
            formula_items.append(
                RelatedHerbOrFormula(
                    name=formula["name"],
                    type=formula["type"],
                    purpose=formula["purpose"],
                    safety_warning=FORMULA_WARNING,
                )
            )
    return perspective, patterns, formula_items[:4]


def _contains_cjk(text: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", text))


def _format_evidence_for_prompt(results: list[RetrievalResult], *, chinese: bool = False) -> str:
    meaningful_results = [item for item in results if item.score >= 0.2]
    if not meaningful_results:
        return "本地中医知识库没有检索到强匹配证据。" if chinese else "No strong local TCM evidence match was retrieved."

    lines: list[str] = []
    for index, item in enumerate(meaningful_results[:4], start=1):
        matched = ", ".join(item.matched_terms) or "general overlap"
        if chinese:
            pattern, note = ZH_EVIDENCE_SUMMARIES.get(
                item.entry.entry_id,
                ("中医辨证候选方向", "本地证据提示：该条目与用户描述存在一定重合，但仍需更多问诊信息和舌脉资料。"),
            )
            lines.append(f"{index}. 可能方向：{pattern}\n   匹配词：{matched}\n   本地证据：{note}")
        else:
            lines.append(
                f"{index}. Pattern: {item.entry.pattern}\n"
                f"   Matched terms: {matched}\n"
                f"   Rationale: {item.entry.rationale}\n"
                f"   Evidence note: {item.entry.snippet}"
            )
    return "\n".join(lines)


class OpenAICompatibleClient:
    def __init__(self) -> None:
        self.provider = os.getenv("LLM_PROVIDER", "siliconflow").strip() or "siliconflow"
        self.api_key = os.getenv("LLM_API_KEY", "").strip()
        self.base_url = os.getenv("LLM_BASE_URL", "https://api.siliconflow.cn/v1").rstrip("/")
        self.model = os.getenv("LLM_MODEL", "Qwen/Qwen2.5-7B-Instruct").strip()
        self.timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
        self.max_tokens = int(os.getenv("LLM_MAX_TOKENS", "900"))

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.base_url and self.model)

    async def _post_chat(self, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            if response.status_code in {400, 422} and "response_format" in payload:
                retry_payload = dict(payload)
                retry_payload.pop("response_format", None)
                response = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=retry_payload)
            response.raise_for_status()
        try:
            data = response.json()
        except ValueError as exc:
            raise LLMProviderError("LLM provider returned an unreadable response") from exc
        if not isinstance(data, dict):
            raise LLMProviderError("LLM provider returned an unexpected response")
        return data

    async def generate(self, request: TCMConsultRequest, results: list[RetrievalResult]) -> LLMGeneration:
        chinese = _contains_cjk(request.question)
        context_payload = {
            key: value
            for key, value in request.context.model_dump().items()
            if isinstance(value, str) and value.strip()
        }
        if chinese:
            system_prompt = (
                "你是一个研究原型中的中医视角生成组件。只能依据下面的本地检索证据回答。"
                "必须使用自然、流畅、完整的现代中文；不要夹杂英文单词、拼音、代码、JSON、表格或项目符号。"
                "不要写“TCM”“CM”“pattern”“hypothesis”“formula”“herb”等英文标签。"
                "语气要谨慎，说明只是辨证方向，不是诊断。不要开处方，不要给剂量，不要建议服用或停用任何药物。"
                "不要提具体草药名或方剂名；界面会在单独区域展示本地库中的教育性示例和安全提示。"
            )
            user_prompt = (
                f"用户问题：\n{request.question}\n\n"
                f"可选背景：\n{json.dumps(context_payload or {'未提供': '无'}, ensure_ascii=False)}\n\n"
                f"本地检索证据：\n{_format_evidence_for_prompt(results, chinese=True)}\n\n"
                "请写一段 3 到 5 句的中文中医视角摘要。"
                "第一句说明“基于本地检索证据”。"
                "只讨论可能的辨证方向和还需要补充了解的信息，例如起病时间、寒热、口渴、睡眠、饮食、二便、舌象和脉象。"
                "不要输出方剂名、草药名、剂量、治疗方案或处方建议。"
            )
        else:
            system_prompt = (
                "You are the TCM perspective component of a research-only RAG demo. "
                "Use only the retrieved local TCM evidence below. Return plain text only: no JSON, no code fences, no tables. "
                "Respond in the same language as the user's question when possible. Keep the answer concise, readable, and uncertainty-aware. "
                "Do not diagnose, prescribe, give doses, claim proven efficacy, or advise changing medication. "
                "Do not mention herb or formula names; the interface displays local educational examples separately with safety warnings. "
                "If the evidence says there is no strong match, say that more clinical context and tongue/pulse assessment would be needed."
            )
            user_prompt = (
                f"Question:\n{request.question}\n\n"
                f"Optional context:\n{json.dumps(context_payload or {'provided': 'none'}, ensure_ascii=False)}\n\n"
                f"Retrieved local TCM evidence:\n{_format_evidence_for_prompt(results)}\n\n"
                "Write one short educational TCM perspective paragraph. Mention that these are pattern hypotheses, not a diagnosis. "
                "Add one sentence saying the LLM answer is grounded by local retrieved evidence. "
                "Do not list formula names, herbs, doses, or treatment instructions."
            )
        payload = {
            "model": self.model,
            "temperature": 0.1,
            "max_tokens": self.max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        try:
            response_data = await self._post_chat(payload, headers)
        except httpx.TimeoutException as exc:
            raise LLMProviderError("LLM provider request timed out") from exc
        except httpx.HTTPStatusError as exc:
            raise LLMProviderError(f"LLM provider returned HTTP {exc.response.status_code}") from exc
        except httpx.RequestError as exc:
            raise LLMProviderError("Network error while contacting LLM provider") from exc

        try:
            content = response_data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMProviderError("LLM provider returned an unexpected response") from exc
        if not isinstance(content, str) or not content.strip():
            raise LLMProviderError("LLM provider returned an empty response")
        raw_content = content.strip()
        return LLMGeneration(raw_content=raw_content, parsed_json=_parse_json_object(raw_content), model=self.model)


def _parse_json_object(content: str) -> dict[str, Any] | None:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    candidates = [text]
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def _validated_llm_content(content: dict[str, Any], *, chinese: bool = False) -> tuple[str, list[PossiblePattern], list[RelatedHerbOrFormula]]:
    perspective = _clean_llm_text(str(content.get("tcm_perspective", "")).strip(), chinese=chinese)
    if not perspective:
        raise ValueError("LLM response did not include tcm_perspective")
    patterns = [PossiblePattern.model_validate(item) for item in content.get("possible_patterns", [])[:3]]
    formulas: list[RelatedHerbOrFormula] = []
    for item in content.get("related_herbs_or_formulas", [])[:4]:
        validated = RelatedHerbOrFormula.model_validate(item)
        validated.safety_warning = FORMULA_WARNING
        formulas.append(validated)
    return perspective, patterns, formulas


def _plain_text_llm_content(raw_content: str, results: list[RetrievalResult], *, chinese: bool = False) -> tuple[str, list[PossiblePattern], list[RelatedHerbOrFormula]]:
    _, patterns, formulas = _mock_content(results)
    perspective = _clean_llm_text(_extract_tcm_perspective(raw_content) or raw_content.strip(), chinese=chinese)
    return perspective, patterns, formulas


def _clean_llm_text(text: str, *, chinese: bool = False) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    cleaned = cleaned.replace("\ufffd", "")
    cleaned = re.sub(r"(?<![A-Za-z])G(?=[\s\u4e00-\u9fff，。；、,.!?])", "", cleaned)
    cleaned = re.sub(r"(?:\s+[A-Za-z]){8,}.*$", "", cleaned).strip()
    cleaned = re.sub(r"([\u4e00-\u9fff])\1+", r"\1", cleaned)
    cleaned = re.sub(r"\s+([，。；、,.!?])", r"\1", cleaned)
    if chinese:
        cleaned = cleaned.replace("Traditional Chinese Medicine", "中医")
        cleaned = cleaned.replace("TCM", "中医").replace("CM", "中医")
        replacements = {
            "Traditional Chinese Medicine": "中医",
            "TCM perspective": "中医视角",
            "TCM": "中医",
            "CM": "中医",
            "pattern hypotheses": "辨证方向",
            "pattern hypothesis": "辨证方向",
            "hypotheses": "可能方向",
            "hypothesis": "可能方向",
            "patterns": "证型",
            "pattern": "证型",
            "formula": "方剂",
            "formulas": "方剂",
            "herbs": "草药",
            "herb": "草药",
            "diagnosis": "诊断",
            "two": "两个",
            "one": "一个",
        }
        for old, new in replacements.items():
            cleaned = re.sub(rf"\b{re.escape(old)}\b", new, cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\b[A-Za-z][A-Za-z-]{1,}\b", "", cleaned)
        cleaned = re.sub(r"\s*([，。；、,.!?])\s*", r"\1", cleaned)
        cleaned = re.sub(r"([，。；、,.!?])\1+", r"\1", cleaned)
        cleaned = re.sub(r"([\u4e00-\u9fff])\s+([\u4e00-\u9fff])", r"\1\2", cleaned)
        cleaned = cleaned.replace("等以及", "以及").replace("等信息等", "等信息")
        cleaned = cleaned.replace("等可以更准确地辨证", "等信息，才能更准确地辨证")
        cleaned = cleaned.replace("以更准确地辨证分。", "以更准确地辨证。")
        cleaned = cleaned.replace("更准确地辨证分。", "更准确地辨证。")
        if cleaned and cleaned[-1] not in "。！？!?":
            cleaned += "。"
    cleaned = re.sub(r"\s+([，。；、,.!?])", r"\1", cleaned)
    cleaned = re.sub(r"([，。；、,.!?])\1+", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


def _extract_tcm_perspective(raw_content: str) -> str | None:
    parsed = _parse_json_object(raw_content)
    if parsed is not None:
        value = str(parsed.get("tcm_perspective", "")).strip()
        if value:
            return value

    match = re.search(r'"tcm_perspective"\s*:\s*"((?:\\.|[^"\\])*)"', raw_content, flags=re.DOTALL)
    if not match:
        return None
    try:
        decoded = json.loads(f'"{match.group(1)}"')
    except json.JSONDecodeError:
        decoded = match.group(1).replace('\\"', '"').replace("\\n", "\n")
    return decoded.strip() or None


def _urgent_response(request: TCMConsultRequest, reason: str, immediate: bool) -> TCMConsultResponse:
    if immediate:
        guidance = (
            "Seek urgent medical help now: call your local emergency number or go to the nearest emergency department. "
            "If there is immediate danger, do not remain alone and do not drive yourself."
        )
    else:
        guidance = (
            "Please contact the clinician or specialist responsible for your care promptly. "
            "TCM information may only be considered as a complementary discussion after the condition and any treatment interactions are professionally reviewed."
        )
    return TCMConsultResponse(
        generation_mode="safety",
        generation_source="safety_rule",
        llm_model=os.getenv("LLM_MODEL", "Qwen/Qwen2.5-7B-Instruct").strip(),
        llm_error=None,
        urgent=True,
        query_analysis=QueryAnalysis(keywords=[reason], possible_domains=["emergency triage"]),
        tcm_perspective=(
            f"This question contains signs of {reason}. Do not wait for a TCM pattern interpretation. "
            + guidance
        ),
        possible_patterns=[],
        related_herbs_or_formulas=[],
        evidence=[],
        safety_notes=[
            "Urgent biomedical assessment takes priority over online or traditional-medicine guidance.",
            "Do not take a new herb, supplement, food, or medicine in an attempt to manage this emergency unless emergency professionals direct you.",
        ],
        confidence=Confidence(level="high", score=0.99, reason=f"The safety rule matched wording associated with {reason}."),
        disclaimer=DISCLAIMER,
    )


async def consult(request: TCMConsultRequest) -> TCMConsultResponse:
    safety = check_emergency(f"{request.question} {_context_text(request)}")
    if safety.urgent:
        return _urgent_response(request, safety.reason, safety.immediate)

    results = retrieve(request.question, _context_text(request), top_k=4)
    keywords, domains = analyse_query(results)
    client = OpenAICompatibleClient()
    chinese = _contains_cjk(request.question)
    generation_mode = "mock"
    generation_source = "mock_fallback"
    llm_error: str | None = None
    llm_model = client.model

    if client.configured:
        try:
            generation = await client.generate(request, results)
            if generation.parsed_json is not None:
                try:
                    perspective, patterns, formulas = _validated_llm_content(generation.parsed_json, chinese=chinese)
                except (TypeError, ValueError):
                    perspective, patterns, formulas = _plain_text_llm_content(generation.raw_content, results, chinese=chinese)
            else:
                perspective, patterns, formulas = _plain_text_llm_content(generation.raw_content, results, chinese=chinese)
            generation_mode = "llm"
            generation_source = "siliconflow_llm"
            llm_model = generation.model
        except LLMProviderError as exc:
            llm_error = str(exc)
            perspective, patterns, formulas = _mock_content(results)
    else:
        llm_error = "LLM_API_KEY is missing"
        perspective, patterns, formulas = _mock_content(results)

    return TCMConsultResponse(
        generation_mode=generation_mode,
        generation_source=generation_source,
        llm_model=llm_model,
        llm_error=llm_error,
        query_analysis=QueryAnalysis(keywords=keywords, possible_domains=domains),
        tcm_perspective=perspective,
        possible_patterns=patterns,
        related_herbs_or_formulas=formulas,
        evidence=_evidence(results),
        safety_notes=_safety_notes(request, results),
        confidence=_confidence(results),
        disclaimer=DISCLAIMER,
    )
