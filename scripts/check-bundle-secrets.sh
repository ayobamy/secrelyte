#!/usr/bin/env bash
# scripts/check-bundle-secrets.sh
#
# Gate: no server secret VALUE may appear in anything served to a browser.
# (Definition of Done, "the five that override everything", item 2.)
#
# Two layers:
# 1. Format patterns: key shapes for every server secret this app uses. They match key values,
#    not key names: @supabase/supabase-js ships the bare prefix `sb_secret_` in its own
#    `isNewApiKey` check (src/lib/fetch.ts), so a name-based grep is red on every build.
# 2. Exact values: every value a server secret has, as `next build` sees it and as written in
#    each env file, is searched for literally. This catches formats no pattern covers, such as
#    the 64-hex session secret and blind-index pepper.
#
# Supabase key formats per https://supabase.com/docs/guides/api/api-keys (read 2026-09-21):
# new-format keys are short non-JWT strings after the prefix; legacy keys are JWTs beginning
# `eyJ`. Suffix charsets are not published, so the patterns stay loose on charset and length.
#
# Failures name the pattern or the variable and the file, never the matched text, so a
# failure cannot print a secret into a CI log.
#
# Usage: check-bundle-secrets.sh [dir...]
#   With no arguments: .next/static (every file) plus everything Next prerenders and serves
#   as-is: the HTML, RSC, route-handler body and header (.meta) files under .next/server/app,
#   and the HTML pages (404, 500) under .next/server/pages. With directories: every file in
#   each. SECRELYTE_BUILD_DIR replaces .next, so the tests can build a fake output tree.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIST="$(mktemp)"
# The secret values being searched for, for this run only: mktemp creates it readable by this
# user alone, and the trap below deletes it on any exit.
VALUES="$(mktemp)"
trap 'rm -f "$LIST" "$VALUES"' EXIT
BUILD="${SECRELYTE_BUILD_DIR:-.next}"

if [ "$#" -gt 0 ]; then
  for dir in "$@"; do
    if [ ! -d "$dir" ]; then
      echo "FAIL: $dir missing."
      exit 1
    fi
    find "$dir" -type f >>"$LIST"
  done
else
  if [ ! -d "$BUILD/static" ]; then
    echo "FAIL: $BUILD/static missing. Run pnpm build first."
    exit 1
  fi
  find "$BUILD/static" -type f >>"$LIST"
  if [ -d "$BUILD/server/app" ]; then
    find "$BUILD/server/app" -type f \
      \( -name '*.html' -o -name '*.rsc' -o -name '*.body' -o -name '*.meta' \) >>"$LIST"
  fi
  if [ -d "$BUILD/server/pages" ]; then
    find "$BUILD/server/pages" -type f -name '*.html' >>"$LIST"
  fi
fi

# Prints the files in $LIST matching extended regex $1 (or fixed string with $2 = -F).
matching_files() {
  local mode="${2:--E}"
  tr '\n' '\0' <"$LIST" | xargs -0 grep -l "$mode" -- "$1" 2>/dev/null || true
}

STATUS=0
report() {
  local what="$1" found="$2"
  if [ -n "$found" ]; then
    echo "FATAL: $what in the client bundle:"
    echo "$found" | sed 's/^/  /'
    STATUS=1
  fi
}

