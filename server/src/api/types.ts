import type { RequestHandler } from "express";
import type { Knex } from "knex";

import type { AppConfig } from "../config";
import type { LogRegistry } from "../logs";
import type { WarningStore } from "../warnings";

export interface ApiDependencies {
  config: AppConfig;
  database: Knex;
  logRegistry: LogRegistry;
  warningStore: WarningStore;
}

export interface ApiRateLimiters {
  general: RequestHandler;
  ingest: RequestHandler;
  login: RequestHandler;
  opens: RequestHandler;
}