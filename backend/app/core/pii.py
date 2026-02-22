import re
from dataclasses import dataclass
from typing import Dict, Tuple

# Simple, pragmatic patterns (good enough for baseline)
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)

# Phone: handles +44, spaces, dashes, parentheses. Avoids super-short matches.
PHONE_RE = re.compile(r"(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}\b")

@dataclass(frozen=True)
class RedactionResult:
    text_redacted: str
    summary: Dict[str, int]

def redact_pii(text: str) -> RedactionResult:
    email_matches = list(EMAIL_RE.finditer(text))
    phone_matches = list(PHONE_RE.finditer(text))

    redacted = EMAIL_RE.sub("[EMAIL]", text)

    # phone redaction after email redaction
    redacted = PHONE_RE.sub("[PHONE]", redacted)

    summary = {
        "emails": len(email_matches),
        "phones": len(phone_matches),
    }
    return RedactionResult(text_redacted=redacted, summary=summary)