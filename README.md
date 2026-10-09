# DMS Dashboard

Know when your email gets read. DMS Dashboard adds open tracking and a clean web dashboard to your self-hosted [Docker Mailserver](https://docker-mailserver.github.io/docker-mailserver/latest/).

> The majority of this project is AI-assisted code with human oversight.

## Screenshots

### Desktop

<img src="screenshots/desktop-overview.png" alt="Desktop overview" width="720" style="border: 1px solid #ccc; border-radius: 8px;">

### Mobile

<img src="screenshots/mobile-overview.png" alt="Mobile overview" width="240" style="margin-right: 1rem; border: 1px solid #ccc; border-radius: 8px;">
<img src="screenshots/mobile-details.png" alt="Mobile details" width="240" style="margin-right: 1rem; border: 1px solid #ccc; border-radius: 8px;">

## Features

**Tracking**

- Automatic tracking-pixel injection for outbound mail via an Rspamd Lua filter
- Only authenticated (sent) mail is modified; inbound mail is never touched
- Per-message open counts and last-opened time

**Dashboard**

- Overview with daily sent and opened charts and summary stat cards
- Filterable, sortable message table with per-message open details
- Configurable auto-refresh interval
- Responsive layout for desktop and mobile

**Control**

- Excluded senders list to skip tracking for chosen addresses (no Rspamd restart needed)
- Ignored IPs so your own opens do not count, with a one-click "ignore my IP"
- Built-in log viewer for Rspamd and mail logs
- Health warnings when the filter or tracking URL is not configured

**Security and operations**

- Login with enforced password change on first use
- Multi-user management; changing a password signs out other sessions
- Rate-limited API
- Single Docker image with SQLite storage and no external database

## Quick start

1. Add the dashboard container next to your Docker Mailserver.
2. Enable Rspamd and mount the generated filter into the mailserver.
3. Set `TRACKING_BASE_URL`, then log in with the temporary admin account.

Full instructions and a production Docker Compose example are in the [Setup Guide](SETUP.md).

## Tech stack

Node.js, Express, TypeScript, Knex + SQLite, React 19 with React Router, esbuild, and an Rspamd Lua postfilter. Releases are built and published to GHCR.

## License

See [LICENSE](LICENSE).
