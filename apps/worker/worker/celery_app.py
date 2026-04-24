from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ooi_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_retry_delay=30,
)

celery_app.conf.beat_schedule = {
    "schedule-active-source-crawls": {
        "task": "worker.tasks.schedule_active_source_crawls",
        "schedule": crontab(minute="*/5"),
    },
    "generate-alert-events": {
        "task": "worker.tasks.generate_alert_events",
        "schedule": crontab(minute="*/10"),
    },
    "cleanup-stale-opportunities": {
        "task": "worker.tasks.cleanup_stale_opportunities",
        "schedule": crontab(minute="0", hour="*/6"),
    },
}
