# DMS Dashboard

Email tracking dashboard for Docker Mailserver with:

- Node.js + Express + TypeScript API
- Knex + SQLite open-event storage
- Bundled browser dashboard served from `public/dist/`
- Rspamd Lua postfilter for tracking-pixel injection
- Release workflow that builds and pushes a GHCR image

## Note

This project is AI-assisted.

## Environment

Copy `example.env` and adjust values as needed:

- `PORT`: HTTP port for the dashboard server
- `DATABASE_PATH`: persistent SQLite database path (default `/data/tracker.sqlite`)
- `DMS_ROOT`: mounted Docker Mailserver path (default `/dms`)
- `RSPAMD_DIR`: Rspamd directory where the dashboard writes `rspamd.local.lua` (default `${DMS_ROOT}/rspamd`)
- `TRUST_PROXY`: set to `true`, a hop count, or a proxy definition only when the app sits behind your own trusted proxy
- `TRACKING_BASE_URL`: externally reachable dashboard origin used by the Lua filter; when unset, the filter is not installed and the dashboard shows a warning
- The dashboard stores excluded sender addresses in `tracking-blacklist.txt` beside the generated Rspamd filter.
- `LOG_FILES`: comma-separated log aliases and paths, for example `rspamd:/dms/logs/rspamd.log,mail:/dms/logs/mail.log`

## Dashboard accounts

On startup, the dashboard creates a temporary admin account if `admin@example.com` is not already present:

- Email: `admin@example.com`
- Temporary password: `changeme123`

The first login requires setting a new password. Passwords must be 12 to 128 characters. Use the Users view to change the email or password of any listed account; leave the new-password field blank to keep its current password.

For tracking mail sent through authenticated SMTP accounts, Docker Mailserver must run Rspamd checks for authenticated users. Set `RSPAMD_CHECK_AUTHENTICATED=1` on the Docker Mailserver container; its default is `0`, which skips those messages and prevents the tracking postfilter from running. This enables the default Rspamd checks for authenticated mail, not only the tracking filter. The tracking filter only modifies messages with an authenticated user, so ordinary inbound mail is not changed.

## Mailserver Rspamd setup

The tracking filter is a Rspamd Lua script loaded directly as `/etc/rspamd/rspamd.local.lua`, so it must be enabled and bind-mounted into your Docker Mailserver container.

### 1. Enable Rspamd

In your DMS environment:

```
ENABLE_RSPAMD=1
```

If you currently have the legacy DKIM/DMARC/Amavis stack enabled, DMS recommends using Rspamd in their place rather than running both stacks for the same functions.

DMS defaults `RSPAMD_CHECK_AUTHENTICATED=0`, meaning authenticated/outbound mail normally bypasses Rspamd's checks. Since the tracking filter only modifies authenticated (outbound) mail, set:

```
RSPAMD_CHECK_AUTHENTICATED=1
```

That also means authenticated outbound messages go through Rspamd's normal checks, not only the tracking filter.

### 2. Let the dashboard write the Lua script

With `RSPAMD_DIR` and `TRACKING_BASE_URL` configured (see above), the dashboard writes the substituted filter to `${RSPAMD_DIR}/rspamd.local.lua` on the host path backing `DMS_ROOT`, for example `docker-data/dms/config/rspamd/rspamd.local.lua`.

### 3. Mount the Lua file into the DMS container

DMS's normal config volume handles `rspamd/override.d`, but a custom `rspamd.local.lua` is easiest to bind-mount explicitly. The Rspamd loader supports `/etc/rspamd/rspamd.local.lua`. Add to the `mailserver` service:

```yaml
volumes:
  - ./docker-data/dms/config/:/tmp/docker-mailserver/
  - ./docker-data/dms/config/rspamd/rspamd.local.lua:/etc/rspamd/rspamd.local.lua:ro
  - ./docker-data/dms/config/rspamd/tracking-blacklist.txt:/etc/rspamd/tracking-blacklist.txt:ro
```

The dashboard creates the blacklist file when it installs the filter. The Lua filter reads it for each authenticated outbound message, so changes made on the Excluded senders page take effect without restarting Rspamd.

## Development

```bash
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm test
```

### Dev container

`pnpm run dev` builds a development container (via `docker-compose.dev.yml`) that installs
dependencies, bind-mounts the repo, and runs the client bundler and server together with
live reload:

```bash
pnpm run dev
```

This runs esbuild in watch mode for the client (`public/dist/`) and `tsx watch` for the
server, both inside the container, and exposes the dashboard on `http://localhost:3000`.
SQLite data persists in the `dev-data` Docker volume, and `./dms-root/` on the host is
mounted to `/dms` — replace it with your Docker Mailserver config path, or leave it empty
to see the dashboard's warning state. Environment values come from `example.env`; copy it
to `.env` and adjust as needed, then add `--env-file .env` overrides or edit
`docker-compose.dev.yml` to point at your own env file.

## Build

```bash
corepack pnpm run build
```

This produces:

- `public/dist/` for the client SPA
- `build/server/index.js` for the bundled server entrypoint

## Docker

Build the production image with:

```bash
docker build -f server/Dockerfile -t dms-dashboard .
```

At runtime, mount:

- Docker Mailserver config at `/dms`
- Persistent data at `/data`

If the configured `RSPAMD_DIR` is available and `TRACKING_BASE_URL` is set, the bundled filter is installed at `/dms/rspamd/rspamd.local.lua` by default. The dashboard substitutes the configured URL into the Lua script and replaces the existing filter whenever its contents differ. If the required path or tracking URL is unavailable, the dashboard shows a warning and lets you re-run the check after you fix the environment. See [Mailserver Rspamd setup](#mailserver-rspamd-setup) for the corresponding Docker Mailserver configuration.
