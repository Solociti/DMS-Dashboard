import type { Server } from "node:http";
import { createApp } from "./app";
import {
  recalculateOpenCounts,
  scheduleDailyAtTwoAm,
} from "./api/opens/counts";
import { deleteExpiredSessions } from "./auth";
import { loadConfig, type AppConfig } from "./config";
import { createDatabase, ensureDatabaseDirectory, runMigrations } from "./db";
import { ensureTrackingFilter } from "./dms";
import type { LogRegistry } from "./logs";
import { WarningStore } from "./warnings";

export {
  createApp,
  createDatabase,
  ensureDatabaseDirectory,
  ensureTrackingFilter,
  loadConfig,
  runMigrations,
  WarningStore,
};
export type { AppConfig, LogRegistry };

export async function createServerApplication(
  config: AppConfig = loadConfig(),
) {
  await ensureDatabaseDirectory(config.databasePath);

  const database = createDatabase(config.databasePath);
  await runMigrations(database);

  const sessionCleanupTimer = setInterval(
    () => deleteExpiredSessions(database),
    5 * 60 * 60 * 1000,
  );
  sessionCleanupTimer.unref();

  scheduleDailyAtTwoAm(() => recalculateOpenCounts(database));

  const warningStore = new WarningStore(config);
  await warningStore.refresh();

  const app = createApp(config, database, config.logFiles, warningStore);
  return { app, database, warningStore };
}

export async function startServer(config: AppConfig = loadConfig()): Promise<{
  server: Server;
  database: Awaited<ReturnType<typeof createServerApplication>>["database"];
}> {
  const { app, database } = await createServerApplication(config);

  return new Promise((resolve, reject) => {
    const rejectWithCleanup = (error: Error) => {
      void database.destroy().finally(() => reject(error));
    };

    const server = app.listen(config.port, () => {
      server.off("error", rejectWithCleanup);
      console.log(`DMS Dashboard listening on ${config.port}`);
      const shutdown = (signal: string) => {
        console.log(`${signal} received, shutting down`);
        server.close(() => {
          void database.destroy().finally(() => process.exit(0));
        });
        server.closeAllConnections();
      };
      process.once('SIGTERM', () => shutdown('SIGTERM'));
      process.once('SIGINT', () => shutdown('SIGINT'));
      resolve({ server, database });
    });

    server.once("error", rejectWithCleanup);
  });
}

if (require.main === module) {
  startServer().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
