#!/usr/bin/env bash
# Run as the vote user: vote-mode warm|ondemand
set -euo pipefail
mode=${1:?Specify warm or ondemand}
target="$HOME/.config/containers/systemd/vote.container"
source="$HOME/.config/vote/vote.container.warm"
case "$mode" in
    warm) cp "$source" "$target" ;;
    ondemand)
        awk '/^\[Unit\]$/ {print; print "StopWhenUnneeded=yes"; next} /^WantedBy=default.target$/ {next} {print}' "$source" > "$target"
        ;;
    *) echo 'Specify warm or ondemand' >&2; exit 1 ;;
esac
# Podman 4.9 does not consume newer Quadlet drop-in syntax.
rm -f "$HOME/.config/containers/systemd/vote.container.d/20-ondemand.conf"
systemctl --user daemon-reload
systemctl --user stop vote-proxy.service vote.service
systemctl --user enable --now vote-proxy.socket
if [[ $mode == warm ]]; then systemctl --user start vote.service; fi
echo "Voting mode: $mode"
