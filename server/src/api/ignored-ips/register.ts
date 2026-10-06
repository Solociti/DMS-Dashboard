import type { RequestHandler, Response, Router } from "express";
import type { Knex } from "knex";

import {
  InvalidIpError,
  getRequestIp,
  getRouteIp,
  listIgnoredIps,
  normalizeIp,
  normalizeNote,
} from "./helpers";

export default function registerIgnoredIps(
  router: Router,
  database: Knex,
  rateLimiter: RequestHandler,
): void {
  const respond = async (
    response: Response,
    currentIp: string | null,
  ): Promise<void> => {
    response.json({ ips: await listIgnoredIps(database), currentIp });
  };

  const handleError = (
    error: unknown,
    response: Response,
    next: (error: unknown) => void,
  ): void => {
    if (error instanceof InvalidIpError) {
      response.status(400).json({ error: error.message });
      return;
    }

    next(error);
  };

  router.get("/", rateLimiter, async (request, response, next) => {
    try {
      await respond(response, getRequestIp(request));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", rateLimiter, async (request, response, next) => {
    try {
      await database("ignored_ips")
        .insert({
          ip: normalizeIp(request.body?.ip),
          note: normalizeNote(request.body?.note),
        })
        .onConflict("ip")
        .merge();

      await respond(response, getRequestIp(request));
    } catch (error) {
      handleError(error, response, next);
    }
  });

  router.delete("/:ip", rateLimiter, async (request, response, next) => {
    try {
      await database("ignored_ips")
        .where({ ip: getRouteIp(request.params.ip) })
        .delete();

      await respond(response, getRequestIp(request));
    } catch (error) {
      handleError(error, response, next);
    }
  });
}
