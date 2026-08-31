#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/marginmatch-$STAMP.sql.gz"
TMP="$FILE.tmp"

mkdir -p "$BACKUP_DIR"
rm -f "$TMP"

if pg_dump "$DATABASE_URL" | gzip > "$TMP" && gzip -t "$TMP" && test -s "$TMP"; then
  mv "$TMP" "$FILE"
  echo "BACKUP VERIFIED: $FILE"
else
  rm -f "$TMP"
  echo "BACKUP FAILED" >&2
  exit 1
fi

find "$BACKUP_DIR" -type f -name 'marginmatch-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
