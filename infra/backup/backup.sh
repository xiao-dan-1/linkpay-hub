#!/bin/sh
set -eu

backup_once() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="/backups/${PGDATABASE}_${timestamp}.dump.gz"
  pg_dump --format=custom --no-owner --no-privileges | gzip -9 > "$target"
  find /backups -type f -name '*.dump.gz' -mtime "+${BACKUP_RETENTION_DAYS:-7}" -delete
  echo "backup created: $target"
}

if [ "${1:-}" = "--loop" ]; then
  while true; do
    backup_once
    sleep 86400
  done
else
  backup_once
fi

