import type { RequestHandler, Router } from "express";

import type { WarningStore } from "../../warnings";

export default function registerWarnings(
  router: Router,
  warningStore: WarningStore,
  rateLimiter: RequestHandler,
): void {
  router.get("/", rateLimiter, (_request, response) => {
    response.json(warningStore.getState());
  });

  router.post("/recheck", rateLimiter, async (_request, response, next) => {
    try {
      response.json(await warningStore.refresh());
    } catch (error) {
      next(error);
    }
  });
}