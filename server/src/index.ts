import type { Server } from 'node:http';
import { createApp } from './app';
import { loadConfig, type AppConfig } from './config';
import { createDatabase, ensureDatabaseDirectory, runMigrations } from './db';
import { ensureTrackingFilter } from './dms';
import type { LogRegistry } from './logs';

export { createApp, loadConfig, createDatabase, ensureDatabaseDirectory, runMigrations, ensureTrackingFilter };
export type { AppConfig, LogRegistry };

export async function createServerApplication(config: AppConfig = loadConfig()) {
  await ensureTrackingFilter(config.dmsRoot, config.trackingLuaSourcePath);
  await ensureDatabaseDirectory(config.databasePath);

  const database = createDatabase(config.databasePath);
  await runMigrations(database);

  const app = createApp(config, database, config.logFiles);
  return { app, database };
}

export async function startServer(config: AppConfig = loadConfig()): Promise<Server> {
  const { app } = await createServerApplication(config);

  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      console.log(`DMS Dashboard listening on ${config.port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
