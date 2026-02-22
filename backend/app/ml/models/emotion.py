import re
from dataclasses import dataclass

@dataclass(frozen=True)
class EmotionResult:
    sentiment: str
    emotion_labels: list[str]
    calibrated_confidence: float

_NEG_WORDS = {"hopeless", "exhausted", "furious", "angry", "sad", "depressed", "tired", "upset", "anxious", "afraid"}
_POS_WORDS = {"happy", "joy", "excited", "great", "love", "relieved", "calm"}

def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z']+", text.lower()))

def predict_emotion(text: str) -> EmotionResult:
    toks = _tokenize(text)

    neg_hits = len(_NEG_WORDS & toks)
    pos_hits = len(_POS_WORDS & toks)

    labels: list[str] = []
    if "furious" in toks or "angry" in toks:
        labels.append("anger")
    if "hopeless" in toks or "sad" in toks or "depressed" in toks:
        labels.append("sadness")
    if "anxious" in toks or "afraid" in toks:
        labels.append("fear")
    if "exhausted" in toks or "tired" in toks:
        labels.append("fatigue")
    if "happy" in toks or "joy" in toks or "excited" in toks:
        labels.append("joy")

    # sentiment + confidence (simple calibration)
    if neg_hits > pos_hits:
        sentiment = "negative"
        confidence = min(0.95, 0.55 + 0.10 * neg_hits)
    elif pos_hits > neg_hits:
        sentiment = "positive"
        confidence = min(0.95, 0.55 + 0.10 * pos_hits)
    else:
        sentiment = "neutral"
        confidence = 0.55

    if not labels:
        labels = ["neutral"]

    return EmotionResult(sentiment=sentiment, emotion_labels=labels, calibrated_confidence=float(confidence))