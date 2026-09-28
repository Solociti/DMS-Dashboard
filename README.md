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
- `TRUST_PROXY`: set to `true`, a hop count, or a proxy definition only when the app sits behind your own trusted proxy
- `TRACKING_BASE_URL`: externally reachable dashboard origin used by the Lua filter; when unset, the filter is not installed and the dashboard shows a warning
- `LOG_FILES`: comma-separated log aliases and paths, for example `rspamd:/dms/logs/rspamd.log,mail:/dms/logs/mail.log`

## Development

```bash
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm test
```

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

If `/dms/rspamd/override.d/` is available and `TRACKING_BASE_URL` is set, the bundled filter is copied into place when `email_tracking.lua` is missing. If those requirements are not met, the dashboard shows a warning and lets you re-run the check after you fix the environment.
