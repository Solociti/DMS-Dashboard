import type { RequestHandler, Router } from "express";

import { getLogRouteParam } from "./helpers";
import { listLogFiles, readLogFile, type LogRegistry } from "../../logs";

export default function registerLogs(
  router: Router,
  logRegistry: LogRegistry,
  rateLimiter: RequestHandler,
): void {
  router.get("/", rateLimiter, async (_request, response, next) => {
    try {
      response.json(await listLogFiles(logRegistry));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:name", rateLimiter, async (request, response, next) => {
    try {
      const lines = Number(request.query.lines ?? 200);
      const logName = getLogRouteParam(request.params.name);
      if (!logName) {
        response.status(400).json({ error: "Missing log name" });
        return;
      }

      response.json(await readLogFile(logRegistry, logName, lines));
    } catch (error) {
      next(error);
    }
  });
}