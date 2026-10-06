import type { RequestHandler, Router } from "express";
import type { Knex } from "knex";

import { getOpenEvents, getOpenSummaries } from "./handlers";
import { getOpenRouteParam, parseOpenFilters } from "./helpers";
import { getAuthenticatedUser } from "../../auth";

export default function registerOpens(
  router: Router,
  database: Knex,
  rateLimiter: RequestHandler,
): void {
  router.get("/", rateLimiter, async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(database, request);
      response.json(
        await getOpenSummaries(
          database,
          parseOpenFilters(request.query),
          user?.email ?? null,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/:msgId", rateLimiter, async (request, response, next) => {
    try {
      const msgId = getOpenRouteParam(request.params.msgId);
      if (!msgId) {
        response.status(400).json({ error: "Missing message id" });
        return;
      }

      response.json(await getOpenEvents(database, msgId));
    } catch (error) {
      next(error);
    }
  });
}