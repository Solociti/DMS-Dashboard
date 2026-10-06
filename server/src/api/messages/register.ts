import type { Router } from "express";

import { warnApi } from "../log";
import { isAuthorized, saveMessage } from "./helpers";
import type { ApiDependencies, ApiRateLimiters } from "../types";

export default function registerMessages(
  router: Router,
  dependencies: ApiDependencies,
  limiters: ApiRateLimiters,
): void {
  router.post("/", limiters.ingest, async (request, response, next) => {
    try {
      if (!isAuthorized(request, dependencies.config.trackingApiToken)) {
        warnApi(request, "Unauthorized");
        response.status(401).json({ error: "Unauthorized" });
        return;
      }

      const saved = await saveMessage(
        dependencies.database,
        request.body ?? {},
      );
      if (!saved) {
        response.status(400).json({ error: "Missing uid" });
        return;
      }

      warnApi(
        request,
        "Registered",
        ` uid: ${String(request.body.uid).slice(0, 128)}`,
      );

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });
}
