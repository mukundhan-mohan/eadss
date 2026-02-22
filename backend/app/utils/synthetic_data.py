import json
import random
from datetime import datetime, timedelta, timezone
from typing import Any

EMOTION_TEMPLATES = [
    ("negative", ["sadness", "fatigue"], [
        "I feel hopeless and exhausted after this week.",
        "I'm drained and can't keep up anymore.",
        "I'm overwhelmed and totally worn out.",
    ]),
    ("negative", ["anger"], [
        "I am furious about the billing error.",
        "This is unacceptable. I'm angry this keeps happening.",
        "I'm really upset and frustrated with the service.",
    ]),
    ("negative", ["fear", "anxiety"], [
        "I'm anxious about what happens next.",
        "I'm afraid this will get worse.",
        "This situation makes me nervous and worried.",
    ]),
    ("positive", ["joy", "relief"], [
        "I'm relieved things are finally improving.",
        "Feeling happy and optimistic today.",
        "I'm excited about the progress we made.",
    ]),
    ("neutral", ["neutral"], [
        "Following up on the previous request.",
        "Just checking in for an update.",
        "Please confirm the next steps.",
    ]),
]

CHANNELS = ["email", "chat", "survey", "api", "web"]
SOURCES = ["api", "import", "webhook", "manual"]
TAGS = ["billing", "pulse", "support", "onboarding", "bug", "feature", "hr", "security"]

FIRST_NAMES = ["jane", "alex", "sam", "taylor", "morgan", "casey", "jamie", "robin"]
LAST_NAMES = ["doe", "smith", "patel", "chen", "brown", "khan", "garcia", "wilson"]

def _fake_email(rng: random.Random) -> str:
    fn = rng.choice(FIRST_NAMES)
    ln = rng.choice(LAST_NAMES)
    domain = rng.choice(["example.com", "demo.org", "test.io"])
    return f"{fn}.{ln}@{domain}"

def _fake_phone(rng: random.Random) -> str:
    # UK-ish mobile format for demo: +44 7700 900123
    return f"+44 77{rng.randint(0, 99):02d} {rng.randint(100, 999):03d}{rng.randint(100, 999):03d}"

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

def generate_items(
    n: int,
    org_id: str = "demo",
    team_id: str = "support",
    seed: int | None = None,
    external_prefix: str = "SYN",
) -> list[dict[str, Any]]:
    """
    Generate n ingestion items with varied sentiment/emotion language and embedded fake PII.
    The PII will be redacted by your ingestion pipeline.
    """
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)

    items: list[dict[str, Any]] = []
    for i in range(n):
        sentiment, labels, texts = rng.choice(EMOTION_TEMPLATES)
        base = rng.choice(texts)

        # Include PII frequently so you can demo redaction
        add_email = rng.random() < 0.85
        add_phone = rng.random() < 0.55

        pii_bits = []
        if add_email:
            pii_bits.append(f"Email me at {_fake_email(rng)}.")
        if add_phone:
            pii_bits.append(f"Call {_fake_phone(rng)}.")

        text = " ".join([base] + pii_bits).strip()

        ts = now - timedelta(minutes=rng.randint(0, 60 * 24 * 14))  # last 14 days
        channel = rng.choice(CHANNELS)
        source = rng.choice(SOURCES)
        tags = list({rng.choice(TAGS), rng.choice(TAGS)})

        items.append(
            {
                "text": text,
                "timestamp": _iso(ts),
                "source": source,
                "channel": channel,
                "tags": tags,
                "org_id": org_id,
                "team_id": team_id,
                "external_id": f"{external_prefix}-{rng.randint(1, 10_000_000)}",
            }
        )

    return items

def generate_ingest_payload(
    n: int,
    org_id: str = "demo",
    team_id: str = "support",
    seed: int | None = None,
    enqueue_inference: bool = True,
) -> dict[str, Any]:
    return {
        "items": generate_items(n=n, org_id=org_id, team_id=team_id, seed=seed),
        "enqueue_inference": enqueue_inference,
    }

def main() -> None:
    """
    CLI usage:
      python -m app.utils.synthetic_data --n 5 --org demo --team hr --seed 123 --no-infer
    Prints JSON payload to stdout.
    """
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--n", type=int, default=5)
    p.add_argument("--org", type=str, default="demo")
    p.add_argument("--team", type=str, default="support")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--no-infer", action="store_true")
    args = p.parse_args()

    payload = generate_ingest_payload(
        n=args.n,
        org_id=args.org,
        team_id=args.team,
        seed=args.seed,
        enqueue_inference=not args.no_infer,
    )
    print(json.dumps(payload))

if __name__ == "__main__":
    main()