#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root'; exit 1; }
expected=128.140.89.95
resolved=$(getent ahostsv4 vote.yeshuahigh.com | awk '{print $1}' | sort -u)
[[ "$resolved" == "$expected" ]] || { echo "DNS must resolve only to $expected; currently: $resolved"; exit 1; }
certbot --nginx -d vote.yeshuahigh.com --redirect --non-interactive --agree-tos --register-unsafely-without-email
nginx -t
curl --fail --silent --show-error https://vote.yeshuahigh.com/api/health
