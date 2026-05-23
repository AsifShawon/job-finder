# Official Job Sources Pipeline

This document explains how the four current official Saudi job sources are implemented in the codebase, how they are crawled and scraped, how deterministic parsing works, how AI prompting works, and how the admin inspection and publish flow works.

## Scope

Current official sources:

1. `alfanar Official Careers`
   - URL: `https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/`
   - Connector key: `successfactors_alfanar`
2. `Aramco European Candidates Careers`
   - URL: `https://careers.aramco.com/expat_uk/go/For-European-Candidates/7717923#content`
   - Connector key: `successfactors_aramco`
3. `Tamimi Official Careers`
   - URL: `https://tamimi.sa/careers.php`
   - Connector key: `tamimi_careers`
4. `Maharah Posts`
   - URL: `https://careers.maharah.com/jobs`
   - Connector key: `maharah_posts`

These sources are treated as official detail-page job sources and use a parser-first, admin-gated flow.

## Main Files

Seed/source registration:
- `apps/api/app/ingestion/official_sources.py`

Connector routing:
- `apps/api/app/ingestion/connectors/registry.py`
- `apps/api/app/ingestion/source_router.py`

Official crawling:
- `apps/api/app/ingestion/connectors/official_saudi.py`

Deterministic section parsing:
- `apps/api/app/ingestion/official_job_sections.py`
- `apps/api/app/ingestion/official_job_detail_parser.py`

Pipeline:
- `apps/api/app/ingestion/pipeline.py`

AI extraction:
- `apps/api/app/ingestion/extractor.py`
- `apps/api/app/services/mistral_client.py`

Admin inspection:
- `apps/api/app/api/v1/endpoints/admin_crawl_inspection.py`
- `apps/api/app/schemas/admin.py`
- `apps/web/components/admin-crawl-inspection.tsx`
- `apps/web/app/admin/crawls/[runId]/inspection/page.tsx`

Public detail output:
- `apps/api/app/api/v1/endpoints/opportunities.py`
- `apps/web/app/opportunity/[id]/page.tsx`

## 1. Source Registration

The four sources are seeded in `official_sources.py` as `OFFICIAL_SOURCE_SEEDS`.

Important characteristics of these seeds:
- `trust_level = "official_partner"`
- `requires_admin_review = True`
- `auto_publish = False`
- `is_official_seed_source = True`
- `feed_type = "html"`
- `settings_json` includes:
  - `full_site_crawl`
  - `force_ai_detail_extraction`
  - `require_application_url`
  - `require_isc_category`
  - `strict_bd_job_filter`
  - `low_confidence_to_review`
  - `auto_publish_on_pass`

Important note:
- Even though seed settings still contain flags like `auto_publish_on_pass`, the current official detail-page path does not auto-publish.
- The parser-first official path stops for admin review before AI and publish.

## 2. Connector Routing

`source_router.py` resolves a source to a connector in this order:

1. `connector_key`
2. `feed_type`
3. `ingestion_mode`
4. legacy `access_method`

For these four sources, `connector_key` is always set, so the router goes directly to `registry.py`.

`registry.py` maps:
- `successfactors_alfanar` -> `AlfanarSuccessFactorsConnector`
- `successfactors_aramco` -> `AramcoSuccessFactorsConnector`
- `tamimi_careers` -> `TamimiCareersConnector`
- `maharah_posts` -> `MaharahPostsConnector`

## 3. Crawl Model

All four sources follow the same mandatory shape:

1. Open listing page
2. Discover job detail URLs
3. Open each detail page
4. Save rendered detail-page HTML and text
5. Pass detail-page content into deterministic parser

They do not publish from listing-card text alone.

### Shared Browser Layer

`official_saudi.py` uses `_OfficialSiteBrowser`, which wraps Playwright Chromium.

Behavior:
- launches Chromium headless
- uses real browser rendering
- dismisses cookie banners and common overlays
- waits for source-specific selectors
- scrolls the page
- waits for network settle
- returns:
  - `requested_url`
  - `final_url`
  - rendered `html`
  - page `title`

