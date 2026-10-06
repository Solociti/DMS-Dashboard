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

## Client (React)

- The client is a React 19 app using React Router. It has two esbuild entry points: `client/login/main.tsx` (small bundle, no router) and `client/dashboard/main.tsx` (router app). Output goes to `public/dist/assets/` as ESM with code splitting.
- Client code is type-checked with `client/tsconfig.json`, which extends the root `tsconfig.json`. Do not add DOM-dependent code under `server/`.
- Keep each dashboard section in its own directory under `client/` (for example `client/logs/`, `client/users/`). Code shared across sections lives in `client/shared/`.
- Define routes only in `client/dashboard/router.tsx`. Every page component must be loaded with `React.lazy` and `import()`, and therefore must be a default export.
- Use one major React component per `.ts`/`.tsx` file. Hooks and helpers go in their own files.

### Component Rules

- Exported or file-global components must be declared with `function Component() {}`.
- Subcomponents defined inside a component must be arrow function components. Keep them to a minimum; prefer a separate file for anything substantial.
- Every exported component needs a props interface with a JSDoc comment on each prop, and a JSDoc comment on the component using this format:

```tsx
interface ComponentProps {
  /**
   * This does something
   */
  prop1: string;
}

/**
 * Component description
 *
 * @param {ComponentProps} arg0 [!important, no description here]
 */
export default function Component({ prop1 }: ComponentProps) {}
```

### Code Style

- Separate sections of code with a blank line whenever the scope changes or the code starts doing something different.

```ts
const qty = 1 + 1;
const total = qty * 10;

const filter = {};
```
