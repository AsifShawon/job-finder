// ── New enums ─────────────────────────────────────────────────────────────────

export type OpportunityStatus = "pending" | "published" | "rejected" | "expired";
export type FeedType = "rss" | "html" | "api" | "pdf";

// ── Core enums ────────────────────────────────────────────────────────────────

export type SourceType =
  | "news" | "job_board" | "job_pdf" | "policy" | "scholarship"
  | "training" | "rss" | "api" | "linkout_only" | "hybrid";

export type IngestionMode =
  | "html" | "html_with_pdf" | "pdf" | "rss" | "api"
  | "open_data" | "manual" | "linkout_only" | "dynamic_html";

export type ConnectorKey =
  | "generic_news" | "generic_rss" | "generic_pdf" | "generic_policy"
  | "search_html_jobs"
  | "successfactors_alfanar" | "successfactors_aramco" | "tamimi_careers" | "maharah_posts"
  | "generic_scholarship" | "generic_training"
  | "boesl_brms" | "boesl_reports_pdf" | "bmet_connector" | "oep_connector"
  | "eures_connector" | "usa_jobs_api" | "reliefweb_api"
  | "jobbank_linkout" | "linkout_only" | "manual_entry";

export type TrustLevel =
  | "government_official" | "official_partner" | "verified_source"
  | "news_source" | "unknown";

export type ComplianceStatus =
  | "allowed" | "use_api_only" | "rss_only" | "linkout_only"
  | "manual_review_required" | "unknown";

export type CrawlFrequency = "hourly" | "daily" | "weekly" | "manual";
export type FirstCrawlMode =
  | "active_only" | "backfill_recent" | "backfill_all" | "preview_only" | "linkout_only";

export type CrawlRunStatus =
  | "queued" | "running" | "success" | "success_empty" | "partial_success" | "failed"
  | "failed_config" | "skipped" | "skipped_recently" | "skipped_compliance" | "linkout_only_skipped";

export type OpportunityType =
  | "overseas_job" | "local_job" | "scholarship" | "training"
  | "migration_policy" | "visa_update" | "circular" | "warning" | "news";

export type ContentType =
  | "html" | "pdf" | "html_with_pdf" | "image_pdf" | "api" | "rss" | "manual" | "linkout_only" | "unknown";

export type LMIAStatus = "none" | "requested" | "approved" | "unknown";

export type EligibilityStatus =
  | "eligible" | "conditional" | "authorized_workers_only"
  | "unclear_manual_review" | "not_relevant";

export type ReviewStatus = "pending" | "approved" | "rejected" | "needs_manual_fix";

// ── Legacy enums (kept for backward compat with existing components) ──────────
export type RecordType = "job" | "scholarship" | "policy_update";
export type SourceClass = "bd_migration" | "foreign_jobs" | "scholarship" | "news_policy";
export type TrustTier = "official_gov" | "official_partner" | "established_portal" | "news_only";
export type AccessMethod = "api" | "rss" | "static_html" | "dynamic_html" | "pdf";
export type CrawlStatus = "pending" | "running" | "success" | "failed";

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  preferred_language: string;
  onboarding_complete: boolean;
  created_at: string;
}

// ── Published Opportunity (public-facing) ─────────────────────────────────────

export interface PublishedOpportunityCard {
  id: number;
  title: string;
  title_bn: string | null;
  title_en: string | null;
  opportunity_type: OpportunityType | null;
  country: string | null;
  destination_country: string | null;
  employer_or_organization: string | null;
  sector: string | null;
  isc_category_key: string | null;
  platform_category_bn: string | null;
  platform_category_en: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_text: string | null;
  salary_text_bn: string | null;
  salary_text_en: string | null;
  experience_min_years: number | null;
  deadline: string | null;
  source_page_url: string;
  document_url: string | null;
  original_apply_url: string | null;
  content_type: ContentType | null;
  source_name: string | null;
  source_trust_badge: string | null;
  can_apply_from_bd: boolean | null;
  requires_existing_work_permit: boolean | null;
  open_to_international_candidates: boolean | null;
  open_to_authorized_workers_only: boolean | null;
  lmia_status: LMIAStatus | null;
  eligibility_status: EligibilityStatus | null;
  target_audience_tags: string[];
  risk_flags: string[];
  trust_score: number;
  bangladesh_applicability: string | null;
  rural_user_fit_score: number;
  actionability_score: number;
  overall_rank_score: number;
  published_at: string | null;
  is_saved: boolean;
  why_this_matches: string;
  // backward compat
  summary: string | null;
  summary_bn: string | null;
  source_url: string;
  is_active: boolean;
}

