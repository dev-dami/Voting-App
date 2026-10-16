# Voting VPS deployment

Deployment target: **128.140.89.95**, `vote.yeshuahigh.com`.
The existing school API owns Nginx ports 80/443, so voting uses a separate
Nginx virtual host and Certbot instead of installing a competing Caddy listener.
Cloudflare is managed manually; no Cloudflare credentials are used.

## Installed layout

- Rootless Podman account `vote`, linger enabled, Alpine + Bun 1.4.2.
- Nginx serves `/srv/yhs-vote/web`, an atomic symlink to a release directory.
- `/api`, `/uploads`, `/images` proxy to the systemd socket at 127.0.0.1:8080.
- `systemd-socket-proxyd` starts the container at 127.0.0.1:8082, waiting for
  its health check before forwarding requests. WebSocket upgrades are supported.
- API container port is 8080; neither host API port binds publicly.
- Named volumes `yhs-vote-data`, `yhs-vote-uploads`, `yhs-vote-logs` persist state.
- Container RAM limit 256MiB; combined RAM+swap limit 384MiB; systemd service
  MemoryHigh 240MiB / MemoryMax 300MiB; one CPU, 128 processes.
- SQLite uses WAL, FULL synchronous durability, 3s busy timeout, ~16MiB cache.
  FULL preserves acknowledged votes across power failure more strongly than NORMAL.
- Production credentials: `/home/vote/.config/vote/production.env` (0600).
  Retrieve the admin password locally as root; never commit or paste this file.

## Initial provisioning (already completed on this VPS)

Install Podman 4.9+ with Quadlet, uidmap, slirp4netns, sqlite3, curl, Nginx and
Certbot's Nginx plugin. Create `vote`, verify subordinate UID/GID ranges,
enable linger and start `user@$(id -u vote).service`.
Create the 0600 production environment as the vote user with:

```ini
NODE_ENV=production
PORT=8080
DATABASE_URL=/app/apps/api/data/voting.db
CORS_ORIGIN=https://vote.yeshuahigh.com
JWT_SECRET=<random 48-byte hex secret>
ADMIN_VOTER_ID=admin
ADMIN_PASSWORD=<random password of at least 20 characters>
LOG_LEVEL=info
```

Build and deploy as root from the repository:

```bash
podman build -f apps/api/Containerfile -t localhost/yhs-voting:TAG .
infra/vps/deploy-local.sh localhost/yhs-voting:TAG
```

The build uses the frozen workspace lock, runs ballot tests, builds the web
with empty `VITE_API_URL`, and installs only API production dependencies into
the runtime image. Frontend dist and the API fallback portrait are separate.
Deploy transfers the image to the rootless account, snapshots existing data,
restarts and health-checks the API, then atomically swaps web files. It retains
the previous image tag; never run two application instances on the data volume.

For subsequent rootless commands, use:

```bash
cd /tmp
runuser -u vote -- env XDG_RUNTIME_DIR=/run/user/$(id -u vote) \
  DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u vote)/bus COMMAND
```

On first deployment only, substitute the following COMMAND:
`podman exec yhs-vote bun run scripts/bootstrap-production.ts`.
This creates the admin and pending election without demo candidates. It does
not reset an existing admin password. This bootstrap has already run here.

## DNS and HTTPS (pending manual DNS)

In Cloudflare create an A record: **vote → 128.140.89.95**, **DNS only**.
Do not add an AAAA record unless IPv6 is separately configured.
After propagation, run as root from the repository:

```bash
infra/vps/finish-https.sh
```

This verifies DNS, obtains a real certificate, configures HTTPS redirect and
checks HTTPS health. Until this step completes, HTTP is for local staging only:
production cookies require HTTPS. Certbot's existing renewal timer renews TLS.
Firewall rules were preserved because this is a shared production VPS. Voting
adds no public port beyond existing HTTP/HTTPS; unrelated rules require a
separate audit before removal.

## Warm and on-demand modes

As the vote user, run `~/.local/bin/vote-mode warm` for election day or
`~/.local/bin/vote-mode ondemand` between elections. Warm is the deployment
default. In on-demand mode, the proxy exits after 300s without TCP connections,
and StopWhenUnneeded stops the API. The next request wakes both. Active live
WebSocket sessions keep the proxy and API awake. Health probes target the
container directly and do not wake the public socket. A mode switch briefly
disconnects clients. Election status remains the voting control.

## Backups and rollback

`vote-backup.timer` runs at 03:30 UTC and retains about 14 days in
`/home/vote/backups/`. It briefly stops the writer, uses SQLite `.backup`, checks
integrity, copies uploads, and restarts the service. Each deploy also backs up.
Schedule election hours outside this maintenance window. Off-server replication
is not configured; copy these private backups to a separate storage location.

To roll back code: stop the service, tag `localhost/yhs-voting:previous` as
`localhost/yhs-voting:current`, restart, and repoint the web symlink to its matching
previous release. If migrations are incompatible, stop the writer and restore
the matching database AND uploads snapshot first. Preserve current data before
any restore. A snapshot restore can lose votes cast since it was taken.

## GitHub

`.github/workflows/deploy.yml` builds and tests pull requests; main builds push
SHA and latest image tags to GHCR. Automatic SSH deployment is not configured:
the current GitHub credential cannot administer Actions secrets (HTTP 403).
The VPS is deployed locally already. To use a registry image, pull its immutable
SHA as root then pass that reference to `deploy-local.sh`. A private GHCR package
requires a separate read-packages credential on the VPS.

## Validation

Check same-origin web, health, default portrait, authenticated candidate upload
after container recreation, backup integrity/restore, and cold startup plus idle
shutdown. Also verify `https://api.yeshuahigh.com/health` remains healthy. A full
election rehearsal and browser check remain for after DNS and HTTPS are ready.
