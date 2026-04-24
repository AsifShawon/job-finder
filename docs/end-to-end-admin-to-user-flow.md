# End-to-End Admin to User Flow

This document explains how the platform works from the admin dashboard to the user-facing search, dashboard, alerts, saved items, and Copilot features.

The short version:

1. Admins register trusted source websites, feeds, APIs, or notices.
2. The system periodically fetches those sources in background jobs.
3. The fetched source content is cleaned, deduplicated, stored, extracted, scored, and indexed.
4. Users search and filter the indexed opportunities.
5. Users save opportunities and create alerts.
6. Copilot answers questions using only indexed opportunity records and source evidence.

## Important Concept: Crawling Is Not User Search

In this project, crawling does not mean that a user searches Google or types a keyword and the system browses the internet live.

Crawling is source-driven ingestion.

An admin first creates a source record, for example:

- BMET website
- EURES RSS feed
- DAAD scholarship page
- migration policy news feed
- any approved API, RSS feed, static HTML page, dynamic HTML page, or PDF notice endpoint

The crawler then fetches that source on a schedule or when an admin manually triggers it. The fetched data becomes local platform data in Postgres. User search only searches this local indexed database.

So the flow is:

`Admin registered sources -> crawler fetches sources -> database stores opportunities -> user searches database`

It is not:

`User search -> crawler searches the internet live`

This distinction matters because it keeps the product controlled, auditable, and trust-weighted. Users are not receiving arbitrary live web results; they are receiving records extracted from sources the admin team chose and classified.

## Runtime Components

The local Docker Compose stack is defined in `infrastructure/docker-compose.yml`.

The main services are:

| Service | Container | Purpose |
| --- | --- | --- |
| `web` | `ooi_web` | Next.js browser UI for users and admins |
| `api` | `ooi_api` | FastAPI backend for auth, search, admin, Copilot, saved items, alerts |
| `postgres` | `ooi_postgres` | Main database for users, sources, crawl jobs, raw documents, opportunities, alerts, saved items, settings |
| `redis` | `ooi_redis` | Celery broker/result backend for background jobs |
| `worker` | `ooi_worker` | Executes crawl, ingestion, reindex, alert, cleanup jobs |
| `beat` | `ooi_beat` | Schedules recurring background jobs |
| `minio` | `ooi_minio` | S3-compatible storage for raw crawl snapshots |
| `flower` | `ooi_flower` | Optional Celery monitoring UI |

The source of truth is Postgres. Redis is only the task queue. MinIO stores raw snapshots, but the code can fall back to local files under `data/raw`.

## Role Flow

### Admins

Admins manage the supply side of the platform.

Admins can:

- configure Groq API settings from the admin dashboard
- create, edit, pause, delete sources
- trigger a source crawl manually
- review crawl jobs
- review low-confidence extraction results
- monitor source coverage and ingestion health

Relevant frontend areas:

- `/admin`
- `/admin/sources`
- `/admin/crawls`
- `/admin/review`

Relevant backend endpoint group:

- `/api/v1/admin/*`

Admin access is enforced in the backend with `get_admin_user`, which rejects non-admin users.

### Users

Users consume the processed data.

Users can:

- browse and search opportunities
- filter by country, sector, degree level, record type, trust tier, visa support, and salary
- open opportunity details
- save opportunities
- create alert rules
- ask Copilot questions about indexed opportunities

Relevant frontend areas:

- `/search`
- `/opportunity/[id]`
- `/dashboard`
- `/saved`
- `/alerts`
- `/copilot`

Relevant backend endpoint groups:

- `/api/v1/opportunities/*`
- `/api/v1/saved/*`
- `/api/v1/alerts/*`
- `/api/v1/copilot/*`

## Admin Source Registration

The source registry is the starting point for ingestion.

When an admin creates a source in `/admin/sources`, the frontend sends a request through the Next.js proxy route to the FastAPI admin endpoint.

Current simplified admin flow:

1. Admin enters only a source title and the main website URL, for example `Gulf News` and `https://gulfnews.com/`.
2. The system fills the operational fields automatically:
   - country: `Bangladesh`
   - source class: `news_policy`
   - trust tier: `news_only`
   - access method: `static_html`
   - parser: `default`
   - frequency: `1440` minutes
   - active: `true`
3. Admin clicks `Crawl` from the source list.
4. The crawler discovers relevant same-domain links first, then scrapes those pages.