export interface PublishedOpportunityDetail extends PublishedOpportunityCard {
  summary_en: string | null;
  job_title: string | null;
  job_title_bn: string | null;
  job_title_en: string | null;
  skill_level: string | null;
  education_min: string | null;
  experience_min_years: number | null;
  extraction_warnings: string[];
  location_text: string | null;
  location_text_bn: string | null;
  location_text_en: string | null;
  posted_date: string | null;
  eligibility_text: string | null;
  eligibility_text_bn: string | null;
  eligibility_text_en: string | null;
  required_documents: string | null;
  required_documents_bn: string | null;
  required_documents_en: string | null;
  application_process: string | null;
  application_process_bn: string | null;
  application_process_en: string | null;
  education_requirement: string | null;
  education_requirement_bn: string | null;
  education_requirement_en: string | null;
  experience_requirement: string | null;
  experience_requirement_bn: string | null;
  experience_requirement_en: string | null;
  language_requirement: string | null;
  language_requirement_bn: string | null;
  language_requirement_en: string | null;
  age_requirement: string | null;
  gender_requirement: string | null;
  visa_or_work_permit_info: string | null;
  visa_or_work_permit_info_bn: string | null;
  visa_or_work_permit_info_en: string | null;
  journey_steps: string[];
  journey_steps_bn: string[];
  journey_steps_en: string[];
  documents_needed: string[];
  documents_needed_bn: string[];
  documents_needed_en: string[];
  typical_salary_bdt: number | null;
  extraction_confidence: number;
  connector_key: string | null;
  admin_status: string | null;
  bangladesh_applicability_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  draft_id: number | null;
  source_id: number | null;
  employer: string | null;
  organization: string | null;
  city: string | null;
  application_url: string | null;
  funding_type: string | null;
  visa_support: boolean | null;
  record_type: RecordType | null;
  trust_tier: TrustTier | null;
  requirements_json?: { items?: string[] } | null;
  benefits_json?: { items?: string[]; work_conditions?: string[] } | null;
  language_requirements_json?: { items?: string[] } | null;
  job_purpose: string | null;
  responsibilities: string[];
  key_accountabilities: string[];
  role_accountabilities: string[];
  qualifications: string[];
  skills: string[];
  work_conditions: string[];
  source_sections: Array<{ title: string; items: string[] }>;
  mirror_urls: string[];
}

export interface SearchResponse {
  items: PublishedOpportunityCard[];
  total: number;
  page: number;
  page_size: number;
}

export interface OpportunityCategorySummary {
  key: string;
  label_bn: string;
  label_en: string;
  job_count: number;
}

export interface SimilarOpportunityResponse {
  items: PublishedOpportunityCard[];
}

export interface CopilotSuggestedFollowUp {
  text: string;
}

export interface CopilotChatCitation {
  opportunity_id: number;
  title: string;
  title_bn: string | null;
  title_en: string | null;
  opportunity_type: OpportunityType | null;
  country: string | null;
  destination_country: string | null;
  experience_min_years?: number | null;
  deadline: string | null;
  employer_or_organization: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_text: string | null;
  salary_text_bn: string | null;
  can_apply_from_bd: boolean | null;
  source_trust_badge: string | null;
  source_url: string;
  is_saved: boolean;
  why_this_matches: string;
  summary: string | null;
  summary_bn: string | null;
}

export interface CopilotMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: CopilotChatCitation[];
  suggested_follow_ups: CopilotSuggestedFollowUp[];
  created_at: string;
}

