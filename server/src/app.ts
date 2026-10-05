import express, { type Request, type Response } from "express";
import crypto from "node:crypto";
import path from "node:path";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Knex } from "knex";

import type { OpenLogEntry, OpenSummary } from "../../common/types";
import type { AppConfig } from "./config";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getAuthenticatedUser,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "./auth";
import { listLogFiles, readLogFile, type LogRegistry } from "./logs";
import {
  InvalidBlacklistAddressError,
  TrackingBlacklistStore,
} from "./tracking-blacklist";
import { WarningStore } from "./warnings";

const dashboardIndexPath = "index.html";

interface RawOpenRow {
  id: number;
  msg_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface RawSummaryRow {
  msg_id: string;
  total_opens: number | string;
  last_opened: string | null;
  sent_at: string | null;
  subject: string | null;
  sender: string | null;
  recipients: string | null;
}

function optionalString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, maxLength)
    : null;
}

function normalizeSentAt(value: unknown): string | null {
  const timestamp =
    typeof value === "number" && Number.isFinite(value)
      ? new Date(value * 1000)
      : typeof value === "string" && value.length > 0
        ? new Date(value)
        : null;

  return timestamp && Number.isFinite(timestamp.getTime())
    ? timestamp.toISOString()
    : null;
}

function isAuthorized(request: Request, token: string | null): boolean {
  if (!token) {
    return false;
  }

  const expected = crypto.createHash("sha256").update(token).digest();
  const provided = crypto
    .createHash("sha256")
    .update(request.header("authorization")?.replace(/^Bearer /i, "") ?? "")
    .digest();
  return crypto.timingSafeEqual(expected, provided);
}

function parseRecipients(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

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

function createRateLimiter(
  limit: number,
  windowMs: number,
): express.RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) =>
      ipKeyGenerator(request.ip || request.socket.remoteAddress || "127.0.0.1"),
  });
}

async function getOpenSummaries(database: Knex): Promise<OpenSummary[]> {
  const rows = (await database<RawSummaryRow>("opens")
    .leftJoin("messages", "messages.uid", "opens.msg_id")
    .select(
      "opens.msg_id as msg_id",
      "messages.subject as subject",
      "messages.sender as sender",
      "messages.recipients as recipients",
      "messages.sent_at as sent_at",
    )
    .count<{ total_opens: number | string }>({ total_opens: "*" })
    .max({ last_opened: "opens.created_at" })
    .groupBy(
      "opens.msg_id",
      "messages.subject",
      "messages.sender",
      "messages.recipients",
      "messages.sent_at",
    )
    .orderBy("last_opened", "desc")) as unknown as RawSummaryRow[];

  return rows.map((row) => ({
    msgId: row.msg_id,
    totalOpens: Number(row.total_opens),
    lastOpened: row.last_opened,
    sentAt: row.sent_at,
    subject: row.subject,
    sender: row.sender,
    recipients: parseRecipients(row.recipients),
  }));
}