This means admins no longer need to choose parser, trust, access method, class, or country for the normal news-source workflow.

Frontend path:

- `apps/web/components/admin-source-manager.tsx`
- `apps/web/app/api/admin/sources/route.ts`

Backend path:

- `apps/api/app/api/v1/endpoints/admin.py`
- `create_source`
- `update_source`
- `delete_source`
- `list_sources`

A source contains:

| Field | Meaning |
| --- | --- |
| `name` | Human-readable source name |
| `base_url` | URL that the connector will fetch |
| `country` | Default country if extracted record does not specify one |
| `source_class` | Broad category: migration, foreign jobs, scholarship, policy/news |
| `trust_tier` | Trust level used in scoring and ranking |
| `access_method` | How the system fetches the source |
| `crawl_frequency_minutes` | Minimum interval between scheduled crawls |
| `is_active` | Whether the scheduler can crawl it |
| `parser_key` | Parser selection key |

The allowed source classes are:

- `bd_migration`
- `foreign_jobs`
- `scholarship`
- `news_policy`

The allowed trust tiers are:

- `official_gov`
- `official_partner`
- `established_portal`
- `news_only`

The allowed access methods are:

- `api`
- `rss`
- `static_html`
- `dynamic_html`
- `pdf`

## What Each Access Method Means

The selected access method chooses a connector class in `apps/api/app/ingestion/connectors/registry.py`.

### API

Connector:

- `APISourceConnector`

Behavior:

- Performs an HTTP GET on the source URL.
- Expects JSON.
- If the JSON is a list, it treats the list as records.
- If the JSON is an object, it reads `items`.
- Converts up to 50 records into `FetchedPage` objects.

Use this for structured source APIs.

### RSS

Connector:

- `RSSSourceConnector`

Behavior:

- Performs an HTTP GET on the RSS URL.
- Parses XML.
- Reads up to 50 `<item>` entries.
- Uses item `link`, `title`, and `description`.

Use this for official or trusted feeds.

### Static HTML

Connector:

- `StaticHTMLConnector`

Behavior:

- Treats the source URL as the main website for a newspaper or paper.
- Discovers candidate links from robots sitemap references, `/sitemap.xml`, common RSS/feed URLs, homepage links, and best-effort source-local search URLs.
- Keeps same-domain links only.
- Scores links for Bangladesh job, overseas work, migration, visa, recruitment, salary, eligibility, and policy-change relevance.
- On a first successful crawl window, searches recent links from the last 30 days when date metadata exists.
- On later crawls, searches from the last successful crawl time when date metadata exists.
- Fetches up to 25 top-scoring pages and sends them through cleaning, AI extraction, validation, dedupe, storage, and indexing.

Use this as the default simplified workflow for ordinary newspaper or paper main URLs.

### Dynamic HTML

Connector:

- `DynamicHTMLConnector`

Behavior:

- Uses Playwright.
- Opens the page in a headless browser.
- Waits for network idle.
- Captures the rendered HTML and page title.

Use this when content requires JavaScript rendering.

### PDF

Connector:

- `PDFNoticeConnector`

Current behavior:

- Performs an HTTP GET on the source URL.
- Uses `trafilatura.extract` over the response text or falls back to a text slice.
- Produces one `FetchedPage`.

Use this for notice-like documents, but this implementation is basic. It should be improved if production PDF parsing matters.

## Robots and User Agent

Most connectors call `is_allowed(source.base_url, settings.crawler_user_agent)` before fetching.

The crawler user agent is configured as:

`OOI-Platform/1.0 (+https://localhost)`

If robots rules reject the URL, the connector returns no pages.

## Manual Crawling From Admin Dashboard

When an admin clicks crawl for a source:

1. Browser calls `/api/admin/sources/{sourceId}/crawl`.
2. Next.js proxy forwards to FastAPI.
3. FastAPI endpoint `trigger_crawl` calls `run_source_crawl.delay(source_id)`.
4. Celery publishes the task to Redis.
5. The worker receives the task.
6. The worker opens a DB session and calls `run_source_ingestion(db, source_id)`.

Relevant code:

- Frontend: `apps/web/components/admin-source-manager.tsx`
- Frontend proxy: `apps/web/app/api/admin/sources/[id]/crawl/route.ts`
- Backend endpoint: `apps/api/app/api/v1/endpoints/admin.py`
- Worker task: `apps/worker/worker/tasks.py`
- Ingestion pipeline: `apps/api/app/ingestion/pipeline.py`

