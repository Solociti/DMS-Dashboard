import type { Router } from "express";
import type { Knex } from "knex";

import { changePassword, login, logout, session } from "./handlers";
import type { ApiRateLimiters } from "../types";

export default function registerAuth(
  router: Router,
  database: Knex,
  limiters: ApiRateLimiters,
): void {
  router.post("/login", limiters.login, login(database));
  router.get("/session", session(database));
  router.post("/logout", logout(database));
  router.post("/password", changePassword(database));
}