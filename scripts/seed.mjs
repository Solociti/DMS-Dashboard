// Dev only: runs the seed inside the dev container started by `pnpm run dev`.
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "docker",
  [
    "compose",
    "-f",
    "docker-compose.dev.yml",
    "exec",
    "dashboard",
    "./node_modules/.bin/tsx",
    "server/src/seed.ts",
  ],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  console.error("Seed failed. Make sure `pnpm run dev` is running first.");
}
process.exit(result.status ?? 1);
