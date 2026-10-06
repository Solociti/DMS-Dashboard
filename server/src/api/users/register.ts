import type { RequestHandler, Router } from "express";
import type { Knex } from "knex";

import { listUsers, updateUser } from "./handlers";

export default function registerUsers(
  router: Router,
  database: Knex,
  rateLimiter: RequestHandler,
): void {
  router.get("/", rateLimiter, listUsers(database));
  router.put("/:userId", rateLimiter, updateUser(database));
}