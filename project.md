# Project Layout

- `client/`: dashboard SPA source files
- `common/`: shared TypeScript contracts
- `server/`: Express API, boot logic, Dockerfile, and migrations
- `dms/`: Rspamd Lua tracking filter (`rspamd.local.lua`), bind-mounted into Docker Mailserver as its Rspamd entrypoint script
- `public/`: static assets and generated `public/dist/` client bundle
