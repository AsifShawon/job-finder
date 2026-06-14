# Deployment

This project has separate Docker Compose overlays for local development and production on an Ubuntu VPS behind FASTPANEL Reverse Proxy.

Docker services communicate internally by service name:

- Postgres: `postgres:5432`
- Redis: `redis:6379`
- API: `api:8000`
- MinIO: `minio:9000`
- SearXNG: `searxng:8080`

Production does not bind Docker services to public `80` or `443`. FASTPANEL owns public HTTP/HTTPS and proxies to localhost ports on the VPS.

## Local Development

Create your local env file:

```sh
cp .env.local.example .env.local
```

Start the full local stack:

```sh
sh scripts/local-up.sh
```

Equivalent raw Compose command:

```sh
docker compose --env-file .env.local -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local.yml up --build
```

Local URLs:

- Web: `http://localhost:3000`
- API readiness: `http://localhost:8000/ready`
- API docs: `http://localhost:8000/docs`
- Flower: `http://localhost:5555`
- MinIO console: `http://localhost:9001`
- SearXNG: `http://localhost:8080`
- Postgres: `localhost:5432`
- Redis: `localhost:6380`

Stop local containers:

```sh
sh scripts/local-down.sh
```

To also remove local named volumes:

```sh
sh scripts/local-down.sh --volumes
```

## VPS First Deployment

SSH into the VPS:

```sh
ssh root@YOUR_VPS_IP
```

Install Docker Engine and the Docker Compose plugin if they are not already installed.

Clone the repository into `/opt/apps/ooi`:

```sh
sudo mkdir -p /opt/apps
sudo chown "$USER":"$USER" /opt/apps
git clone YOUR_GITHUB_REPO_URL /opt/apps/ooi
cd /opt/apps/ooi
```

Create production env:

```sh
cp .env.prod.example .env.prod
nano .env.prod
```

Replace at least:

- `SECRET_KEY`
- `POSTGRES_PASSWORD`
- `DATABASE_URL` password segment
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `NEXT_PUBLIC_API_BASE_URL=https://api.example.com`
- `WEB_BASE_URL=https://app.example.com`
- AI/API keys you need, such as `GROQ_API_KEY`, `MISTRAL_API_KEY`, or `AI_API_KEY`
- SMTP values if email alerts should send mail

Start production:

```sh
sh scripts/prod-up.sh
```

Equivalent raw Compose command:

```sh
docker compose --env-file .env.prod -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml up -d --build
```

The script also starts dependencies, runs `alembic upgrade head`, starts the full stack, and prints container status.

## VPS Smoke Tests

Check containers:

```sh
docker compose --env-file .env.prod -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.prod.yml ps
```

Check local upstreams from the VPS:

```sh
curl http://127.0.0.1:3001
curl http://127.0.0.1:8001/ready
```

## FASTPANEL Reverse Proxy

Create two sites/domains in FASTPANEL and configure Reverse Proxy upstreams:

- App domain: `app.example.com`
  - Upstream: `http://127.0.0.1:3001`
- API domain: `api.example.com`
  - Upstream: `http://127.0.0.1:8001`

Enable SSL/HTTPS in FASTPANEL for both domains, typically through the SSL certificate or Let's Encrypt section for each site. Keep Docker off public ports `80` and `443`; FASTPANEL should be the only public HTTP/HTTPS entrypoint.

After DNS and SSL are ready, verify:

```sh
curl https://app.example.com
curl https://api.example.com/ready
```

## Logs And Operations

Follow all production logs:

```sh
sh scripts/prod-logs.sh
```

Follow one service:

```sh
sh scripts/prod-logs.sh api
sh scripts/prod-logs.sh web
sh scripts/prod-logs.sh worker
```

Restart the production stack:

```sh
sh scripts/prod-down.sh
sh scripts/prod-up.sh
```

Update after pushing new GitHub code:

```sh
cd /opt/apps/ooi
sh scripts/prod-update.sh
```

The update script runs:

- `git pull --ff-only`
- `docker compose build`
- dependency container startup
- `alembic upgrade head`
- service restart with `--remove-orphans`
- `docker compose ps`

## Production Port Policy

Production published ports are localhost-only:

- Web: `127.0.0.1:3001 -> web:3000`
- API: `127.0.0.1:8001 -> api:8000`
- Flower: `127.0.0.1:5555 -> flower:5555`
- MinIO API: `127.0.0.1:9000 -> minio:9000`
- MinIO console: `127.0.0.1:9001 -> minio:9001`

Postgres, Redis, and SearXNG are not published in production.

## Security Checklist

Before production traffic, verify:

- `POSTGRES_PASSWORD` is not `ooi`, `password`, or a placeholder.
- Postgres has no production `ports:` entry and is not reachable publicly.
- Redis has no production `ports:` entry and is not reachable publicly.
- SearXNG has no production `ports:` entry unless you explicitly decide to expose it.
- `NEXT_PUBLIC_API_BASE_URL` is not `localhost` or `127.0.0.1`; it should be the public API domain such as `https://api.example.com`.
- `SERVER_API_BASE_URL` stays internal as `http://api:8000`.
- MinIO root credentials are not `minioadmin/minioadmin`.
- `SECRET_KEY` is a long random production secret.
- Required AI keys are configured if Copilot or AI extraction should work.
- SMTP credentials are configured if email alerts should send mail.
- FASTPANEL SSL is enabled for both app and API domains.
