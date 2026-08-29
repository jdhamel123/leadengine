#!/bin/sh
set -eu

STATE_DIR="${RELEASE_STATE_DIR:-.release}"
CURRENT_FILE="$STATE_DIR/current-version"
PREVIOUS_FILE="$STATE_DIR/previous-version"

if [ -z "${IMAGE_REPOSITORY:-}" ]; then
  echo "IMAGE_REPOSITORY is required" >&2
  exit 3
fi
if [ ! -f "$PREVIOUS_FILE" ]; then
  echo "No previous release recorded." >&2
  exit 4
fi

CURRENT="$(cat "$CURRENT_FILE" 2>/dev/null || true)"
PREVIOUS="$(cat "$PREVIOUS_FILE")"
export APP_IMAGE="${IMAGE_REPOSITORY}:${PREVIOUS}"

docker compose pull app
docker compose up -d app
printf '%s' "$PREVIOUS" > "$CURRENT_FILE"
if [ -n "$CURRENT" ]; then printf '%s' "$CURRENT" > "$PREVIOUS_FILE"; fi

sleep "${RELEASE_HEALTH_DELAY_SECONDS:-5}"
npm exec -- tsx scripts/healthcheck-deep.ts

echo "Rolled back to $PREVIOUS."
