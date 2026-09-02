#!/usr/bin/env bash
# 0.3: a planted fake key is blocked. Uses a throwaway dir, never the repo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "FAIL: gitleaks is not installed"
  exit 1
fi

# Git history only. Untracked .env.local is not in the log.
set +e
gitleaks detect --config "$ROOT/gitleaks.toml" --redact --log-opts="--all"
HISTORY_STATUS=$?
set -e
if [ "$HISTORY_STATUS" -eq 1 ]; then
  echo "FAIL: gitleaks found a leak in git history"
  exit 1
fi
if [ "$HISTORY_STATUS" -ne 0 ]; then
  echo "FAIL: gitleaks history scan exited $HISTORY_STATUS"
  exit 1
fi
gitleaks version >/dev/null

# Plant a Secrelyte-only marker. Do not put Slack/AWS/GitHub token shapes in git.
PLANT="$(mktemp -d)"
trap 'rm -rf "$PLANT"' EXIT
chunk='aaaaaaaaaa'
printf 'SECRELYTE_PLANTED=%s\n' "${chunk}${chunk}${chunk}${chunk}" > "$PLANT/leaked.env"

set +e
gitleaks detect --config "$ROOT/gitleaks.toml" --source "$PLANT" --no-git --redact \
  >/tmp/secrelyte-gitleaks-plant.txt 2>&1
STATUS=$?
set -e

if [ "$STATUS" -eq 0 ]; then
  echo "FAIL: gitleaks did not block the planted marker"
  cat /tmp/secrelyte-gitleaks-plant.txt
  exit 1
fi

echo "OK: planted fake key is blocked (exit $STATUS)"
