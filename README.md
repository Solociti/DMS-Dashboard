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
- `RSPAMD_OVERRIDE_DIR`: Rspamd `override.d` directory (default `${DMS_ROOT}/rspamd/override.d`)
- `TRUST_PROXY`: set to `true`, a hop count, or a proxy definition only when the app sits behind your own trusted proxy
- `TRACKING_BASE_URL`: externally reachable dashboard origin used by the Lua filter; when unset, the filter is not installed and the dashboard shows a warning
- `LOG_FILES`: comma-separated log aliases and paths, for example `rspamd:/dms/logs/rspamd.log,mail:/dms/logs/mail.log`

For tracking mail sent through authenticated SMTP accounts, Docker Mailserver must run Rspamd checks for authenticated users. Set `RSPAMD_CHECK_AUTHENTICATED=1` on the Docker Mailserver container; its default is `0`, which skips those messages and prevents the tracking postfilter from running. This enables the default Rspamd checks for authenticated mail, not only the tracking filter. The tracking filter only modifies messages with an authenticated user, so ordinary inbound mail is not changed.

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

If the configured `RSPAMD_OVERRIDE_DIR` is available and `TRACKING_BASE_URL` is set, the bundled filter is copied into place when `email_tracking.lua` is missing. By default, this is `/dms/rspamd/override.d/`. If those requirements are not met, the dashboard shows a warning and lets you re-run the check after you fix the environment.
