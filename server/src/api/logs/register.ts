import type { RequestHandler, Router } from "express";

import { getLogRouteParam, parseSearchTerms } from "./helpers";
import { listLogFiles, readLogFile, searchLogs } from "../../logs";

export default function registerLogs(
  router: Router,
  logDir: string,
  rateLimiter: RequestHandler,
): void {
  router.get("/", rateLimiter, async (_request, response, next) => {
    try {
      response.json(await listLogFiles(logDir));
    } catch (error) {
      next(error);
    }
  });

  router.get("/search", rateLimiter, async (request, response, next) => {
    try {
      const terms = parseSearchTerms(request.query.q);
      if (!terms) {
        response.status(400).json({ error: "Invalid search query" });
        return;
      }

      response.json(await searchLogs(logDir, terms));
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

      response.json(await readLogFile(logDir, logName, lines));
    } catch (error) {
      next(error);
    }
  });
}