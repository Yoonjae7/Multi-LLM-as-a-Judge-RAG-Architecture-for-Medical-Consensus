from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SafetyMatch:
    urgent: bool
    reason: str = ""
    immediate: bool = False


EMERGENCY_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("possible heart or breathing emergency", ("chest pain", "crushing chest", "can't breathe", "cannot breathe", "blue lips", "胸痛", "胸口剧痛", "呼吸困难", "嘴唇发紫")),
    ("possible stroke or acute neurological emergency", ("stroke", "face droop", "slurred speech", "one-sided weakness", "sudden paralysis", "中风", "口角歪斜", "言语不清", "单侧无力", "突然瘫痪")),
    ("severe bleeding", ("severe bleeding", "won't stop bleeding", "vomiting blood", "black stool", "大量出血", "止不住血", "呕血", "黑便")),
    ("poisoning or overdose", ("poisoning", "overdose", "swallowed poison", "toxic dose", "中毒", "药物过量", "误服毒物")),
    ("risk of self-harm", ("suicide", "kill myself", "end my life", "self-harm", "hurt myself", "自杀", "轻生", "结束生命", "自残")),
    ("loss of consciousness or seizure", ("unconscious", "not waking", "seizure", "convulsion", "昏迷", "叫不醒", "抽搐", "癫痫发作")),
    ("pregnancy emergency", ("pregnant and bleeding", "pregnancy severe pain", "ectopic", "怀孕出血", "孕期剧痛", "宫外孕")),
)

SERIOUS_CONDITION_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("a serious condition that needs clinician-led care", ("cancer", "malignant tumor", "heart failure", "kidney failure", "liver failure", "癌症", "恶性肿瘤", "心力衰竭", "肾衰竭", "肝衰竭")),
)


def check_emergency(text: str) -> SafetyMatch:
    normalised = text.casefold()
    for reason, phrases in EMERGENCY_GROUPS:
        if any(phrase in normalised for phrase in phrases):
            return SafetyMatch(urgent=True, reason=reason, immediate=True)
    for reason, phrases in SERIOUS_CONDITION_GROUPS:
        if any(phrase in normalised for phrase in phrases):
            return SafetyMatch(urgent=True, reason=reason, immediate=False)
    return SafetyMatch(urgent=False)
