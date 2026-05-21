from __future__ import annotations

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.models.pdf_chunk import EMBEDDING_DIMENSION


PDF_EMBEDDING_MODEL = os.getenv("PDF_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
PDF_UPLOAD_DIR = os.getenv("PDF_UPLOAD_DIR", "/app/data/pdf_uploads")
PDF_CHUNK_WORDS = int(os.getenv("PDF_CHUNK_WORDS", "180"))
PDF_CHUNK_OVERLAP_WORDS = int(os.getenv("PDF_CHUNK_OVERLAP_WORDS", "30"))

REQUIREMENT_QUERY_TERMS = {
    "requirement", "requirements", "required", "qualification", "qualifications",
    "experience", "skills", "skill", "criteria", "essential", "desirable",
    "job description", "job", "responsibilities", "responsibility", "person specification",
}

REQUIREMENT_TEXT_TERMS = {
    "person specification", "essential", "desirable", "education", "qualifications",
    "qualification", "experience", "skills", "skill", "requirements", "required",
    "responsibilities", "responsibility", "knowledge", "criteria", "competencies",
    "masters degree", "bachelor", "degree", "proficiency", "demonstrable experience",
}

SUMMARY_QUERY_TERMS = {
    "about", "summary", "summarize", "overview", "what is this", "what does", "policy",
}


@dataclass
class ChunkCandidate:
    page_number: int
    chunk_index: int
    text: str


def ensure_upload_dir() -> Path:
    root = Path(PDF_UPLOAD_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def split_sentences(text: str) -> list[str]:
    sentences = [normalize_text(part) for part in re.split(r"(?<=[.!?])\s+", text)]
    return [sentence for sentence in sentences if sentence]


def extract_pdf_pages(path: str) -> list[tuple[int, str]]:
    reader = PdfReader(path)
    pages: list[tuple[int, str]] = []
    for index, page in enumerate(reader.pages, start=1):
        pages.append((index, normalize_text(page.extract_text() or "")))
    return pages


def chunk_page_text(page_number: int, text: str, start_index: int = 0) -> list[ChunkCandidate]:
    words = text.split()
    if not words:
        return []

    chunk_size = max(50, PDF_CHUNK_WORDS)
    overlap = max(0, min(PDF_CHUNK_OVERLAP_WORDS, chunk_size - 1))

    chunks: list[ChunkCandidate] = []
    cursor = 0
    chunk_index = start_index

    while cursor < len(words):
        slice_words = words[cursor:cursor + chunk_size]
        chunk_text = " ".join(slice_words).strip()
        if chunk_text:
            chunks.append(ChunkCandidate(page_number=page_number, chunk_index=chunk_index, text=chunk_text))
            chunk_index += 1
        if cursor + chunk_size >= len(words):
            break
        cursor += chunk_size - overlap

    return chunks


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    model = SentenceTransformer(PDF_EMBEDDING_MODEL)
    dim = int(model.get_sentence_embedding_dimension())
    if dim != EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"Embedding dimension mismatch: model {PDF_EMBEDDING_MODEL} returned {dim}, "
            f"expected {EMBEDDING_DIMENSION}"
        )
    return model


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    vectors = get_embedding_model().encode(
        texts,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    return [vector.tolist() for vector in vectors]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    return float(sum(x * y for x, y in zip(a, b)))


def tokenize_query(text: str) -> set[str]:
    lowered = text.lower()
    grams = set(re.findall(r"[a-z0-9']+", lowered))
    phrases = {
        "job description",
        "person specification",
        "what does",
    }
    for phrase in phrases:
        if phrase in lowered:
            grams.add(phrase)
    return grams


def is_requirement_query(question: str) -> bool:
    terms = tokenize_query(question)
    return any(term in terms for term in REQUIREMENT_QUERY_TERMS)


def is_summary_query(question: str) -> bool:
    lowered = question.lower()
    return any(term in lowered for term in SUMMARY_QUERY_TERMS)


def requirement_boost_score(text: str) -> float:
    lowered = text.lower()
    score = 0.0
    for term in REQUIREMENT_TEXT_TERMS:
        if term in lowered:
            score += 0.12 if len(term.split()) > 1 else 0.08
    if "application form" in lowered or "how to apply" in lowered:
        score -= 0.08
    if "data protection" in lowered or "equal opportunities" in lowered:
        score -= 0.08
    return score


def relevance_score(question: str, text: str, semantic_score: float) -> float:
    score = semantic_score
    lowered = text.lower()

    if is_requirement_query(question):
        score += requirement_boost_score(text)

    if is_summary_query(question):
        if "program" in lowered or "policy" in lowered or "overview" in lowered:
            score += 0.06

    if "how to apply" in lowered:
        score -= 0.06

    return score


def clean_sentence(text: str) -> str:
    return normalize_text(text).strip("• ").strip()


def looks_like_noise(text: str) -> bool:
    lowered = text.lower()
    if len(lowered) < 30:
        return True
    noise_markers = [
        "how to apply",
        "data protection",
        "equal opportunities",
        "important notices",
        "for full details",
    ]
    return any(marker in lowered for marker in noise_markers)


def rerank_chunks(question: str, chunks: list[dict]) -> list[dict]:
    ranked = []
    for chunk in chunks:
        score = relevance_score(question, chunk["text"], float(chunk.get("score", 0.0)))
        enriched = dict(chunk)
        enriched["boosted_score"] = score
        ranked.append((score, enriched))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _score, chunk in ranked]


def select_best_chunks(question: str, chunks: list[dict], limit: int = 3) -> list[dict]:
    return rerank_chunks(question, chunks)[:limit]


def summarize_requirement_chunk(text: str) -> str:
    cleaned = clean_sentence(text)
    bullets = [part.strip("• ").strip() for part in re.split(r"\s+•\s+|•", cleaned) if part.strip()]
    useful = []
    for bullet in bullets:
        sentence = clean_sentence(bullet)
        if len(sentence) < 20:
            continue
        if looks_like_noise(sentence):
            continue
        if any(marker in sentence.lower() for marker in [
            "application form and interview",
            "salary scales",
            "benefits and rewards",
            "working in birmingham",
            "eligibility to work in the uk",
        ]):
            continue
        useful.append(sentence)
        if len(useful) >= 4:
            break

    if useful:
        return " ".join(useful)

    sentences = [clean_sentence(sentence) for sentence in split_sentences(cleaned)]
    sentences = [sentence for sentence in sentences if sentence and not looks_like_noise(sentence)]
    return " ".join(sentences[:3]).strip()


def summarize_general_chunk(text: str) -> str:
    cleaned = clean_sentence(text)
    sentences = [clean_sentence(sentence) for sentence in split_sentences(cleaned)]
    sentences = [sentence for sentence in sentences if sentence and not looks_like_noise(sentence)]
    return " ".join(sentences[:3]).strip()


def retrieve_similar_chunks(
    db: Session,
    *,
    org_id: str,
    question_embedding: list[float],
    top_k: int = 5,
    document_id: str | None = None,
) -> list[dict]:
    params = {
        "org_id": org_id,
        "embedding": "[" + ",".join(f"{float(x):.8f}" for x in question_embedding) + "]",
        "top_k": int(top_k),
    }

    if document_id:
        sql = text(
            """
            SELECT
              c.id::text AS chunk_id,
              c.document_id::text AS document_id,
              d.title AS document_title,
              c.page_number,
              c.chunk_index,
              c.text,
              1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
            FROM pdf_chunks c
            JOIN pdf_documents d ON d.id = c.document_id
            WHERE c.org_id = :org_id
              AND c.document_id = CAST(:document_id AS uuid)
              AND d.status = 'ready'
            ORDER BY c.embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
            """
        )
        params["document_id"] = document_id
    else:
        sql = text(
            """
            SELECT
              c.id::text AS chunk_id,
              c.document_id::text AS document_id,
              d.title AS document_title,
              c.page_number,
              c.chunk_index,
              c.text,
              1 - (c.embedding <=> CAST(:embedding AS vector)) AS score
            FROM pdf_chunks c
            JOIN pdf_documents d ON d.id = c.document_id
            WHERE c.org_id = :org_id
              AND d.status = 'ready'
            ORDER BY c.embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
            """
        )

    rows = db.execute(sql, params).mappings().all()
    return [dict(row) for row in rows]


def build_answer(question: str, chunks: list[dict]) -> str:
    if not chunks:
        return "No relevant evidence was found in the processed PDFs for this question."

    best_chunks = select_best_chunks(question, chunks, limit=3)
    if not best_chunks:
        best_chunks = chunks[:1]

    answer_parts: list[str] = []
    seen = set()

    for chunk in best_chunks:
        if is_requirement_query(question):
            part = summarize_requirement_chunk(chunk["text"])
        else:
            part = summarize_general_chunk(chunk["text"])

        part = clean_sentence(part)
        key = part.lower()
        if not part or key in seen:
            continue
        seen.add(key)
        answer_parts.append(part)
        if len(answer_parts) >= 2:
            break

    answer = " ".join(answer_parts).strip()
    if answer:
        return answer

    fallback = normalize_text(best_chunks[0]["text"])
    return fallback[:400] if len(fallback) > 400 else fallback