Shared crawl limits:
- `MAX_PAGES = 50`
- `MAX_DETAIL_PAGES = 300`
- `PREVIEW_DETAIL_LIMIT = 8`

### Captured FetchedPage Metadata

Official detail pages now carry these key metadata fields:
- `structured_job: true`
- `official_detail_page: true`
- `connector_key`
- `company`
- `source_job_id`
- `crawl_engine: "playwright"`
- `section_parser_required: true`
- `listing_page_url`
- `requested_detail_url`
- `final_rendered_url`
- `listing_card_title`
- `source_item_key`

## 4. Source-by-Source Crawl Behavior

### 4.1 Alfanar and Aramco

Both use the same base class: `SuccessFactorsConnector`.

The only practical differences are:
- `flavor = "alfanar"` or `flavor = "aramco"`
- `company`
- Aramco marks `conservative = True`

#### Listing discovery

`parse_successfactors_listing(...)`:
- finds anchors that look like job links
- recognizes `/job/` and related SuccessFactors patterns
- extracts listing-card metadata from surrounding row text
- for Alfanar, commonly extracts:
  - title
  - location
  - experience level
  - posting date
- for Aramco, commonly extracts:
  - requisition id
  - location
  - department

#### Detail discovery

`SuccessFactorsConnector.discover_items(...)`:
- visits listing pages in a queue
- parses jobs and next pages
- opens every discovered job detail page
- converts each rendered detail page with `parse_successfactors_detail(...)`

#### Detail page conversion

`parse_successfactors_detail(...)`:
- strips obvious layout nodes
- extracts the visible title
- captures cleaned rendered body text
- finds canonical URL
- finds apply URL from visible anchors
- computes a content hash
- returns a `FetchedPage`

### 4.2 Tamimi

`TamimiCareersConnector.discover_items(...)` delegates to `_discover_static_detail_pages(...)` with `parse_tamimi_listing`.

#### Listing discovery

`parse_tamimi_listing(...)`:
- first tries structured card selectors
- falls back to a broader anchor-based scan if needed
- extracts:
  - detail URL
  - title
  - listing page URL
  - location
  - department
  - posting date
  - apply URL

#### Detail discovery

`_discover_static_detail_pages(...)`:
- visits listing pages
- follows pagination
- opens each detail page with Playwright
- converts the detail page using `_static_detail_page(...)`

### 4.3 Maharah

`MaharahPostsConnector.discover_items(...)` also delegates to `_discover_static_detail_pages(...)`, but uses `parse_maharah_posts(...)`.

#### Listing discovery

`parse_maharah_posts(...)`:
- looks specifically for `/jobs/apply/` links
- rejects login/signup/non-job URLs
- derives title from anchor or nearby block text
- extracts:
  - detail URL
  - title
  - listing page URL
  - department
  - location
  - posting date

#### Detail discovery

Same static-detail helper path as Tamimi.

### 4.4 Shared Static Detail Conversion

`_static_detail_page(...)`:
- strips layout nodes
- extracts best available title
- reads visible body text
- tries to find apply URL
- computes `content_hash`
- returns `FetchedPage`

This path is used for:
- Tamimi
- Maharah

## 5. Raw Data That Gets Saved

In `pipeline.py`, every fetched page becomes a `RawDocument`.

Stored at this stage:
- `source_url`
- `canonical_url`
- `content_type`
- `raw_text`
- `raw_title`
- `source_job_id`
- `detected_item_type`
- `raw_html_snapshot`
- `raw_html_path`
- `metadata_json`
- `content_hash`
- `crawl_run_id`

This is the base record that the admin inspection flow works from.

## 6. Pipeline Flow For Official Sources

Entry point: `run_source_ingestion(db, source_id, force=False)`

High-level sequence:

1. Load `Source`
2. Create `CrawlRun` and legacy `CrawlJob`
3. Run compliance checks
4. Resolve connector from `source_router.py`
5. `connector.discover_items(...)` returns rendered `FetchedPage` objects
6. Each page goes through `_process_page(...)`

