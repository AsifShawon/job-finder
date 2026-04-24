# Data Model

Core tables:
- `sources`
- `crawl_jobs`
- `raw_documents`
- `opportunities`
- `opportunity_embeddings`
- `users`
- `user_profiles`
- `saved_opportunities`
- `alert_rules`
- `alert_events`
- `feedback`
- `refresh_tokens`

## Search Fields
- `opportunities.search_tsv` (GIN index) for lexical retrieval.
- `opportunity_embeddings.embedding` (HNSW) for semantic retrieval.
- Filter indexes on `record_type`, `country/city`, `deadline`, `is_active`, `overall_rank_score`.

## Trust and Ranking
- Source trust tier mapped to numeric weights.
- Final rank combines trust, freshness, lexical score, semantic score, actionability.

## Deduplication
- Canonical URL match.
- Content hash match.
- Title similarity threshold for near duplicates.
