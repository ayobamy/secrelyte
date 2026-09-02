#!/usr/bin/env bash
# scripts/check-next-version.mjs is the JS version; this wrapper exists for the verify script.
set -euo pipefail
node "$(dirname "$0")/check-next-version.mjs"