### `_process_page(...)` for official detail pages

Official pages are detected by:
- `page.metadata.official_detail_page`
- or `source.connector_key` in the official connector set

For official pages the flow is:

1. parse page via generic page parser and cleaner
2. store `RawDocument`
3. initialize diagnostics JSON
4. run `parse_official_job_detail(...)`
5. build compact AI input payload
6. store parser diagnostics
7. mark page for admin review
8. stop before generic extraction

Important:
- The official branch returns early before the old generic extraction path runs.
- That is what makes this parser-first and admin-gated.

## 7. Diagnostics Shape

`RawDocument.extraction_diagnostics_json` is the audit store for the official flow.

Current shape:

```json
{
  "crawl": {
    "requested_url": "",
    "listing_page_url": "",
    "final_url": "",
    "crawl_engine": "playwright",
    "raw_html_length": 0,
    "raw_text_length": 0
  },
  "section_parser": {
    "status": "success|not_run",
    "state": "parser_pending_admin|parser_low_confidence",
    "parser_confidence": 0.0,
    "parsed_payload": {},
    "ignored_noise_lines": [],
    "warnings": []
  },
  "ai": {
    "status": "ai_pending_admin|ai_completed_pending_publish|fallback_ready_pending_publish|not_run",
    "provider": "",
    "model": "",
    "prompt_version": "official_job_compact_v1",
    "input_payload": {},
    "raw_output": {},
    "validated_output": {},
    "validation_errors": [],
    "repair_attempted": false,
    "repair_success": false
  },
  "final_record": {
    "opportunity_id": null,
    "status": "",
    "published": false,
    "fallback_used": false
  },
  "attempts": []
}
```

## 8. Deterministic Section Parsing

The deterministic parser lives in:
- `official_job_sections.py`
- `official_job_detail_parser.py`

### Models

`OfficialJobSection`
- `heading`
- `normalized_heading`
- `items`
- `raw_text`
- `confidence`

`OfficialJobParsedPayload`
- source metadata
- normalized job fields
- extracted section arrays
- `raw_sections`
- `ignored_noise_lines`
- `parser_warnings`
- `parser_confidence`
- `field_sources`

### Noise removal

The parser removes:
- cookie prompts
- login / sign in
- view profile / my profile
- Start apply with LinkedIn
- Apply now
- Please wait
- All Openings
- Search jobs
- Share this job
- punctuation-only lines
- duplicate lines

### Section construction

The parser:

1. removes noisy DOM nodes with BeautifulSoup
2. extracts clean text lines
3. identifies headings by source-specific heading maps
4. groups following lines into sections
5. normalizes section items
6. fills a normalized payload
7. records section/evidence per field
8. computes parser confidence

### Source-specific heading maps

#### Alfanar

Recognized headings include:
- Job Purpose
- Key Accountability Areas
- Project Execution
- Coordination
- Quality and Safety
- Documentation and Reporting
- Problem Solving
- Technical Skills
- Role Accountability
- Academic Qualification
- Work Experience
- Technical or Functional Competencies

#### Aramco

Recognized headings include:
- Overview
- Job Purpose
- Responsibilities
- Minimum Requirements
- Working Environment
- Education
- Experience
- Certificates
- Skills

#### Tamimi

Recognized headings include:
- Job Description
- Description
- Department
- Location
- Job posted on
- Experience Required
- Qualifications
- Transferable iqama
- Requirements

#### Maharah

Recognized headings include:
- Job title
- Location
- Description
- Requirements
- Responsibilities
- Skills
- Benefits
- Apply link

### Parser confidence

`_compute_confidence(...)` scores coverage of:
- title
- company
- country
- city
- apply URL
- job purpose
- responsibilities
- qualifications / education / work experience
- technical skills / competencies

This produces the `parser_pending_admin` vs `parser_low_confidence` state.

## 9. Compact AI Input

