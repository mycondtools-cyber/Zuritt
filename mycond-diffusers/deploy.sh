#!/bin/bash
#
# airflow.mycond.eu — підтягнути останню версію з GitHub і перезапустити контейнери.
#
# Usage: sudo /www/repos/airflow/deploy.sh [--branch <name>] [--seed]
#
# Тіло в main(), щоб git reset посеред виконання не зламав скрипт, який зараз читає bash.

set -euo pipefail

main() {
  local REPO_DIR BRANCH="main" SEED=0
  REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --branch) BRANCH="$2"; shift 2 ;;
      --seed)   SEED=1; shift ;;
      -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
      *) echo "Unknown option: $1" >&2; exit 2 ;;
    esac
  done

  log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
  cd "$REPO_DIR"
  [[ -f .env ]] || { echo ".env not found in $REPO_DIR (cp .env.example .env)" >&2; exit 1; }

  log "Fetching $BRANCH from origin"
  git fetch --prune origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
  log "Now at $(git rev-parse --short HEAD)"

  log "Build & restart"
  docker compose up -d --build --remove-orphans

  if [[ "$SEED" -eq 1 ]]; then
    log "Seed catalogue (ціни з адмінки не перезаписуються)"
    docker compose exec -T app npm run db:seed
  fi

  log "Prune old images"
  docker image prune -f >/dev/null

  log "Deploy complete: $(git rev-parse --short HEAD)"
}

main "$@"