The API does not perform the crawl directly during the admin request. It queues a background job. That keeps the admin UI responsive and prevents long-running fetch/extraction work from blocking HTTP requests.

## Scheduled Crawling

Recurring automation is handled by Celery Beat.

Schedule config:

- `apps/worker/worker/celery_app.py`

Current schedules:

| Task | Schedule | Purpose |
| --- | --- | --- |
| `schedule_active_source_crawls` | every 5 minutes | Finds active sources due for crawling |
| `generate_alert_events` | every 10 minutes | Runs user alert rules against indexed opportunities |
| `cleanup_stale_opportunities` | every 6 hours | Deactivates opportunities past deadline |

The scheduled crawl task does not crawl every source every 5 minutes. It checks each active source and compares its last crawl time against `crawl_frequency_minutes`.

Example:

- Beat runs `schedule_active_source_crawls`.
- Source has `crawl_frequency_minutes = 720`.
- Last crawl started 60 minutes ago.
- Task skips it.
- Once enough time has passed, the task queues `run_source_crawl`.

This means `crawl_frequency_minutes` is the per-source minimum crawl interval.

## Ingestion Pipeline: Every Step

The ingestion pipeline lives in:

- `apps/api/app/ingestion/pipeline.py`

Function:

- `run_source_ingestion(db, source_id)`

### Step 1: Load active source

The pipeline selects the source by ID and only continues if `is_active = true`.

If the source does not exist or is inactive, it raises:

`Source not found or inactive`

### Step 2: Prevent duplicate running crawl

Before doing any fetch work, it checks whether a `CrawlJob` already exists for that source with status `running`.

If a running job exists, the pipeline returns an empty result.

This prevents two workers from crawling the same source simultaneously.

### Step 3: Create crawl job row

The pipeline creates a `crawl_jobs` row:

- `source_id`
- `status = running`
- `started_at = now`

This is what powers the admin crawls page and source last-crawl status.

### Step 4: Choose storage, parser, connector

The pipeline creates:

- `ObjectStorage()`
- parser selected by `parser_key`
- connector selected by `access_method`

The current parser registry maps these keys:

- `default`
- `bd_bmet_default`
- `scholarship_generic`
- `policy_news_default`

All currently resolve to the default parser.

### Step 5: Fetch pages

The connector fetches source data and returns a list of `FetchedPage` objects.

Depending on access method, this could mean:

- JSON records from an API
- RSS feed items
- one static HTML page
- one rendered dynamic HTML page
- one PDF-like notice

The important point: the connector returns normalized page-like objects regardless of source type.

### Step 6: Parse and clean each page

For each fetched page:

1. Parser runs first.
2. Cleaner normalizes page content.
3. Parsed title can override cleaned title.

Cleaner path:

- `apps/api/app/ingestion/cleaner.py`

Cleaner produces:

- `title`
- `body_text`
- `canonical_url`
- `apply_link`
- `content_hash`

The content hash is SHA-256 of cleaned body text.

### Step 7: Deduplicate

Deduplication happens before storage and extraction.

Code:

- `apps/api/app/ingestion/validators.py`
- `is_duplicate`

Duplicate checks:

1. Existing `RawDocument` with same canonical URL.
2. Existing `RawDocument` with same content hash.
3. Similar title compared against recent opportunity titles using `SequenceMatcher`; ratio above `0.9` is treated as duplicate.

If duplicate, the page is skipped.

### Step 8: Store raw snapshot

The pipeline stores the raw HTML or raw text.

Code:

- `apps/api/app/services/storage_service.py`

Storage behavior:

1. Tries to write to MinIO bucket `raw-docs`.
2. If MinIO fails, writes local file under `/workspace/data/raw`.

After storing the snapshot, the pipeline creates a `raw_documents` row with:

- source ID
- source URL
- canonical URL
- content type
- raw text
- raw snapshot path
- metadata JSON
- content hash

This preserves evidence and debug context for later review.

### Step 9: Structured extraction

Code:

- `apps/api/app/ingestion/extractor.py`

The extraction path depends on Groq configuration.

If a Groq API key is configured:

1. The system reads Groq key/model from the database runtime settings first.
2. If not found there, it falls back to `.env`.
3. It calls `ChatGroq`.
4. It asks the model to return structured data matching the extraction schema.