After parsing, `build_official_job_ai_input_payload(...)` creates a compact payload.

It includes:
- title
- company
- country
- city
- department
- apply_url
- posted_date
- job_purpose
- responsibilities
- key_accountabilities
- role_accountabilities
- qualifications
- technical_skills
- competencies
- work_experience
- education
- work_permit_or_iqama
- benefits
- deadline_text
- salary_text
- source_sections

It does not include:
- raw HTML
- full raw page text
- crawl boilerplate
- injected metadata prompt headers

## 10. Official AI Prompt

The prompt is built by `build_official_job_ai_prompt(...)` in `extractor.py`.

Important differences from the old generic prompt:
- it is fact-based, not full-page-text based
- it only receives parsed fields
- it enforces a fixed JSON schema
- it explicitly forbids invention of:
  - salary
  - deadline
  - visa support
  - Bangladesh eligibility
- it explicitly tells the model to:
  - write worker-friendly Bangla and English summaries
  - keep requirements as separate items
  - preserve `source_sections`

## 11. AI Execution, Validation, Repair, Fallback

Main function:
- `run_official_job_ai_extraction(db, parsed_payload)`

Flow:

1. resolve provider, model, API key
2. build compact input payload
3. if no API key:
   - skip AI
   - use deterministic fallback
4. otherwise:
   - build official compact prompt
   - call provider
   - parse returned JSON
5. if JSON parse or validation fails:
   - run one repair prompt
6. if repair fails:
   - use deterministic fallback
7. hydrate the result with parsed payload defaults
8. save validated output into diagnostics

### Providers

The code supports:
- Mistral
- Groq

Mistral calls are routed through:
- `apps/api/app/services/mistral_client.py`

### Summary guard

`is_raw_metadata_summary(...)` blocks bad summaries containing strings like:
- `Official listing metadata:`
- `Job detail page content:`
- `Source job ID:`
- `Apply URL:`
- `Career Details`
- `Login View profile`
- `Start apply with LinkedIn`
- `Please wait`

If AI returns a bad metadata dump as summary:
- summary is regenerated from fallback content
- extraction is marked with `recovered_bad_summary`

### Deterministic fallback

`official_parsed_payload_to_fallback_extraction(...)` builds a usable `JobOpportunityExtraction` from parser output alone.

It generates:
- `summary_en`
- `summary_bn`
- `requirements`
- `responsibilities`
- `key_accountabilities`
- `role_accountabilities`
- `qualifications`
- `skills`
- `source_sections`
- `journey_steps`
- `documents_needed`

It does not invent:
- salary
- deadline
- visa support unless explicitly indicated
- can_apply_from_bd when evidence is unclear

It also treats:
- `transferable iqama` as a negative signal for direct Bangladesh applicability

## 12. Admin Inspection Flow

The admin inspection backend is implemented in `admin_crawl_inspection.py`.

### Crawl-level inspection

`GET /api/v1/admin/crawl-runs/{run_id}/inspection`

Returns:
- crawl run info
- source info
- discovery diagnostics
- parser success count
- AI success count
- failed count
- pending review count
- page summaries

### Raw-document inspection

`GET /api/v1/admin/raw-documents/{raw_document_id}/inspection`

Returns:
- raw document metadata
- listing / requested / final URLs
- raw text preview
- raw HTML snapshot
- parser diagnostics
- compact AI input
- raw AI output
- validated AI output
- final record state
- warnings

### Reprocessing actions

`POST /api/v1/admin/raw-documents/{id}/parse-sections`
- reruns deterministic parser

`POST /api/v1/admin/raw-documents/{id}/save-parser-edits`
- saves admin-edited parser payload

`POST /api/v1/admin/raw-documents/{id}/run-ai`
- runs compact AI extraction

`POST /api/v1/admin/raw-documents/{id}/use-fallback`
- builds deterministic fallback extraction

`POST /api/v1/admin/raw-documents/{id}/publish`
- creates or updates final `Opportunity`

### Admin UI