# Layer 1: formats. A non-word character (or start of line) before the prefix keeps a
# minified identifier that merely contains it from matching.
B='(^|[^A-Za-z0-9_])'
PATTERNS=(
  "Supabase secret key value:${B}sb_secret_[A-Za-z0-9_-]{8,}"
  "legacy JWT api key:eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\."
  'decoded service_role claim:"role"[[:space:]]*:[[:space:]]*"service_role"'
  "Anthropic API key value:${B}sk-ant-[A-Za-z0-9_-]{16,}"
  "Resend API key value:${B}re_[A-Za-z0-9_]{20,}"
  "webhook signing secret value:${B}whsec_[A-Za-z0-9+/=]{16,}"
)
for entry in "${PATTERNS[@]}"; do
  report "${entry%%:*}" "$(matching_files "${entry#*:}")"
done

# Layer 2: exact values. Server-only variables from lib/env.server.ts plus the database URL.
SERVER_VARS=(
  SUPABASE_SECRET_KEY
  SUPABASE_DB_URL
  ANTHROPIC_API_KEY
  RESEND_API_KEY
  RESEND_WEBHOOK_SECRET
  SHARE_SESSION_SECRET
  EMAIL_BLIND_INDEX_PEPPER
  UPSTASH_REDIS_REST_TOKEN
)

# Variables a server secret may be built from whose values are public by design, so finding
# them in the bundle is not a leak. Every other variable a server value refers to is scanned,
# whatever its name: a NEXT_PUBLIC_ prefix only says a value ships, not that it should, and
# moving a secret into a NEXT_PUBLIC_ name is how secrets usually reach a Next bundle. Add a
# name here only when its value is meant to ship.
PUBLIC_REFERENCES=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  NEXT_PUBLIC_APP_URL
  SUPABASE_PROJECT_REF
)

# Where the env files live. SECRELYTE_ENV_DIR replaces the project root, so the tests can point
# at fixtures instead of a developer's real files.
ENV_DIR="${SECRELYTE_ENV_DIR:-.}"

# Writes NAME NUL VALUE NUL for every distinct value a server variable has, from two readings:
# 1. What `next build` sees: Next's own loader (@next/env) over the environment and
#    .env.production.local, .env.local, .env.production and .env, with its precedence, its
#    `${VAR}` expansion and its `KEY: value` form.
# 2. Every value written in each of those files, including values a higher-precedence file
#    overrides (a secret is a secret wherever it is written down), read twice: by Node's
#    built-in dotenv parser and by the loader Next uses, file by file, since the two disagree
#    on some malformed files. Neither runs the file as shell.
# A server value built from another variable (`postgres://u:${DB_PASSWORD}@...`) also gets that
# variable's values scanned, whatever it is called, and so on through every level of reference,
# public variables included; only names on the PUBLIC_REFERENCES list are left out. A multi-line
# value (a PEM key) is scanned line by line, since grep -F would read each line as a separate
# pattern; its BEGIN and END armor lines are public and skipped. Values under 16 characters are
# dropped: they would match by accident, and real secrets are long.
READ_VALUES='
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
if (typeof parseEnv !== "function") {
  console.error("FAIL: reading the env files needs Node 20.12 or later.");
  process.exit(2);
}
const next = require.resolve("next/package.json");
const nextEnv = require.resolve("@next/env", { paths: [next] });
const { loadEnvConfig } = require(nextEnv);
const [names, publicNames, dir] = process.argv.slice(1);
const isPublic = new Set(publicNames.split(",").filter(Boolean));
const quiet = { info() {}, error() {} };
const built = loadEnvConfig(dir, false, quiet, true).combinedEnv;
// parseEnv does not read the `KEY: value` form Next accepts, so such lines are rewritten to
// `KEY=value` first: only lines that start an entry, never a line inside a quoted value that
// spans several lines. Quotes are tracked the way parseEnv reads them: no escapes, and an
// opening quote not closed on its line runs to the next same quote anywhere later, or, when
// there is none, is a plain one-line value.
// A colon must follow the key directly, as in the loader Next uses: `KEY : value` is no entry.
const entry = /^(\s*(?:export\s+)?[\w.-]+)([ \t]*=|:[ \t]+)(.*)$/;
const quotes = ["\"", "\u0027", "`"];
function rewriteColonForm(text) {
  // Line endings as the loader Next uses reads them: CRLF and a lone CR (old Mac files) both
  // end a line. parseEnv would drop a lone CR and join the two lines instead.
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const match = entry.exec(lines[i]);
    if (!match) continue;
    if (match[2].startsWith(":")) lines[i] = `${match[1]}=${match[3]}`;
    const value = match[3].trimStart();
    const quote = value[0];
    if (!quotes.includes(quote) || value.indexOf(quote, 1) !== -1) continue;
    const closing = lines.findIndex((line, j) => j > i && line.includes(quote));
    if (closing !== -1) i = closing;
  }
  return lines.join("\n");
}
// The same file as the loader Next uses reads it on its own. The two parsers disagree on some
// malformed files (an unclosed quote: parseEnv reads on to the next quote anywhere, Next reads
// one line), and a value either one sees is scanned. Every $ is escaped first, so Next returns
// values exactly as written: references are found in them like in the other reading, and no
// value is expanded against this one file alone. It runs in a child process whose environment
// holds only PATH and NODE_ENV, so the variables already set here do not shadow the file, and
// the file goes in on stdin, never in a command line or a copy on disk. A loader error, or any
// failure of the child, fails the gate.
const NEXT_READER = `
const { processEnv } = require(process.argv[1]);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const files = [{ path: ".env", contents: input }];
  processEnv(files, undefined, { info() {}, error() { process.exit(3); } }, true);
  process.stdout.write(JSON.stringify(files[0].env ?? {}));
});`;
function readAsNext(file, text) {
  const child = spawnSync(process.execPath, ["-e", NEXT_READER, nextEnv], {
    input: text.split("$").join("\\$"),
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "production" },
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (child.status !== 0) {
    const why = child.error?.code ?? child.signal ?? `exit ${child.status}`;
    console.error(`FAIL: the loader Next uses could not read ${path.basename(file)} (${why}).`);
    process.exit(2);
  }
  return JSON.parse(child.stdout);
}
// Each file is read once, and both readings come from that one read.
const files = [".env.production.local", ".env.local", ".env.production", ".env"]
  .map((name) => path.join(dir, name))
  .filter((file) => existsSync(file))
  .flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return [parseEnv(rewriteColonForm(text)), readAsNext(file, text)];
  });