If no Groq API key is configured:

1. The system uses `_fallback_extract`.
2. It takes page title/body.
3. It guesses basic record type based on whether the body contains scholarship-like text.
4. It creates a minimal extraction with confidence `0.55`.

Admin Groq settings are managed from:

- `/admin`
- AI settings card

Backend runtime setting API:

- `GET /api/v1/admin/settings/ai`
- `PATCH /api/v1/admin/settings/ai`

Database table:

- `app_settings`

### Step 10: Validate extraction

Code:

- `apps/api/app/ingestion/validators.py`
- `validate_extraction`

Current checks:

- title must exist
- application URL must be HTTP or HTTPS if present

If validation fails, the extracted record is skipped.

If `record_type = unknown`, the extracted record is skipped.

### Step 11: Parse deadline

Deadline parsing uses `dateutil.parser.parse` with fuzzy parsing.

If parsing fails, deadline is stored as `null`.

### Step 12: Score the opportunity

Code:

- `apps/api/app/services/ranking_service.py`

Scores:

| Score | Meaning |
| --- | --- |
| `trust_score` | Based on source trust tier |
| `freshness_score` | Based on age |
| `actionability_score` | Based on deadline, apply link, requirements |
| `overall_rank_score` | Initial weighted rank at ingestion time |

Trust weights:

| Trust tier | Weight |
| --- | --- |
| `official_gov` | `1.0` |
| `official_partner` | `0.9` |
| `established_portal` | `0.7` |
| `news_only` | `0.45` |

Actionability starts at `0.3` and improves if:

- deadline exists
- application URL exists
- requirements exist

### Step 13: Create opportunity row

The pipeline creates an `opportunities` row with the extracted and scored fields:

- title
- record type
- summary
- country/city
- employer/organization
- sector
- degree level
- salary/funding
- deadline
- application URL
- eligibility
- visa support
- language requirements
- requirements
- benefits
- source reference
- raw document reference
- trust/freshness/actionability/rank scores
- active/inactive status

If the deadline is already past, `is_active` is set to false.

### Step 14: Build lexical search index

The pipeline updates `search_tsv` using Postgres full-text search:

`to_tsvector('english', title + summary + eligibility_text)`

This powers keyword search through `websearch_to_tsquery`.

### Step 15: Build semantic embedding

Code:

- `apps/api/app/services/embedding_service.py`

The current embedding implementation is deterministic hash-based, not a real neural embedding model.

It creates a 1024-dimensional vector from SHA-512 bytes and stores it in:

- `opportunity_embeddings`

This gives the database a vector field for similarity mechanics, but it should be replaced with a real embedding model if semantic search quality matters.

### Step 16: Finish crawl job

At the end, the crawl job is updated:

- `status = success`
- `finished_at = now`
- `pages_fetched = len(pages)`
- `records_extracted = extracted_count`

If an exception occurs in the task, Celery retry behavior applies. Current code logs task failures through `BaseRetryTask`.

## Search Flow

User search is not a crawl. It queries already indexed opportunities.

Frontend:

- `/search`
- `apps/web/app/search/page.tsx`
- `apps/web/lib/api.ts`

Backend:

- `GET /api/v1/opportunities/search`
- `apps/api/app/api/v1/endpoints/opportunities.py`
- `apps/api/app/services/search_service.py`

Search inputs include:

- keyword query `q`
- semantic query `semantic_q`
- record type
- country
- city
- sector
- source class
- trust tier
- visa support
- degree level
- sort
- page
- page size
- saved-only mode

The backend builds a SQL query joining:

- `opportunities`
- `sources`
- optionally `opportunity_embeddings`
- optionally `saved_opportunities`

### Lexical Search

If `q` is present, it computes:

`ts_rank_cd(search_tsv, websearch_to_tsquery('english', q))`

This is normal Postgres full-text search.

### Semantic Search

If `semantic_q` is present:

1. It computes an embedding using `embed_text`.
2. Joins `opportunity_embeddings`.
3. Computes cosine similarity.

Again, current embeddings are hash-based placeholders, not model-quality embeddings.

### Filters

Filters are applied in `_apply_filters`.

Examples:

- country uses `ILIKE`
- city uses `ILIKE`
- sector uses `ILIKE`
- deadline range filters use comparisons
- visa support uses boolean check
- salary min/max uses overlap logic
- active-only defaults to active records

