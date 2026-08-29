#!/bin/sh
set -eu

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: restore-postgres.sh /backups/marginmatch-YYYYMMDDTHHMMSSZ.sql.gz" >&2
  exit 2
fi

echo "Refusing destructive restore unless ALLOW_DATABASE_RESTORE=true."
if [ "${ALLOW_DATABASE_RESTORE:-false}" != "true" ]; then
  exit 3
fi

gunzip -c "$FILE" | psql "$DATABASE_URL"
echo "Restore completed from: $FILE"
