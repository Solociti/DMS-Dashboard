# Project Instructions

## API Route Layout

- Keep API routes under `server/src/api/` in a directory tree matching their URL resource. For example, `/api/users/*` belongs in `server/src/api/users/`.
- Put each resource's route wiring in `register.ts`. A `register.ts` file must contain exactly one export, and that export must be `default`.
- Keep `register.ts` focused on registering paths, middleware, and handlers. Put database operations, validation, transformations, and reusable endpoint logic in adjacent helper or handler files.
- Register resource modules in `server/src/api/register.ts`, which mounts at `/api` from `server/src/app.ts`.
- Keep application setup and non-API routes in `server/src/app.ts`; do not add API endpoint implementations there.
- Pass databases, stores, configuration, and rate limiters into registration functions. Do not create shared mutable module-level state.

## Middleware And Behavior

- Register `/api/auth/*` and bearer-token `/api/messages` routes before the shared authenticated-API middleware.
- Register user, opens, logs, warnings, and tracking-blacklist routes after that middleware.
- Preserve local authorization checks, response shapes, validation, and rate limits when moving endpoints.
- Add or update integration coverage in `tests/server.test.js` when changing endpoint behavior or middleware boundaries.