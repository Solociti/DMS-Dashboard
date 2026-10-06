import type { RequestHandler, Router } from "express";

import {
  InvalidBlacklistAddressError,
  type TrackingBlacklistStore,
} from "../../tracking-blacklist";
import { getBlacklistRouteParam } from "./helpers";

export default function registerTrackingBlacklist(
  router: Router,
  trackingBlacklist: TrackingBlacklistStore,
  rateLimiter: RequestHandler,
): void {
  router.get("/", rateLimiter, async (_request, response, next) => {
    try {
      response.json({ addresses: await trackingBlacklist.getAddresses() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", rateLimiter, async (request, response, next) => {
    try {
      response.json({
        addresses: await trackingBlacklist.addAddress(request.body?.address),
      });
    } catch (error) {
      if (error instanceof InvalidBlacklistAddressError) {
        response.status(400).json({ error: error.message });
        return;
      }

      next(error);
    }
  });

  router.delete("/:address", rateLimiter, async (request, response, next) => {
    try {
      const address = getBlacklistRouteParam(request.params.address);
      response.json({
        addresses: await trackingBlacklist.removeAddress(address),
      });
    } catch (error) {
      if (error instanceof InvalidBlacklistAddressError) {
        response.status(400).json({ error: error.message });
        return;
      }

      next(error);
    }
  });
}