export interface CopilotConversationListItem {
  id: number;
  title: string;
  locale: "bn" | "en";
  last_message_preview: string | null;
  updated_at: string;
  last_message_at: string;
}

export interface CopilotConversationDetail {
  id: number;
  title: string;
  locale: "bn" | "en";
  created_at: string;
  updated_at: string;
  last_message_at: string;
  messages: CopilotMessage[];
}

// ── Opportunity Draft (admin review queue) ────────────────────────────────────

export interface DraftItem {
  id: number;
  title: string;
  title_bn: string | null;
  opportunity_type: OpportunityType | null;
  source_id: number;
  source_name: string | null;
  source_page_url: string;
  document_url: string | null;
  original_apply_url: string | null;
  content_type: ContentType | null;
  country: string | null;
  destination_country: string | null;
  employer_or_organization: string | null;
  deadline: string | null;
  salary_text: string | null;
  eligibility_status: EligibilityStatus | null;
  can_apply_from_bd: boolean | null;
  requires_existing_work_permit: boolean | null;
  open_to_international_candidates: boolean | null;
  lmia_status: LMIAStatus | null;
  summary_bn: string | null;
  summary_en: string | null;
  extraction_confidence: number;
  needs_admin_review: boolean;
  review_status: ReviewStatus | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  target_audience_tags: string[];
  risk_flags: string[];
  source_trust_badge: string | null;
  connector_key: string | null;
  admin_status: string | null;
  platform_category_bn: string | null;
  platform_category_en: string | null;
  bangladesh_applicability: string | null;
  bangladesh_applicability_reason: string | null;
  rural_user_fit_score: number;
  actionability_score: number;
  trust_score: number;
  overall_rank_score: number;
  extraction_warnings: string[];
  raw_text: string | null;
  created_at: string;
  field_confidences: Record<string, number> | null;
  // backward compat
  record_type: RecordType | null;
  source_url: string | null;
}

export interface ReviewQueuePage {
  items: DraftItem[];
  total: number;
  page: number;
  page_size: number;
}

// ── Source ────────────────────────────────────────────────────────────────────

export interface AdminSource {
  id: number;
  name: string;
  base_url: string;
  root_url: string | null;
  country: string | null;
  country_scope: string | null;
  source_type: SourceType | null;
  ingestion_mode: IngestionMode | null;
  connector_key: ConnectorKey | null;
  trust_level: TrustLevel | null;
  compliance_status: ComplianceStatus | null;
  crawl_frequency: CrawlFrequency | null;
  first_crawl_mode: FirstCrawlMode | null;
  feed_type: FeedType | null;
  auto_publish: boolean;
  is_official_seed_source: boolean;
  is_deletable: boolean;
  settings_json: Record<string, unknown>;
  last_status: string | null;
  discovered_item_count: number;
  imported_job_count: number;
  skipped_item_count: number;
  needs_review_count: number;
  target_audience: string[];
  search_keywords: string[];
  enabled: boolean;
  requires_admin_review: boolean;
  last_crawled_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  // stats
  draft_count: number;
  pending_review_count: number;
  published_count: number;
  raw_document_count: number;
  last_crawl_status: string | null;
  last_crawl_started_at: string | null;
  last_crawl_finished_at: string | null;
  last_pages_fetched: number;
  last_records_extracted: number;
  // legacy
  source_class: SourceClass;
  trust_tier: TrustTier;
  access_method: AccessMethod;
  crawl_frequency_minutes: number;
  is_active: boolean;
  parser_key: string;
  search_queries: string[];
  search_results_limit: number;
  child_page_limit: number;
  page_ai_limit: number;
  max_jobs_per_page: number;
  opportunity_count: number;
  active_opportunity_count: number;
}

// ── Source probe (URL auto-detect) ────────────────────────────────────────────

export interface SourceProbeResult {
  url: string;
  feed_type: FeedType;
  suggested_name: string | null;
  sample_titles: string[];
  detected_language: string | null;
  suggested_isc_sector: string | null;
  estimated_opportunities_per_crawl: number | null;
  is_scrapable: boolean;
  scrape_warning: string | null;
  error: string | null;
}

