import re
from typing import Iterable

def find_keyword_spans(text: str, keywords: Iterable[str]) -> tuple[list[str], list[dict]]:
    """
    Returns (hits, highlights).
    highlights: [{"start": int, "end": int, "label":"keyword", "text": "..."}]
    """
    hits: list[str] = []
    highlights: list[dict] = []

    for kw in keywords:
        if not kw:
            continue
        # word-ish match, case-insensitive
        pattern = re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE)
        for m in pattern.finditer(text):
            hits.append(kw.lower())
            highlights.append(
                {
                    "start": m.start(),
                    "end": m.end(),
                    "label": "keyword",
                    "text": text[m.start():m.end()],
                }
            )
    # unique hits, preserve first-seen order
    seen = set()
    uniq_hits = []
    for h in hits:
        if h not in seen:
            uniq_hits.append(h)
            seen.add(h)
    return uniq_hits, highlights


def compute_contribution(
    sentiment: str | None,
    emotion_labels: list[str] | None,
    confidence: float | None,
    keyword_hits: list[str],
    target_sentiment: str = "negative",
    target_emotions: set[str] | None = None,
) -> float:
    """
    Very simple weighted score for ranking evidence docs.
    """
    target_emotions = target_emotions or set()

    score = 0.0
    if sentiment == target_sentiment:
        score += 1.0
    if emotion_labels:
        score += 0.5 * len(set(emotion_labels) & target_emotions)
    score += 0.2 * len(keyword_hits)

    conf = confidence if confidence is not None else 0.5
    return float(score * (0.5 + conf))  # confidence multiplier