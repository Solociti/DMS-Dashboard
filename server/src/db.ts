import fs from "node:fs/promises";
import path from "node:path";
import knex, { type Knex } from "knex";
import "sqlite3";
import * as createOpensMigration from "../migrations/20260928100000_create_opens";

import * as createMessagesMigration from "../migrations/20261005100000_create_messages";
import * as addSentAtToMessagesMigration from "../migrations/20261005110000_add_sent_at_to_messages";

const migrations = [
  createOpensMigration,
  createMessagesMigration,
  addSentAtToMessagesMigration,
];

class InlineMigrationSource {
  async getMigrations(): Promise<typeof migrations> {
    return migrations;
  }

  getMigrationName(migration: (typeof migrations)[number]): string {
    return migration.name;
  }

  async getMigration(
    migration: (typeof migrations)[number],
  ): Promise<(typeof migrations)[number]> {
    return migration;
  }
}

export function createDatabase(databasePath: string): Knex {
  return knex({
    client: "sqlite3",
    connection: {
      filename: databasePath,
    },
    useNullAsDefault: true,
    pool: {
      afterCreate(
        connection: {
          run: (sql: string, cb: (error: Error | null) => void) => void;
        },
        callback: (error: Error | null, connection: unknown) => void,
      ) {
        connection.run("PRAGMA foreign_keys = ON", (error) =>
          callback(error, connection),
        );
      },
    },
  });
}

export async function ensureDatabaseDirectory(
  databasePath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
}

export async function runMigrations(database: Knex): Promise<void> {
  await database.migrate.latest({
    migrationSource: new InlineMigrationSource(),
    tableName: "knex_migrations",
  });
}