### Ranking

Final score combines:

- actionability score
- freshness score
- trust score
- lexical score
- semantic score

Then multiplies by source trust tier.

Default sort is relevance.

Alternative sorts:

- newest
- deadline
- trust
- salary

## Opportunity Detail Flow

When a user opens an opportunity detail page:

Frontend:

- `/opportunity/[id]`

Backend:

- `GET /api/v1/opportunities/{opportunity_id}`

The API loads the `opportunities` row by ID. Similar opportunities are loaded by:

- `GET /api/v1/opportunities/{opportunity_id}/similar`

Similarity currently means:

- same `record_type`
- ordered by `overall_rank_score`

It is not currently vector-nearest-neighbor similarity.

## Saved Items Flow

Users can save or unsave opportunities.

Backend:

- `POST /api/v1/saved/{opportunity_id}`
- `DELETE /api/v1/saved/{opportunity_id}`
- `GET /api/v1/saved`

Data table:

- `saved_opportunities`

Important behavior:

- A user cannot save a non-existent opportunity.
- Duplicate saves return `"Already saved"`.
- Saved list returns opportunity cards.

The dashboard uses saved items to show the user's shortlist.

## Alerts Flow

Users create alert rules. Alerts are not external email delivery yet; they generate alert event rows.

Backend:

- `POST /api/v1/alerts`
- `GET /api/v1/alerts`
- `PATCH /api/v1/alerts/{alert_id}`
- `DELETE /api/v1/alerts/{alert_id}`

Data tables:

- `alert_rules`
- `alert_events`

When a user creates an alert rule, it stores:

- user ID
- alert name
- query text
- filter JSON
- active flag

Every 10 minutes, Celery Beat schedules:

`generate_alert_events`

The worker:

1. Loads active alert rules.
2. Builds an `OpportunitySearchQuery`.
3. Runs `search_opportunities`.
4. Creates `AlertEvent` rows for matching opportunities.
5. Avoids duplicate events using `(alert_rule_id, opportunity_id)`.
6. Updates `last_run_at`.

Current implementation creates events but does not send email, SMS, push, or in-app notification delivery.

## Copilot Flow

Copilot is retrieval-constrained. It does not browse the internet live.

Backend service:

- `apps/api/app/services/copilot_service.py`

Flow:

1. User asks a natural-language question.
2. `interpret_query` converts rough intent into `OpportunitySearchQuery`.
3. The system searches the local opportunity database.
4. It loads matched opportunities with source and raw document context.
5. If Groq is configured, it asks Groq to answer using only that context.
6. If Groq is not configured, it returns a deterministic fallback answer.
7. Response includes citations.

The prompt explicitly says:

`Use only provided context. If unknown, say unknown.`

So Copilot is intended to explain indexed records, not invent results.

## Groq Configuration Flow

Groq API key and model can be configured from the admin dashboard.

Frontend:

- `/admin`
- `AdminAiSettingsForm`

Frontend proxy:

- `/api/admin/settings/ai`

Backend:

- `GET /api/v1/admin/settings/ai`
- `PATCH /api/v1/admin/settings/ai`

Database:

- `app_settings`

The API key is stored under:

- `groq_api_key`

The model is stored under:

- `groq_model`

Consumers read runtime settings through:

- `get_groq_api_key(db)`
- `get_groq_model(db)`

Priority:

1. database setting from admin dashboard
2. `.env` fallback

The UI never returns the actual saved key back to the browser. It only returns:

- key configured: true/false
- selected model name

## Admin Dashboard Pages

### `/admin`

Shows:

- platform stats
- recent crawls
- AI settings
- source coverage

Main backend endpoint:

- `GET /api/v1/admin/overview`

### `/admin/sources`

Shows:

- source count
- running crawl count
- opportunity count
- raw document count
- source form
- source registry and crawl controls

Main backend endpoints:

- `GET /api/v1/admin/sources`
- `POST /api/v1/admin/sources`
- `PATCH /api/v1/admin/sources/{source_id}`
- `DELETE /api/v1/admin/sources/{source_id}`
- `POST /api/v1/admin/sources/{source_id}/crawl`

### `/admin/crawls`

Shows crawl jobs.

Main backend endpoint:

- `GET /api/v1/admin/crawl-jobs`

### `/admin/review`

Shows low-confidence extracted opportunities.

Main backend endpoint:

