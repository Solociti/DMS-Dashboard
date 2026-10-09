import express, { type Request, type Response } from "express";
import type { Knex } from "knex";
import path from "node:path";

import registerApi from "./api/register";
import { createApiRateLimiters } from "./api/rate-limits";
import { recordOpenHit } from "./api/opens/counts";
import { getAuthenticatedUser } from "./auth";
import type { AppConfig } from "./config";
import type { LogRegistry } from "./logs";
import { WarningStore } from "./warnings";

const dashboardIndexPath = "index.html";

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

export function getClientIp(request: Request): string | null {
  return request.ip || request.socket.remoteAddress || null;
}

export function createApp(
  config: AppConfig,
  database: Knex,
  logRegistry: LogRegistry,
  warningStore: WarningStore,
): express.Express {
  const app = express();
  const limiters = createApiRateLimiters();
  const rateLimiter = limiters.general;
  const dashboardIndexFile = path.join(
    config.publicDistRoot,
    dashboardIndexPath,
  );
  const loginPageFile = path.join(config.publicDistRoot, "login.html");
  const trackingPixelFile = path.join(config.publicRoot, "images", "pixel.png");

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(express.json());
  app.use(express.static(config.publicRoot));
  app.use(
    "/dashboard",
    express.static(config.publicDistRoot, { index: false }),
  );

  app.get("/login", (_request: Request, response: Response, next) => {
    response.sendFile(loginPageFile, (error) => {
      if (error) {
        next(error);
      }
    });
  });

  app.use(
    "/api",
    registerApi({ config, database, logRegistry, warningStore }, limiters),
  );

  app.get("/", (_request: Request, response: Response) => {
    response.redirect("/dashboard");
  });

  app.get(
    "/open/:msgId.png",
    rateLimiter,
    async (request: Request, response: Response, next) => {
      try {
        const msgId = getRouteParam(request.params.msgId);
        if (!msgId) {
          response.status(400).json({ error: "Missing message id" });
          return;
        }

        response.setHeader("Content-Type", "image/png");
        response.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, private",
        );
        response.sendFile(trackingPixelFile, (error) => {
          if (error) {
            next(error);
          }
        });

        console.log(
          `[${new Date().toISOString()}] ${request.baseUrl} MessageId: ${msgId} IP: ${getClientIp(request)}`,
        );

        void recordOpenHit(database, {
          msgId,
          ipAddress: getClientIp(request),
          userAgent: request.header("user-agent") || null,
        })
          .catch((error: unknown) => {
            console.error(error instanceof Error ? error.message : error);
          });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    ["/dashboard", "/dashboard/*path"],
    rateLimiter,
    async (request, response, next) => {
      try {
        const user = await getAuthenticatedUser(database, request);
        if (!user || user.mustChangePassword) {
          response.redirect(
            `/login?returnTo=${encodeURIComponent(request.originalUrl)}`,
          );
          return;
        }

        response.sendFile(dashboardIndexFile, (error) => {
          if (error) {
            next(error);
          }
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: express.NextFunction,
    ) => {
      const message =
        error instanceof Error ? error.message : "Unexpected error";
      response
        .status(message.startsWith("Unknown log file") ? 404 : 500)
        .json({ error: message });
    },
  );

  return app;
}
