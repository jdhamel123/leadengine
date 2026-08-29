#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/marginmatch-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" | gzip -9 > "$FILE"

find "$BACKUP_DIR" -type f -name 'marginmatch-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup written: $FILE"
