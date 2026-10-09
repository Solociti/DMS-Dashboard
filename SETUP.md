# Setup Guide

Installation, configuration, and development instructions for DMS Dashboard.

## Contents

- [Requirements](#requirements)
- [Production Docker Compose](#production-docker-compose)
- [Environment](#environment)
- [Dashboard accounts](#dashboard-accounts)
- [Mailserver Rspamd setup](#mailserver-rspamd-setup)
- [Development](#development)
- [Build](#build)
- [Docker image](#docker-image)

## Requirements

- A working [Docker Mailserver](https://docker-mailserver.github.io/docker-mailserver/latest/) install
- Docker with Compose
- A reverse proxy with HTTPS, such as Nginx Proxy Manager, Traefik, or Caddy, forwarding a public domain to the dashboard on port 3000
- A public HTTPS URL for the dashboard (reachable by recipients' mail clients, so the tracking pixel can load)

## Example Docker Compose

Trimmed to the parts this project needs. Follow the [Docker Mailserver documentation](https://docker-mailserver.github.io/docker-mailserver/latest/) for proper mail server setup (DNS, TLS, DKIM, accounts, and so on).

```yaml
services:
  mailserver:
    image: ghcr.io/docker-mailserver/docker-mailserver:latest
    container_name: mailserver
    hostname: mail.example.com
    env_file: mailserver.env # must set ENABLE_RSPAMD=1 and RSPAMD_CHECK_AUTHENTICATED=1
    volumes:
      # ...your normal Docker Mailserver volumes...
      - ./docker-data/dms/config/:/tmp/docker-mailserver/
      - ./docker-data/dms/config/rspamd/rspamd.local.lua:/etc/rspamd/rspamd.local.lua:ro
      - ./docker-data/dms/config/rspamd/tracking-blacklist.txt:/etc/rspamd/tracking-blacklist.txt:ro
    # ...ports, restart policy, etc. per the Docker Mailserver docs...

  dashboard:
    image: ghcr.io/solociti/dms-dashboard:latest
    env_file:
      - dms-dash.env
    ports:
      - "3000:3000"
    volumes:
      - ./docker-data/dashboard:/data
      - ./docker-data/dms:/dms
    restart: always
```

Notes:

- The dashboard's `/dms` mount must be the same host directory that the mailserver mounts as its config; the dashboard writes the Rspamd filter into it.
- Put the dashboard behind your own HTTPS reverse proxy and set `TRUST_PROXY` accordingly.

Example `dms-dash.env`:

```
DATABASE_PATH=/data/tracker.sqlite
DMS_ROOT=/dms
RSPAMD_DIR=/dms/config/rspamd
TRACKING_BASE_URL=https://track.example.com
TRUST_PROXY=true
LOG_FILES=rspamd:/dms/logs/rspamd.log,mail:/dms/logs/mail.log
```

## Environment

Copy `example.env` and adjust values as needed:

- `PORT`: HTTP port for the dashboard server
- `DATABASE_PATH`: persistent SQLite database path (default `/data/tracker.sqlite`)
- `DMS_ROOT`: mounted Docker Mailserver path (default `/dms`)
- `RSPAMD_DIR`: Rspamd directory where the dashboard writes `rspamd.local.lua` (default `${DMS_ROOT}/rspamd`)
- `TRUST_PROXY`: set to `true`, a hop count, or a proxy definition only when the app sits behind your own trusted proxy
- `TRACKING_BASE_URL`: externally reachable dashboard origin used by the Lua filter; when unset, the filter is not installed and the dashboard shows a warning
- `LOG_FILES`: comma-separated log aliases and paths, for example `rspamd:/dms/logs/rspamd.log,mail:/dms/logs/mail.log`

The dashboard stores excluded sender addresses in `tracking-blacklist.txt` beside the generated Rspamd filter.

## Dashboard accounts

When the database has no users, the dashboard creates a temporary admin account on startup:

- Email: `admin@example.com`
- Temporary password: `changeme123`

The first login requires setting a new password. Passwords must be 12 to 128 characters. All users are administrators: the Users view changes the email or password of any listed account, and leaving the new-password field blank keeps the current password. A password set for another user must be changed by that user at their next login. Changing a password signs out that user's other sessions.

## Mailserver Rspamd setup

The tracking filter is a Rspamd Lua script loaded directly as `/etc/rspamd/rspamd.local.lua`, so it must be enabled and bind-mounted into your Docker Mailserver container.

### 1. Enable Rspamd

In your DMS environment:

```
ENABLE_RSPAMD=1
RSPAMD_CHECK_AUTHENTICATED=1
```

DMS defaults `RSPAMD_CHECK_AUTHENTICATED=0`, meaning authenticated (outbound) mail bypasses Rspamd. The tracking filter only modifies authenticated mail, so this must be `1`. Authenticated outbound messages then go through Rspamd's normal checks too, not only the tracking filter. Ordinary inbound mail is never modified.

If you currently use the legacy DKIM/DMARC/Amavis stack, DMS recommends Rspamd in its place rather than running both.

### 2. Let the dashboard write the Lua script

With `RSPAMD_DIR` and `TRACKING_BASE_URL` configured, the dashboard writes the substituted filter to `${RSPAMD_DIR}/rspamd.local.lua` on the host path backing `DMS_ROOT`, for example `docker-data/dms/config/rspamd/rspamd.local.lua`. It replaces the file whenever its contents differ. If the path or URL is unavailable, the dashboard shows a warning and lets you re-run the check after you fix the environment.

### 3. Mount the Lua file into the DMS container

Add to the `mailserver` service:

```yaml
volumes:
  - ./docker-data/dms/config/:/tmp/docker-mailserver/
  - ./docker-data/dms/config/rspamd/rspamd.local.lua:/etc/rspamd/rspamd.local.lua:ro
  - ./docker-data/dms/config/rspamd/tracking-blacklist.txt:/etc/rspamd/tracking-blacklist.txt:ro
```

The dashboard creates the blacklist file when it installs the filter. The Lua filter reads it for each authenticated outbound message, so changes on the Excluded senders page take effect without restarting Rspamd.

## Development

```bash
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm test
```

### Dev container

```bash
pnpm run dev
```

This builds a development container (via `docker-compose.dev.yml`) that installs dependencies, bind-mounts the repo, and runs the client bundler (esbuild watch) and server (`tsx watch`) with live reload. The dashboard is exposed on `http://localhost:3000`.

SQLite data persists in the `dev-data` Docker volume, and `./dms-root/` on the host is mounted to `/dms`. Replace it with your Docker Mailserver config path, or leave it empty to see the dashboard's warning state. Environment values come from `example.env`; copy it to `.env` and adjust as needed, or edit `docker-compose.dev.yml` to point at your own env file.

### Demo data

Reset the messages and opens tables and seed roughly 90 days of randomized sample mail:

```bash
docker compose -f docker-compose.dev.yml exec dashboard pnpm run seed
```

Or run `pnpm run seed` directly with `DATABASE_PATH` pointing at a local SQLite file. Some days have no emails and fewer days have no opens. The seed lives in `server/seeds/` and **deletes all existing messages and opens**, so do not run it against production data.

To fake live Rspamd reports and pixel opens against a running dev dashboard, use `pnpm run dev:fake`.

## Build

```bash
corepack pnpm run build
```

This produces:

- `public/dist/` for the client SPA
- `build/server/index.js` for the bundled server entrypoint

## Docker image

```bash
docker build -f server/Dockerfile -t dms-dashboard .
```

At runtime, mount Docker Mailserver config at `/dms` and persistent data at `/data`.
