#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
if [[ "$target" != "test" && "$target" != "prod" ]]; then
  echo "Usage: scripts/deploy-backend.sh test|prod" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

branch="$(git branch --show-current)"
if [[ -z "$branch" ]]; then
  echo "Deploy blocked: not on a named git branch." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Deploy blocked: working tree must be clean before deploying." >&2
  git status --short
  exit 1
fi

remote_host="${LINKA_DEPLOY_HOST:-root@123.56.163.63}"

case "$target" in
  test)
    remote_dir="/root/Linka-test"
    service_name="linka-test.service"
    health_port="3001"
    ;;
  prod)
    if [[ "$branch" != "main" ]]; then
      echo "Deploy blocked: production deploys must run from main. Current branch: $branch" >&2
      exit 1
    fi
    remote_dir="/root/Linka"
    service_name="linka.service"
    health_port="3000"
    ;;
esac

echo "Deploying $branch to $target backend on $remote_host"
pnpm build

rsync -az --delete \
  --exclude='node_modules' \
  --exclude='.pnpm-store' \
  --exclude='.DS_Store' \
  --exclude='data.db*' \
  --exclude='data/' \
  --exclude='data.archived-*' \
  --exclude='.git' \
  --exclude='web/dist' \
  --exclude='web/node_modules' \
  --exclude='.claude' \
  --exclude='.superpowers' \
  --exclude='.agents' \
  --exclude='skills-lock.json' \
  --exclude='mini-wx/project.config.json' \
  --exclude='mini-wx/project.private.config.json' \
  ./ "$remote_host:$remote_dir/"

ssh "$remote_host" "pnpm --dir '$remote_dir' install --prod && systemctl restart '$service_name' && systemctl is-active '$service_name'"

for attempt in {1..10}; do
  if ssh "$remote_host" "curl -fsS 'http://127.0.0.1:$health_port/health'"; then
    echo
    exit 0
  fi
  sleep 1
done

echo "Deploy failed: health check did not pass for $service_name on port $health_port." >&2
exit 1