- `GET /api/v1/admin/failed-extractions`

Current low-confidence condition:

- `Opportunity.extraction_confidence < 0.45`

## Data Tables and Ownership

### Admin-managed or ingestion-managed

| Table | Created by | Meaning |
| --- | --- | --- |
| `sources` | admin | Approved crawl targets |
| `crawl_jobs` | ingestion pipeline | Crawl run status |
| `raw_documents` | ingestion pipeline | Raw fetched source evidence |
| `opportunities` | ingestion pipeline | User-visible records |
| `opportunity_embeddings` | ingestion/reindex task | Vector data for semantic mechanics |
| `app_settings` | admin | Runtime AI settings |

### User-managed

| Table | Created by | Meaning |
| --- | --- | --- |
| `users` | auth/register/seed/admin script | Platform users |
| `user_profiles` | registration/seed | User preference profile |
| `saved_opportunities` | user action | Saved shortlist |
| `alert_rules` | user action | Saved alert searches |
| `alert_events` | worker | Results generated from alert rules |
| `refresh_tokens` | auth | Session refresh tokens |
| `feedback` | user action/future feature | Feedback on opportunities |

## What Happens When a Source Is Running

If `/admin/sources` shows a source as running:

1. A `crawl_jobs` row exists with status `running`.
2. The worker may be fetching, extracting, storing, or indexing.
3. Source registry displays last known job information.

If it stays running for too long, check:

- worker logs
- API logs
- Redis availability
- MinIO availability
- source network availability
- whether the connector can parse the source
- whether Playwright is installed if using `dynamic_html`

## What Happens If Worker Is Down

User-facing pages can still load if API and Postgres are up.

But these will not execute:

- manually triggered crawls
- scheduled crawls
- alert event generation
- stale opportunity cleanup
- reindex jobs

Admin-triggered jobs may be queued in Redis but sit there until `worker` starts.

## What Happens If Beat Is Down

Manual admin-triggered crawls still work if Redis and worker are up.

But automatic schedules stop:

- active source crawl scheduling
- alert generation
- stale cleanup

## What Happens If Groq Is Not Configured

The platform still works.

Without Groq:

- extraction uses fallback structured extraction
- Copilot returns a generic deterministic answer based on indexed records

With Groq:

- extraction can produce richer structured records
- Copilot can generate natural-language answers from retrieved context

Groq is not required for basic crawling, storage, search, saved items, or alerts.

## What Crawling Can and Cannot Do Today

Can do:

- fetch source URLs configured by admin
- fetch API/RSS/static HTML/dynamic HTML/basic PDF-like notices
- store raw content
- extract structured opportunities
- deduplicate by URL/hash/title similarity
- score and rank records
- index records for search

Cannot do yet:

- discover arbitrary new websites from a user query
- search Google/Bing live
- follow every link recursively
- deeply crawl whole domains
- guarantee high-quality PDF extraction
- use real neural embeddings
- send alert emails or push notifications

## Typical Admin-to-User Scenario

1. Admin signs in.
2. Admin opens `/admin`.
3. Admin saves Groq API key in AI settings if LLM extraction/Copilot answers are needed.
4. Admin opens `/admin/sources`.
5. Admin creates a source:
   - name: DAAD Scholarships
   - base URL: official scholarship page/feed
   - source class: scholarship
   - trust tier: official partner
   - access method: static HTML or RSS
   - frequency: 1440 minutes
   - parser key: scholarship_generic
   - active: true
6. Admin clicks crawl.
7. API queues a Celery task.
8. Worker fetches the source.
9. Pipeline cleans content, stores raw snapshot, extracts structured data, validates it, scores it, stores opportunity rows, and indexes search fields.
10. Admin sees crawl status and extracted counts update.
11. User opens `/search`.
12. User filters for scholarships, country, degree level, etc.
13. Search endpoint queries local Postgres records.
14. User opens a detail page and applies through the original source URL.
15. User saves the opportunity.
16. User creates an alert rule.
17. Beat/worker periodically runs alerts and creates alert events when matching opportunities exist.

## Mental Model

Think of the system as a controlled opportunity intelligence pipeline:

`Admin curation -> scheduled ingestion -> normalized database -> trust-ranked search -> user actions -> alert/Copilot assistance`

The admin decides where data may come from. The worker turns that source content into structured records. Users only interact with the structured, indexed, trust-scored data.

That is the core product idea.
