#!/usr/bin/env bash
set -euo pipefail
for _ in {1..30}; do
    if curl -fsS http://127.0.0.1:8082/api/health >/dev/null 2>&1; then exit 0; fi
    sleep 1
done
exit 1
