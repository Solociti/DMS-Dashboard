import express from "express";
import path from "node:path";

import registerAuth from "./auth/register";
import { requireAuthenticatedApi } from "./auth/handlers";
import registerIgnoredIps from "./ignored-ips/register";
import registerLogs from "./logs/register";
import registerMessages from "./messages/register";
import registerOpens from "./opens/register";
import registerTrackingBlacklist from "./tracking-blacklist/register";
import registerUsers from "./users/register";
import registerWarnings from "./warnings/register";
import type { ApiDependencies, ApiRateLimiters } from "./types";
import { TrackingBlacklistStore } from "../tracking-blacklist";

export default function registerApi(
  dependencies: ApiDependencies,
  limiters: ApiRateLimiters,
): express.Router {
  const router = express.Router();

  const authRoutes = express.Router();
  registerAuth(authRoutes, dependencies.database, limiters);
  router.use("/auth", authRoutes);

  const messageRoutes = express.Router();
  registerMessages(messageRoutes, dependencies, limiters);
  router.use("/messages", messageRoutes);

  router.use(requireAuthenticatedApi(dependencies.database));

  const userRoutes = express.Router();
  registerUsers(userRoutes, dependencies.database, limiters.general);
  router.use("/users", userRoutes);

  const openRoutes = express.Router();
  registerOpens(openRoutes, dependencies.database, limiters.opens);
  router.use("/opens", openRoutes);

  const ignoredIpRoutes = express.Router();
  registerIgnoredIps(
    ignoredIpRoutes,
    dependencies.database,
    limiters.general,
  );
  router.use("/ignored-ips", ignoredIpRoutes);

  const logRoutes = express.Router();
  registerLogs(logRoutes, dependencies.logRegistry, limiters.general);
  router.use("/logs", logRoutes);

  const warningRoutes = express.Router();
  registerWarnings(warningRoutes, dependencies.warningStore, limiters.general);
  router.use("/warnings", warningRoutes);

  const trackingBlacklist = new TrackingBlacklistStore(
    path.join(dependencies.config.rspamdDir, "tracking-blacklist.txt"),
  );
  const trackingBlacklistRoutes = express.Router();
  registerTrackingBlacklist(
    trackingBlacklistRoutes,
    trackingBlacklist,
    limiters.general,
  );
  router.use("/tracking-blacklist", trackingBlacklistRoutes);

  return router;
}