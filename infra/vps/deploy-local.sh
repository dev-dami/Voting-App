#!/usr/bin/env bash
# Run as root on this shared VPS after building the image; never edits DNS.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root'; exit 1; }
image=${1:?Usage: deploy-local.sh localhost/yhs-voting:TAG}
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
vote_uid=$(id -u vote)
vr() { runuser -u vote -- env XDG_RUNTIME_DIR="/run/user/$vote_uid" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$vote_uid/bus" bash -c 'cd "$HOME"; exec "$@"' bash "$@"; }
install -d -o vote -g vote /home/vote/.config/containers/systemd /home/vote/.config/systemd/user /home/vote/.config/vote /home/vote/.local/bin
chown vote:vote /home/vote/.local /home/vote/.config
chmod 700 /home/vote/.config/vote
[[ -s /home/vote/.config/vote/production.env ]] || { echo 'Create production.env first (see DEPLOY.md)'; exit 1; }
exec 9>/run/lock/yhs-vote-deploy.lock
flock -n 9 || { echo 'Deployment already in progress'; exit 1; }
archive=$(mktemp /var/tmp/vote-image.XXXXXX.tar)
extract=$(podman create "$image")
staging=$(mktemp -d /srv/yhs-vote-release.XXXXXX)
cleanup() { podman rm "$extract" >/dev/null; rm -f "$archive"; rm -rf "$staging"; }
trap cleanup EXIT
podman cp "$extract:/opt/vote-web/." "$staging/"
chmod -R a+rX "$staging"
podman save -o "$archive" "$image"
chown vote:vote "$archive"
vr podman load -i "$archive"
previous=$(vr podman image inspect localhost/yhs-voting:current --format '{{.Id}}' 2>/dev/null || true)
if [[ -n "$previous" ]]; then vr podman tag "$previous" localhost/yhs-voting:previous; fi
# A pre-deploy snapshot also stops the writer before migrations.
if vr systemctl --user is-active --quiet vote.service; then vr /home/vote/.local/bin/vote-backup; fi
vr systemctl --user stop vote.service || true
vr systemctl --user stop vote-proxy.service || true
vr podman tag "$image" localhost/yhs-voting:current
for volume in data uploads logs; do vr podman volume inspect "yhs-vote-$volume" >/dev/null 2>&1 || vr podman volume create "yhs-vote-$volume" >/dev/null; done
install -o vote -g vote -m 644 "$script_dir/vote.container" /home/vote/.config/containers/systemd/vote.container
install -o vote -g vote -m 644 "$script_dir/vote.container" /home/vote/.config/vote/vote.container.warm
install -o vote -g vote -m 755 "$script_dir/backup.sh" /home/vote/.local/bin/vote-backup
install -o vote -g vote -m 644 "$script_dir/vote-backup.service" "$script_dir/vote-backup.timer" /home/vote/.config/systemd/user/
install -o vote -g vote -m 755 "$script_dir/wait-ready.sh" /home/vote/.local/bin/vote-wait
install -o vote -g vote -m 755 "$script_dir/set-mode.sh" /home/vote/.local/bin/vote-mode
install -o vote -g vote -m 644 "$script_dir/vote-proxy.service" "$script_dir/vote-proxy.socket" /home/vote/.config/systemd/user/
vr systemctl --user daemon-reload
vr systemctl --user enable --now vote-proxy.socket
vr systemctl --user start vote.service
ready=false
for _ in {1..30}; do
    if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then ready=true; break; fi
    sleep 2
done
if [[ $ready != true ]]; then
    vr systemctl --user stop vote.service
    if [[ -n "$previous" ]]; then
        vr podman tag "$previous" localhost/yhs-voting:current
        vr systemctl --user start vote.service
    fi
    echo 'Health check failed; inspect journalctl. Schema rollback may require the pre-deploy backup.' >&2
    exit 1
fi
vr podman exec yhs-vote bun run scripts/bootstrap-production.ts
install -d /srv/yhs-vote/acme /srv/yhs-vote/releases
release="/srv/yhs-vote/releases/$(date -u +%Y%m%dT%H%M%SZ)"
mv "$staging" "$release"
ln -s "$release" /srv/yhs-vote/web.next
mv -Tf /srv/yhs-vote/web.next /srv/yhs-vote/web
if [[ ! -e /etc/nginx/sites-available/yhs-vote ]]; then
    install -m 644 "$script_dir/vote.nginx.conf" /etc/nginx/sites-available/yhs-vote
    ln -s /etc/nginx/sites-available/yhs-vote /etc/nginx/sites-enabled/yhs-vote
fi
nginx -t
systemctl reload nginx
vr systemctl --user enable --now vote-backup.timer
echo 'Deployed. Configure DNS separately, then run infra/vps/finish-https.sh.'
