from app.ingestion.connectors.api_connector import APISourceConnector
from app.ingestion.connectors.bmet_connector import BMETConnector
from app.ingestion.connectors.boesl_brms_connector import BOESLBRMSConnector
from app.ingestion.connectors.boesl_reports_pdf_connector import BOESLReportsPDFConnector
from app.ingestion.connectors.dynamic_html_connector import DynamicHTMLConnector
from app.ingestion.connectors.eures_connector import EURESConnector
from app.ingestion.connectors.generic_scholarship_connector import GenericScholarshipConnector
from app.ingestion.connectors.generic_training import GenericTrainingConnector
from app.ingestion.connectors.jobbank_connector import JobBankConnector
from app.ingestion.connectors.jobbank_linkout import JobBankLinkoutConnector
from app.ingestion.connectors.linkout_connector import LinkoutConnector
from app.ingestion.connectors.oep_connector import OEPConnector
from app.ingestion.connectors.pdf_connector import PDFNoticeConnector
from app.ingestion.connectors.reliefweb_api import ReliefWebAPIConnector
from app.ingestion.connectors.rss_connector import RSSSourceConnector
from app.ingestion.connectors.search_html_jobs_connector import SearchHTMLJobsConnector
from app.ingestion.connectors.static_html_connector import StaticHTMLConnector
from app.ingestion.connectors.usa_jobs_api import USAJobsAPIConnector

# Keyed by ConnectorKey enum value strings
CONNECTOR_KEY_MAP: dict[str, type] = {
    # BD government
    "boesl_brms": BOESLBRMSConnector,
    "boesl_reports_pdf": BOESLReportsPDFConnector,
    "bmet_connector": BMETConnector,
    "oep_connector": OEPConnector,
    # Generic content types
    "generic_news": StaticHTMLConnector,
    "generic_rss": RSSSourceConnector,
    "generic_pdf": PDFNoticeConnector,
    "generic_policy": StaticHTMLConnector,
    "search_html_jobs": SearchHTMLJobsConnector,
    "generic_scholarship": GenericScholarshipConnector,
    "generic_training": GenericTrainingConnector,
    # International job APIs
    "eures_connector": EURESConnector,
    "usa_jobs_api": USAJobsAPIConnector,
    "reliefweb_api": ReliefWebAPIConnector,
    # Canada
    "jobbank_linkout": JobBankLinkoutConnector,
    "jobbank_open_data_or_linkout": JobBankConnector,   # legacy
    # Linkout-only
    "linkout_only": LinkoutConnector,
}

# Keyed by access_method / ingestion_mode string (legacy fallback)
LEGACY_MAP: dict[str, type] = {
    "api": APISourceConnector,
    "rss": RSSSourceConnector,
    "static_html": StaticHTMLConnector,
    "dynamic_html": DynamicHTMLConnector,
    "pdf": PDFNoticeConnector,
    "html": StaticHTMLConnector,
    "html_with_pdf": StaticHTMLConnector,
    "open_data": APISourceConnector,
    "linkout_only": LinkoutConnector,
    "manual": StaticHTMLConnector,
}