// ── CrawlRun ──────────────────────────────────────────────────────────────────

export interface CrawlRun {
  id: number;
  source_id: number;
  source_name: string | null;
  connector_key: string | null;
  source_type: string | null;
  ingestion_mode: string | null;
  crawl_mode: string | null;
  status: CrawlRunStatus;
  discovered_count: number;
  parsed_count: number;
  duplicate_count: number;
  draft_created_count: number;
  draft_updated_count: number;
  unchanged_count: number;
  skipped_count: number;
  failed_count: number;
  manual_review_count: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  diagnostics: CrawlRunDiagnostics | null;
  logs: Record<string, unknown> | null;
}

export interface CrawlRunPage {
  items: CrawlRun[];
  total: number;
  page: number;
  page_size: number;
}

export interface CrawlRunDiagnostics {
  accepted_count: number;
  published_count: number;
  skipped_count: number;
  low_confidence_review_count: number;
  high_confidence_published_count: number;
  dominant_skip_reason: string | null;
  confidence_summary: Record<string, number>;
  extraction_method_counts: Record<string, number>;
  skip_reasons: Record<string, number>;
}

export interface RawDocumentExtractionAttempt {
  record_type: string | null;
  extraction_confidence: number | null;
  field_confidences: Record<string, number> | null;
  evidence_snippets: string[];
  application_url: string | null;
  employer: string | null;
  country: string | null;
  title: string | null;
  summary: string | null;
  extraction_method: string | null;
  fallback_reason: string | null;
  validation_errors: string[];
  skip_reason: string | null;
  review_reason: string | null;
}

export interface RawDocumentExtractionDiagnostics {
  attempts: RawDocumentExtractionAttempt[];
}

// ── Legacy CrawlJob (kept for backward compat with existing admin pages) ───────

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

// ── Admin overview ────────────────────────────────────────────────────────────

export interface AdminOverviewStats {
  total_sources: number;
  active_sources: number;
  total_drafts: number;
  pending_review: number;
  total_published: number;
  total_users: number;
  total_alert_rules: number;
  running_crawls: number;
  failed_crawls_last_24h: number;
  queued_alert_events: number;
  // backward compat
  total_opportunities: number;
  active_opportunities: number;
}

export interface AdminOverview {
  stats: AdminOverviewStats;
  recent_crawls: CrawlJob[];
  recent_runs: CrawlRun[];
  sources: AdminSource[];
}

export interface AdminAiSettings {
  ai_provider: string;
  ai_api_key_configured: boolean;
  ai_model: string;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

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

// ── Recommendations ───────────────────────────────────────────────────────────

export interface RecommendationCard extends PublishedOpportunityCard {
  match_score: number | null;
  isc_match_key: string | null;
}

export interface RecommendationResponse {
  items: RecommendationCard[];
  total: number;
  page: number;
  page_size: number;
}

// ── Legacy aliases (kept so existing OpportunityCard references don't break) ──

export type OpportunityCard = PublishedOpportunityCard;
export type OpportunityDetail = PublishedOpportunityDetail;
export type ReviewQueueItem = DraftItem;

export interface FailedExtraction {
  id: number;
  title: string;
  record_type: RecordType | null;
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

export interface RawDocument {
  id: number;
  source_id: number;
  crawl_run_id: number | null;
  source_url: string;
  canonical_url: string | null;
  content_type: string | null;
  raw_title: string | null;
  source_job_id: string | null;
  detected_item_type: string | null;
  skip_reason: string | null;
  raw_text: string | null;
  raw_html_path: string | null;
  raw_html_snapshot: string | null;
  metadata_json: Record<string, unknown>;
  extraction_diagnostics_json: RawDocumentExtractionDiagnostics;
  fetched_at: string | null;
}

export interface RawDocumentPage {
  items: RawDocument[];
  total: number;
  page: number;
  page_size: number;
}
