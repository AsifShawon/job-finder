from abc import ABC, abstractmethod
from datetime import datetime

from app.ingestion.schemas import FetchedPage
from app.models.entities import Source


class BaseSourceConnector(ABC):
    @abstractmethod
    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        raise NotImplementedError
