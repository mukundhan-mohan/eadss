from __future__ import annotations

import math
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.db.models.gov_risk import GovRiskHistoricalRecord
from app.services.pdf_rag import embed_texts, rerank_chunks, retrieve_similar_chunks


SEVERITY_WEIGHTS = {
    "low": 0.22,
    "medium": 0.48,
    "high": 0.76,
    "critical": 0.92,
}

SECTOR_WEIGHTS = {
    "finance": 0.16,
    "healthcare": 0.16,
    "public sector": 0.14,
    "government": 0.14,
    "supply chain": 0.12,
    "procurement": 0.1,
    "technology": 0.09,
    "education": 0.08,
}

KEYWORD_WEIGHTS = {
    "failure": 0.08,
    "breach": 0.18,
    "repeated": 0.12,
    "access": 0.05,
    "supplier": 0.05,
    "onboarding": 0.04,
    "control": 0.07,
    "violation": 0.16,
    "outage": 0.12,
    "escalate": 0.08,
    "audit": 0.09,
    "governance": 0.09,
}

ACTION_BY_LEVEL = {
    "low": "Log the incident, monitor for recurrence, and confirm local control ownership.",
    "medium": "Assign the department owner, confirm control remediation, and review similar prior records.",
    "high": "Escalate to governance review, notify control owners, and validate remediation against policy evidence.",
    "critical": "Open immediate governance escalation, assign executive oversight, and begin formal incident response.",
}


@dataclass
class HistoricalMatch:
    record: GovRiskHistoricalRecord
    score: float


@dataclass
class GovRiskAnalysis:
    risk_level: str
    risk_score: float
    reason: str
    recommended_action: str
    policy_match: str | None
    evidence: list[dict]
    matched_record_count: int


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9']+", normalize_text(text).lower()))


def lexical_similarity(a: str, b: str) -> float:
    tokens_a = tokenize(a)
    tokens_b = tokenize(b)
    if not tokens_a or not tokens_b:
        return 0.0
    overlap = len(tokens_a & tokens_b)
    return overlap / math.sqrt(len(tokens_a) * len(tokens_b))


def cosine_similarity(a: list[float], b: list[float]) -> float:
    return float(sum(x * y for x, y in zip(a, b)))


def risk_level_from_score(score: float) -> str:
    if score >= 0.82:
        return "critical"
    if score >= 0.66:
        return "high"
    if score >= 0.42:
        return "medium"
    return "low"


def sector_weight(sector: str) -> float:
    lowered = sector.strip().lower()
    for label, weight in SECTOR_WEIGHTS.items():
        if label in lowered:
            return weight
    return 0.06


def keyword_weight(text: str) -> float:
    lowered = text.lower()
    score = 0.0
    for keyword, weight in KEYWORD_WEIGHTS.items():
        if keyword in lowered:
            score += weight
    return min(score, 0.26)


def find_historical_matches(
    db: Session,
    *,
    org_id: str,
    incident_text: str,
    sector: str,
    department: str,
    location: str | None,
    limit: int = 5,
) -> list[HistoricalMatch]:
    records = (
        db.query(GovRiskHistoricalRecord)
        .filter(GovRiskHistoricalRecord.org_id == org_id)
        .order_by(GovRiskHistoricalRecord.created_at.desc())
        .limit(50)
        .all()
    )
    if not records:
        return []

    semantic_inputs = [incident_text] + [record.summary for record in records]
    vectors = embed_texts(semantic_inputs)
    incident_vector = vectors[0]

    matches: list[HistoricalMatch] = []
    for index, record in enumerate(records, start=1):
        semantic_score = cosine_similarity(incident_vector, vectors[index])
        lexical_score = lexical_similarity(incident_text, record.summary)
        score = 0.65 * semantic_score + 0.35 * lexical_score

        if record.sector.strip().lower() == sector.strip().lower():
            score += 0.06
        if record.department and record.department.strip().lower() == department.strip().lower():
            score += 0.04
        if location and record.location and record.location.strip().lower() == location.strip().lower():
            score += 0.03

        if score >= 0.42:
            matches.append(HistoricalMatch(record=record, score=round(min(score, 0.99), 3)))

    matches.sort(key=lambda match: match.score, reverse=True)
    return matches[:limit]


def build_policy_evidence(db: Session, *, org_id: str, incident_text: str, top_k: int = 3) -> list[dict]:
    embedding = embed_texts([incident_text])[0]
    chunks = retrieve_similar_chunks(db, org_id=org_id, question_embedding=embedding, top_k=top_k)
    ranked = rerank_chunks(incident_text, chunks)[:top_k]
    evidence: list[dict] = []
    for row in ranked:
        evidence.append(
            {
                "document_id": row["document_id"],
                "document_title": row.get("document_title"),
                "page_number": int(row["page_number"]),
                "chunk_index": int(row["chunk_index"]),
                "score": round(float(row.get("boosted_score", row["score"])), 3),
                "excerpt": (row["text"][:360] + "...") if len(row["text"]) > 360 else row["text"],
            }
        )
    return evidence


def build_reason(
    *,
    severity: str,
    matched_records: list[HistoricalMatch],
    evidence: list[dict],
    incident_text: str,
) -> str:
    parts = [f"Base severity is {severity}."]
    if matched_records:
        parts.append(f"Found {len(matched_records)} similar historical risk record(s), indicating recurrence.")
    if evidence:
        first = evidence[0]
        source = first.get("document_title") or "policy documents"
        parts.append(
            f"Policy evidence aligns with {source}, page {first['page_number']}, which increases governance relevance."
        )
    keyword_hits = [keyword for keyword in KEYWORD_WEIGHTS if keyword in incident_text.lower()]
    if keyword_hits:
        parts.append(f"Risk language detected: {', '.join(sorted(keyword_hits[:4]))}.")
    return " ".join(parts)


def analyze_gov_risk(
    db: Session,
    *,
    org_id: str,
    incident_text: str,
    sector: str,
    department: str,
    severity: str,
    location: str | None,
) -> GovRiskAnalysis:
    evidence = build_policy_evidence(db, org_id=org_id, incident_text=incident_text, top_k=3)
    matches = find_historical_matches(
        db,
        org_id=org_id,
        incident_text=incident_text,
        sector=sector,
        department=department,
        location=location,
    )

    score = SEVERITY_WEIGHTS.get(severity, 0.4)
    score += sector_weight(sector)
    score += keyword_weight(incident_text)
    score += min(len(matches) * 0.08, 0.24)
    if evidence:
        score += 0.08
        score += min(max(evidence[0]["score"] - 0.45, 0.0) * 0.18, 0.12)

    risk_score = round(min(score, 0.99), 2)
    risk_level = risk_level_from_score(risk_score)
    recommended_action = ACTION_BY_LEVEL[risk_level]
    policy_match = None
    if evidence:
        top = evidence[0]
        title = top.get("document_title") or "Policy document"
        policy_match = f"{title} - Section near page {top['page_number']}"

    return GovRiskAnalysis(
        risk_level=risk_level,
        risk_score=risk_score,
        reason=build_reason(
            severity=severity,
            matched_records=matches,
            evidence=evidence,
            incident_text=incident_text,
        ),
        recommended_action=recommended_action,
        policy_match=policy_match,
        evidence=evidence,
        matched_record_count=len(matches),
    )