Frontend page:
- `apps/web/app/admin/crawls/[runId]/inspection/page.tsx`

Main component:
- `apps/web/components/admin-crawl-inspection.tsx`

Tabs:
- Crawl Overview
- Scraped Pages
- Regex Section Output
- AI Input
- AI Output
- Final Preview

## 13. Publish Path

Publishing is implemented in `_upsert_official_opportunity(...)` inside `admin_crawl_inspection.py`.

It:

1. finds or creates an `Opportunity`
2. maps validated extraction fields into the opportunity
3. computes grouped `requirements_json`
4. computes `benefits_json`
5. tags eligibility
6. sets public-facing fields like:
   - title
   - summary_bn
   - summary_en
   - country
   - city
   - application_url
   - eligibility_text
   - visa info
   - grouped requirements
   - extracted JSON
7. sets publish flags
8. assigns slug when needed

The final record also preserves:
- `raw_document_id`
- `extracted_json`
- `requirements_json.groups`
- `requirements_json.source_sections`

## 14. Public API and Public Detail Page

The published detail endpoint in `opportunities.py` reads:
- high-level fields from `Opportunity`
- structured section data from `Opportunity.extracted_json`
- fallback `source_sections` from `requirements_json.source_sections`

The public page in `apps/web/app/opportunity/[id]/page.tsx` now:
- suppresses raw metadata-style text
- prioritizes bilingual summaries
- prefers grouped source sections before generic requirement dumps
- sanitizes requirements, sections, journey steps, and documents
- shows `Not specified` / `উল্লেখ নেই` at field level when needed

## 15. End-to-End Sequence For These 4 Sources

For all four official sources, the current end-to-end flow is:

1. source seeded with official connector key
2. source router resolves official connector
3. Playwright opens listing page
4. listing parser extracts job detail URLs
5. Playwright opens every detail page
6. rendered HTML + raw text stored in `RawDocument`
7. deterministic parser extracts sections and evidence
8. compact AI input is generated and stored
9. page is held for admin review
10. admin inspects parser output
11. admin runs AI or fallback
12. validated structured output is stored
13. admin publishes
14. public detail endpoint returns grouped official job data

## 16. Important Implementation Notes

### Alfanar and Aramco are structurally similar

They share:
- Playwright SuccessFactors browsing
- listing pagination queue
- detail-page rendering path

They differ mainly in:
- row parsing heuristics
- company name
- conservative flag for Aramco

### Tamimi and Maharah use the static-detail helper

They share:
- `_discover_static_detail_pages(...)`
- `_static_detail_page(...)`

They differ in:
- listing-page parsing rules
- heading maps in deterministic parser

### Legacy settings still exist

Some source settings still reflect the earlier generic-AI path, for example:
- `force_ai_detail_extraction`
- `auto_publish_on_pass`

For these official connectors, the actual runtime behavior is now:
- parser first
- admin gated
- no automatic AI call during crawl
- no automatic publish during crawl

## 17. Current Limitations

1. The deterministic parser is heuristic. If these sites change heading structure or DOM layout, heading maps and listing parsers will need updates.
2. The public/admin flow is implemented, but the inspection UI currently focuses on parse, AI, fallback, and publish. It is not a full moderation workflow engine.
3. The seed settings still contain some older flags that are no longer authoritative for official detail-page publishing behavior.
4. The parser confidence threshold is static at `0.65`.
5. `source_sections` are preserved, but normalization still depends on visible text layout quality after rendering.
6. AI output is only as good as the parsed payload. The system intentionally trades recall for cleaner, auditable inputs.

## 18. Summary

The four current official sources do not use the old “send messy page text to AI immediately” flow anymore.

They now use:
- source-specific Playwright detail-page crawling
- stored raw crawl artifacts
- deterministic section extraction
- compact fact-only AI prompting
- one repair attempt on invalid AI JSON
- deterministic fallback
- admin inspection before publish

That is the core implementation that currently powers:
- Alfanar
- Aramco
- Tamimi
- Maharah
