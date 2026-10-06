import type { Request } from "express";

export function warnApi(request: Request, event: string, extra = ""): void {
  console.warn(
    `${request.method} ${request.originalUrl} ${event}${extra} IP: ${request.ip}`,
  );
}
