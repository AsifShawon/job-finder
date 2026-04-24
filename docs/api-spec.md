# API Spec (V1)

Base prefix: `/api/v1`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Opportunities
- `GET /opportunities/search`
- `GET /opportunities/{id}`
- `GET /opportunities/{id}/similar`
- `GET /opportunities/{id}/source`

## Copilot
- `POST /copilot/query`
- `POST /copilot/compare`
- `POST /copilot/explain-match`

## Saved
- `POST /saved/{opportunity_id}`
- `DELETE /saved/{opportunity_id}`
- `GET /saved`

## Alerts
- `POST /alerts`
- `GET /alerts`
- `PATCH /alerts/{id}`
- `DELETE /alerts/{id}`

## Admin
- `GET /admin/sources`
- `POST /admin/sources`
- `PATCH /admin/sources/{id}`
- `POST /admin/sources/{id}/crawl`
- `GET /admin/crawl-jobs`
- `GET /admin/raw-documents/{id}`
- `GET /admin/failed-extractions`
- `POST /admin/reindex/{opportunity_id}`

## Health
- `GET /health`
- `GET /ready`
