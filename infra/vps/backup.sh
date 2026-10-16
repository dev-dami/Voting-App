#!/usr/bin/env bash
set -euo pipefail
umask 077
exec 9>"$HOME/.config/vote/backup.lock"
flock -n 9 || exit 0
out="$HOME/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$out"
# Briefly stop writes so the SQLite snapshot and uploaded photos match.
systemctl --user stop vote.service
trap 'systemctl --user start vote.service' EXIT
data=$(podman volume inspect yhs-vote-data --format '{{.Mountpoint}}')
uploads=$(podman volume inspect yhs-vote-uploads --format '{{.Mountpoint}}')
sqlite3 "$data/voting.db" ".backup '$out/voting.db'"
[[ $(sqlite3 "$out/voting.db" 'PRAGMA integrity_check;') == ok ]]
tar -C "$uploads" -czf "$out/uploads.tar.gz" .
find "$HOME/backups" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf -- {} +
