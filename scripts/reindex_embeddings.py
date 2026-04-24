from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.entities import Opportunity
from worker.tasks import reindex_opportunity


if __name__ == "__main__":
    with SessionLocal() as db:
        ids = db.scalars(select(Opportunity.id)).all()
    for opp_id in ids:
        reindex_opportunity.delay(opp_id)
    print(f"Queued {len(ids)} opportunities for reindex")
