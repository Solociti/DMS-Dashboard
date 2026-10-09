import path from "node:path";

import { createDatabase, ensureDatabaseDirectory, runMigrations } from "./db";

// Dev only: resets messages and opens, then loads the demo seeds from server/seeds.
async function main(): Promise<void> {
  const databasePath = process.env.DATABASE_PATH ?? "/data/tracker.sqlite";

  await ensureDatabaseDirectory(databasePath);
  const database = createDatabase(databasePath);

  try {
    await runMigrations(database);
    await database.seed.run({
      directory: path.resolve(__dirname, "../seeds"),
      loadExtensions: [".ts"],
    });
  } finally {
    await database.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
