# Ingestion Flow

## Step A - Scheduler
- Celery Beat task: `schedule_active_source_crawls`.
- Applies active flag, per-source frequency, and running-job lock checks.

## Step B - Connectors
- `APISourceConnector`
- `RSSSourceConnector`
- `StaticHTMLConnector`
- `DynamicHTMLConnector`
- `PDFNoticeConnector`

## Step C - Cleaning
- Trafilatura boilerplate stripping.
- Stores raw snapshot in MinIO/local storage.
- Computes content hash.

## Step D - AI Extraction
- LangChain + Groq structured output schema.
- Types: job, scholarship, policy update, unknown.
- Never guesses salary/visa/eligibility.

## Step E - Validation and Scoring
- Required title validation.
- Application URL validation.
- Deadline parse checks.
- Duplicate checks by URL/hash/title similarity.
- Trust/freshness/actionability scoring.
- Deadline-based active/inactive status.

## Step F - Indexing
- Update TSVECTOR lexical index.
- Generate deterministic embedding vectors.
- Upsert pgvector embeddings.