async function getOpenEvents(
  database: Knex,
  msgId: string,
): Promise<OpenLogEntry[]> {
  const rows = await database<RawOpenRow>("opens")
    .where({ msg_id: msgId })
    .orderBy("created_at", "desc");
  return rows.map((row) => ({
    id: row.id,
    msgId: row.msg_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}

export function createApp(
  config: AppConfig,
  database: Knex,
  logRegistry: LogRegistry,
  warningStore: WarningStore,
): express.Express {
  const app = express();
  const opensApiLimiter = createRateLimiter(240, 60_000);
  const rateLimiter = createRateLimiter(120, 60_000);
  const ingestLimiter = createRateLimiter(600, 60_000);
  const loginLimiter = createRateLimiter(8, 15 * 60_000);

  const trackingBlacklist = new TrackingBlacklistStore(
    path.join(config.rspamdDir, "tracking-blacklist.txt"),
  );
  const dashboardIndexFile = path.join(
    config.publicDistRoot,
    dashboardIndexPath,
  );
  const trackingPixelFile = path.join(config.publicRoot, "images", "pixel.png");

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(express.json());
  app.use(express.static(config.publicRoot));
  app.use(
    "/dashboard",
    express.static(config.publicDistRoot, { index: false }),
  );

  app.post("/api/auth/login", loginLimiter, async (request, response, next) => {
    try {
      const email =
        typeof request.body?.email === "string"
          ? request.body.email.trim().toLowerCase()
          : "";
      const password =
        typeof request.body?.password === "string" ? request.body.password : "";
      const user = await database("users").where({ email }).first();
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        response.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const mustChangePassword =
        Boolean(user.must_change_password) || password === "password123";
      if (mustChangePassword && !user.must_change_password) {
        await database("users").where({ id: user.id }).update({
          must_change_password: true,
        });
      }

      const token = await createSession(database, user.id);
      setSessionCookie(response, token, request.secure);
      response.json({
        authenticated: true,
        email: user.email,
        mustChangePassword,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/session", async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(database, request);
      response.json(
        user
          ? {
              authenticated: true,
              email: user.email,
              mustChangePassword: user.mustChangePassword,
            }
          : { authenticated: false },
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", async (request, response, next) => {
    try {
      await destroySession(database, request);
      clearSessionCookie(response, request.secure);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/password", async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(database, request);
      if (!user) {
        response.status(401).json({ error: "Authentication required" });
        return;
      }

      const password = request.body?.password;
      if (
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128
      ) {
        response.status(400).json({
          error: "Password must be between 12 and 128 characters",
        });
        return;
      }

      if (password === "password123") {
        response.status(400).json({ error: "Choose a different password" });
        return;
      }

      const storedUser = await database("users")
        .where({ id: user.id })
        .first("password_hash");
      if (await verifyPassword(password, storedUser.password_hash)) {
        response.status(400).json({ error: "Choose a different password" });
        return;
      }

      await database("users")
        .where({ id: user.id })
        .update({
          password_hash: await hashPassword(password),
          must_change_password: false,
        });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

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

        void database("opens")
          .insert({
            msg_id: msgId,
            ip_address: getClientIp(request),
            user_agent: request.header("user-agent") || null,
          })
          .catch((error: unknown) => {
            console.error(error instanceof Error ? error.message : error);
          });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/messages",
    ingestLimiter,
    async (request: Request, response: Response, next) => {
      try {
        if (!isAuthorized(request, config.trackingApiToken)) {
          response.status(401).json({ error: "Unauthorized" });
          return;
        }

        const body = request.body ?? {};
        const uid = optionalString(body.uid, 128);
        if (!uid) {
          response.status(400).json({ error: "Missing uid" });
          return;
        }

        const recipients = Array.isArray(body.recipients)
          ? body.recipients
              .map((item: unknown) => optionalString(item, 320))
              .filter((item: string | null): item is string => item !== null)
              .slice(0, 100)
          : [];

        await database("messages")
          .insert({
            uid,
            message_id: optionalString(body.message_id, 998),
            sent_at: normalizeSentAt(body.sent_at),
            subject: optionalString(body.subject, 998),
            sender: optionalString(body.sender, 320),
            recipients: JSON.stringify(recipients),
            user: optionalString(body.user, 320),
          })
          .onConflict("uid")
          .merge();

        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  app.use("/api", async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(database, request);
      if (!user) {
        response.status(401).json({ error: "Authentication required" });
        return;
      }

      if (user.mustChangePassword) {
        response.status(403).json({
          error: "Update your password before continuing",
          code: "password-change-required",
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users", rateLimiter, async (_request, response, next) => {
    try {
      const users = await database("users")
        .select("id", "email", "created_at")
        .orderBy("email", "asc");
      response.json(
        users.map((user) => ({
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  app.put(
    "/api/users/:userId",
    rateLimiter,
    async (request, response, next) => {
      try {
        const userId = Number(getRouteParam(request.params.userId));
        if (!Number.isSafeInteger(userId) || userId < 1) {
          response.status(400).json({ error: "Invalid user id" });
          return;
        }

        const email =
          typeof request.body?.email === "string"
            ? request.body.email.trim().toLowerCase()
            : "";
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
          response.status(400).json({ error: "Enter a valid email address" });
          return;
        }

        const password = request.body?.password;
        if (
          password !== undefined &&
          password !== "" &&
          (typeof password !== "string" ||
            password.length < 12 ||
            password.length > 128)
        ) {
          response.status(400).json({
            error: "Password must be between 12 and 128 characters",
          });
          return;
        }
        if (password === "password123") {
          response.status(400).json({ error: "Choose a different password" });
          return;
        }

        const existingUser = await database("users")
          .where({ id: userId })
          .first("id");
        if (!existingUser) {
          response.status(404).json({ error: "User not found" });
          return;
        }

        const updates: {
          email: string;
          password_hash?: string;
          must_change_password?: boolean;
        } = { email };
        if (typeof password === "string" && password.length > 0) {
          updates.password_hash = await hashPassword(password);
          updates.must_change_password = false;
        }

        await database("users").where({ id: userId }).update(updates);
        response.json({ id: userId, email });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("UNIQUE constraint failed: users.email")
        ) {
          response.status(409).json({ error: "That email is already in use" });
          return;
        }

        next(error);
      }
    },
  );

  app.get("/api/opens", opensApiLimiter, async (_request, response, next) => {
    try {
      response.json(await getOpenSummaries(database));
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/opens/:msgId",
    opensApiLimiter,
    async (request, response, next) => {
      try {
        const msgId = getRouteParam(request.params.msgId);
        if (!msgId) {
          response.status(400).json({ error: "Missing message id" });
          return;
        }

        response.json(await getOpenEvents(database, msgId));
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/api/logs", rateLimiter, async (_request, response, next) => {
    try {
      response.json(await listLogFiles(logRegistry));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/logs/:name", rateLimiter, async (request, response, next) => {
    try {
      const lines = Number(request.query.lines ?? 200);
      const logName = getRouteParam(request.params.name);
      if (!logName) {
        response.status(400).json({ error: "Missing log name" });
        return;
      }

      response.json(await readLogFile(logRegistry, logName, lines));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/warnings", rateLimiter, (_request, response) => {
    response.json(warningStore.getState());
  });

  app.post(
    "/api/warnings/recheck",
    rateLimiter,
    async (_request, response, next) => {
      try {
        response.json(await warningStore.refresh());
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/api/tracking-blacklist",
    rateLimiter,
    async (_request, response, next) => {
      try {
        response.json({ addresses: await trackingBlacklist.getAddresses() });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/tracking-blacklist",
    rateLimiter,
    async (request, response, next) => {
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
    },
  );

  app.delete(
    "/api/tracking-blacklist/:address",
    rateLimiter,
    async (request, response, next) => {
      try {
        const address = getRouteParam(request.params.address);
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
    },
  );

  app.get(
    ["/dashboard", "/dashboard/*path"],
    rateLimiter,
    (_request, response, next) => {
      response.sendFile(dashboardIndexFile, (error) => {
        if (error) {
          next(error);
        }
      });
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
