#!/usr/bin/env bash
set -euo pipefail

# Cursor command hook: reads JSON from stdin (ignored here).
cat >/dev/null || true

PATCH_NOTES_FILE="Patch-notes.md"
NOW_DATE="$(date +%F)"

if [[ ! -f "$PATCH_NOTES_FILE" ]]; then
  # Nothing to update; allow session end.
  echo '{ "permission": "allow" }'
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo '{ "permission": "allow" }'
  exit 0
fi

# Collect a lightweight summary. Keep it robust and small.
STATUS_PORCELAIN="$(git status --porcelain 2>/dev/null || true)"
CHANGED_FILES="$(echo "$STATUS_PORCELAIN" | awk '{print $2}' | sed '/^$/d' | head -n 30)"

# Optional: short stat summary (can be empty).
DIFF_STAT="$(git diff --stat 2>/dev/null | head -n 20 || true)"

HUMAN_LINE="We automatically logged this session’s code changes so it’s easy to track progress without touching the UI."

{
  echo ""
  echo "## ${NOW_DATE} — Session auto-log (no UI changes)"
  echo ""
  echo "### Technical notes"
  if [[ -n "${CHANGED_FILES}" ]]; then
    echo "- **Changed files (up to 30):**"
    echo "${CHANGED_FILES}" | sed 's/^/- `/' | sed 's/$/`/'
  else
    echo "- **Changed files:** none detected (clean working tree)."
  fi
  if [[ -n "${DIFF_STAT}" ]]; then
    echo "- **Diff stat (top 20):**"
    echo '```'
    echo "${DIFF_STAT}"
    echo '```'
  fi
  echo ""
  echo "### Human terms (non-technical)"
  echo "${HUMAN_LINE}"
  echo ""
} >>"$PATCH_NOTES_FILE"

echo '{ "permission": "allow" }'
exit 0

