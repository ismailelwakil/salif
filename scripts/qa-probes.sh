#!/usr/bin/env bash
# سلف — preview / staging probes. Fails the job if a core route is down.
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
BASE="${BASE%/}"

need() {
  local name="$1" url="$2" expect="$3"
  local body
  body="$(curl -fsS --max-time 20 "$url")" || { echo "FAIL  $name  (curl)"; exit 1; }
  if ! printf '%s' "$body" | grep -q "$expect"; then
    echo "FAIL  $name  (missing: $expect)"
    printf '%s\n' "$body" | head -c 300
    echo
    exit 1
  fi
  echo "PASS  $name"
}

need health      "$BASE/api/health"            '"ok":true'
need bootstrap   "$BASE/api/bootstrap"         '"listings"'
need search      "$BASE/api/search?q=drill"    '"listings"'
need locations   "$BASE/api/locations"         'Shanawan'
need available   "$BASE/api/available?start=2026-12-01&end=2026-12-02" '"listings"'
need home        "$BASE/"                      'سلف'
echo "QA probes passed against $BASE"
