export type RecordType = "job" | "scholarship" | "policy_update";
export type SourceClass = "bd_migration" | "foreign_jobs" | "scholarship" | "news_policy";
export type TrustTier = "official_gov" | "official_partner" | "established_portal" | "news_only";
export type AccessMethod = "api" | "rss" | "static_html" | "dynamic_html" | "pdf";
export type CrawlStatus = "pending" | "running" | "success" | "failed";

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  preferred_language: string;
  created_at: string;
}

export interface OpportunityCard {
  id: number;
  title: string;
  summary: string | null;
  record_type: RecordType;
  employer: string | null;
  organization: string | null;
  country: string | null;
  city: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  funding_type: string | null;
  deadline: string | null;
  trust_score: number;
  source_class: SourceClass;
  trust_tier: TrustTier;
  source_url: string;
  why_this_matches: string;
  is_saved: boolean;
}

export interface OpportunityDetail {
  id: number;
  record_type: RecordType;
  title: string;
  summary: string | null;
  country: string | null;
  city: string | null;
  employer: string | null;
  organization: string | null;
  sector: string | null;
  degree_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  funding_type: string | null;
  deadline: string | null;
  application_url: string | null;
  visa_support: boolean | null;
  source_url: string;
  trust_score: number;
  freshness_score: number;
  actionability_score: number;
  extraction_confidence: number;
  overall_rank_score: number;
  is_active: boolean;
  published_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
  requirements_json?: { items?: string[] };
  benefits_json?: { items?: string[] };
  language_requirements_json?: { items?: string[] };
}

export interface SearchResponse {
  items: OpportunityCard[];
  total: number;
  page: number;
  page_size: number;
}

export interface SimilarOpportunityResponse {
  items: OpportunityCard[];
}

export interface AlertRule {
  id: number;
  user_id: number;
  name: string;
  query_text: string;
  filter_json: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

export interface AlertRulePage {
  items: AlertRule[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminSource {
  id: number;
  name: string;
  base_url: string;
  country: string | null;
  source_class: SourceClass;
  trust_tier: TrustTier;
  access_method: AccessMethod;
  crawl_frequency_minutes: number;
  is_active: boolean;
  parser_key: string;
  created_at: string;
  updated_at: string;
  opportunity_count: number;
  active_opportunity_count: number;
  raw_document_count: number;
  last_crawl_status: CrawlStatus | null;
  last_crawl_started_at: string | null;
  last_crawl_finished_at: string | null;
  last_pages_fetched: number;
  last_records_extracted: number;
}

export interface CrawlJob {
  id: number;
  source_id: number;
  source_name: string | null;
  status: CrawlStatus;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  pages_fetched: number;
  records_extracted: number;
}

export interface CrawlJobPage {
  items: CrawlJob[];
  total: number;
  page: number;
  page_size: number;
}

export interface FailedExtraction {
  id: number;
  title: string;
  record_type: RecordType;
  source_id: number;
  source_name: string | null;
  source_url: string;
  extraction_confidence: number;
  updated_at: string;
}

export interface FailedExtractionPage {
  items: FailedExtraction[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminOverviewStats {
  total_sources: number;
  active_sources: number;
  total_opportunities: number;
  active_opportunities: number;
  total_users: number;
  total_alert_rules: number;
  running_crawls: number;
  failed_crawls_last_24h: number;
  queued_alert_events: number;
}

export interface AdminOverview {
  stats: AdminOverviewStats;
  recent_crawls: CrawlJob[];
  sources: AdminSource[];
}

export interface AdminAiSettings {
  groq_api_key_configured: boolean;
  groq_model: string;
}
