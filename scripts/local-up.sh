#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env.local ]; then
  echo "Missing .env.local. Create it first:"
  echo "  cp .env.local.example .env.local"
  exit 1
fi

docker compose --env-file .env.local \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.local.yml \
  up --build
