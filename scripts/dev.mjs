// Dev only: pre-creates bind-mount dirs as the host user, then starts the dev container.
import { spawn } from "node:child_process";
import fs from "node:fs";

for (const dir of [
  "dms-root/dev-data",
  "dms-root/config/rspamd",
  "dms-root/logs",
]) {
  fs.mkdirSync(dir, { recursive: true });
}

// Compose would otherwise create missing mount dirs as root and the container user could not write them.
const env = { ...process.env };
if (process.getuid && process.getgid) {
  env.DEV_UID = String(process.getuid());
  env.DEV_GID = String(process.getgid());
}

const child = spawn(
  "docker",
  ["compose", "-f", "docker-compose.dev.yml", "up", "--build"],
  { stdio: "inherit", env },
);
// Ctrl+C also reaches compose via the terminal; stay alive until it finishes stopping containers.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 1));
