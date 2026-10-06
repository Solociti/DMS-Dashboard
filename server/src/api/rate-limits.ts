import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import type { ApiRateLimiters } from "./types";

function createRateLimiter(
  limit: number,
  windowMs: number,
): ApiRateLimiters["general"] {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) =>
      ipKeyGenerator(request.ip || request.socket.remoteAddress || "127.0.0.1"),
  });
}

export function createApiRateLimiters(): ApiRateLimiters {
  return {
    general: createRateLimiter(120, 60_000),
    ingest: createRateLimiter(600, 60_000),
    login: createRateLimiter(8, 15 * 60_000),
    opens: createRateLimiter(240, 60_000),
  };
}