const valuesOf = (name) => [built[name], ...files.map((file) => file[name])];
const seen = new Set();
// Output is NAME NUL VALUE NUL, so a NUL inside a value would shift every pair after it: a
// value could be read as a name and printed. A value is split at NUL as at a newline.
function emit(label, value) {
  for (const line of String(value ?? "").split(/\r?\n|\0/)) {
    const text = line.trim();
    if (text.length < 16 || /^-----(BEGIN|END) [A-Z0-9 ]+-----$/.test(text)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    process.stdout.write(`${label}\0${text}\0`);
  }
}
// Every variable a value refers to, and every variable those refer to, once each, through
// public variables too: NEXT_PUBLIC_X=${DB_PASSWORD} is a leak that runs through one.
function references(name) {
  const found = new Set();
  const queue = [name];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const raw of files.map((file) => file[current])) {
      for (const [, ref] of String(raw ?? "").matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g)) {
        if (ref === name || found.has(ref)) continue;
        found.add(ref);
        queue.push(ref);
      }
    }
  }
  return found;
}
for (const name of names.split(",")) {
  for (const value of valuesOf(name)) emit(name, value);
  for (const ref of references(name)) {
    // Only an allowlisted value ships by design.
    if (isPublic.has(ref)) continue;
    for (const value of valuesOf(ref)) emit(`${ref} (used in ${name})`, value);
  }
}'
# Production mode, as `next build` runs: under NODE_ENV=test Next reads different files.
NODE_ENV=production node -e "$READ_VALUES" "$(IFS=,; printf '%s' "${SERVER_VARS[*]}")" \
  "$(IFS=,; printf '%s' "${PUBLIC_REFERENCES[*]}")" "$ENV_DIR" >"$VALUES"

scanned=0
# Names come from SERVER_VARS or from references in env files. Anything else here means the
# stream is out of step, and the field could be a value: stop without printing it.
NAME_SHAPE='^[A-Za-z_][A-Za-z0-9_]*( \(used in [A-Za-z_][A-Za-z0-9_]*\))?$'
while IFS= read -r -d '' name && IFS= read -r -d '' value; do
  if ! [[ "$name" =~ $NAME_SHAPE ]]; then
    echo "FAIL: the env reader produced a malformed entry; nothing was printed from it."
    exit 2
  fi
  scanned=$((scanned + 1))
  report "the value of $name" "$(matching_files "$value" -F)"
done <"$VALUES"

if [ "$STATUS" -ne 0 ]; then
  exit 1
fi
echo "bundle clean ($(wc -l <"$LIST" | tr -d ' ') files, $scanned secret values checked)"
