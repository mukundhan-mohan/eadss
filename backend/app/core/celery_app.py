from celery import Celery
from app.core.config import settings
from celery.schedules import crontab

celery_app = Celery(
    "eadss",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "bertopic-nightly-demo": {
        "task": "topic_jobs.run_bertopic",
        "schedule": crontab(minute=0, hour=2),  # 02:00 UTC daily
        "args": ("demo", None, 14, 20),
    },
    "agg-emotion-daily-0010": {
        "task": "aggregations.compute_emotion_daily",
        "schedule": crontab(minute=10, hour=0),  # 00:10 UTC daily
        "args": (),  # yesterday by default
    },
    "agg-emotion-rolling-0020": {
        "task": "aggregations.compute_emotion_rolling",
        "schedule": crontab(minute=20, hour=0),  # after daily
        "args": (),  # yesterday, windows [7,30,90]
    },
    "detect-risk-spikes-0030": {
        "task": "aggregations.detect_risk_spikes",
        "schedule": crontab(minute=30, hour=0),
        "args": (),  # yesterday by default
    },
    "alert-rule-engine-0040": {
        "task": "alerting.run_rules",
        "schedule": crontab(minute=40, hour=0),  # after aggregates + spike detection
        "args": (),  # yesterday
    },
}

# Ensure tasks are discovered/registered
celery_app.autodiscover_tasks(["app.tasks"])

# Force-import tasks module so the @task decorator runs even if autodiscover is flaky
import app.tasks.infer_docs  # noqa: F401

import app.tasks.topic_jobs  # noqa: F401

import app.tasks.aggregations  # noqa: F401

import app.tasks.alerting  # noqa: F401