#!/bin/sh
set -eu

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: promote-release.sh <version>" >&2
  exit 2
fi

if [ -z "${IMAGE_REPOSITORY:-}" ]; then
  echo "IMAGE_REPOSITORY is required" >&2
  exit 3
fi

TARGET_IMAGE="${IMAGE_REPOSITORY}:${VERSION}"
PREVIOUS_FILE="${RELEASE_STATE_DIR:-.release}/previous-version"
CURRENT_FILE="${RELEASE_STATE_DIR:-.release}/current-version"

mkdir -p "${RELEASE_STATE_DIR:-.release}"
if [ -f "$CURRENT_FILE" ]; then
  cp "$CURRENT_FILE" "$PREVIOUS_FILE"
fi
printf '%s' "$VERSION" > "$CURRENT_FILE"

export APP_IMAGE="$TARGET_IMAGE"
docker compose pull app
docker compose up -d app
sleep "${RELEASE_HEALTH_DELAY_SECONDS:-5}"

if ! npm exec -- tsx scripts/healthcheck-deep.ts; then
  echo "Health check failed for $VERSION; rolling back." >&2
  if [ -f "$PREVIOUS_FILE" ]; then
    PREVIOUS="$(cat "$PREVIOUS_FILE")"
    export APP_IMAGE="${IMAGE_REPOSITORY}:${PREVIOUS}"
    printf '%s' "$PREVIOUS" > "$CURRENT_FILE"
    docker compose pull app
    docker compose up -d app
  fi
  exit 10
fi

echo "Release $VERSION promoted successfully."
