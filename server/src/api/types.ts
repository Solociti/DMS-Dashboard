import type { RequestHandler } from "express";
import type { Knex } from "knex";

import type { AppConfig } from "../config";
import type { WarningStore } from "../warnings";

export interface ApiDependencies {
  config: AppConfig;
  database: Knex;
  warningStore: WarningStore;
}

export interface ApiRateLimiters {
  general: RequestHandler;
  ingest: RequestHandler;
  login: RequestHandler;
  opens: RequestHandler;
}