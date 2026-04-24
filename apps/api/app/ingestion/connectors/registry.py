from app.ingestion.connectors.api_connector import APISourceConnector
from app.ingestion.connectors.dynamic_html_connector import DynamicHTMLConnector
from app.ingestion.connectors.pdf_connector import PDFNoticeConnector
from app.ingestion.connectors.rss_connector import RSSSourceConnector
from app.ingestion.connectors.static_html_connector import StaticHTMLConnector
from app.models.entities import Source
from app.models.enums import AccessMethod


CONNECTOR_MAP = {
    AccessMethod.api: APISourceConnector,
    AccessMethod.rss: RSSSourceConnector,
    AccessMethod.static_html: StaticHTMLConnector,
    AccessMethod.dynamic_html: DynamicHTMLConnector,
    AccessMethod.pdf: PDFNoticeConnector,
}


def get_connector(source: Source):
    connector_cls = CONNECTOR_MAP[source.access_method]
    return connector_cls()
