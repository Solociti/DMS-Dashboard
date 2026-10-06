import type { Request } from "express";
import type { Knex } from "knex";
import net from "node:net";

import type { IgnoredIp } from "../../../../common/types";

const mappedPrefix = "::ffff:";

export class InvalidIpError extends Error {}

export function normalizeIp(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const ip = trimmed.toLowerCase().startsWith(mappedPrefix)
    ? trimmed.slice(mappedPrefix.length)
    : trimmed;

  if (!net.isIP(ip)) {
    throw new InvalidIpError("Enter a valid IPv4 or IPv6 address");
  }

  return ip.toLowerCase();
}

export function normalizeNote(value: unknown): string | null {
  const note = typeof value === "string" ? value.trim().slice(0, 200) : "";
  return note || null;
}

export function getRequestIp(request: Request): string | null {
  const raw = request.ip || request.socket.remoteAddress;
  try {
    return normalizeIp(raw);
  } catch {
    return null;
  }
}

export function getRouteIp(value: string | string[] | undefined): string {
  return normalizeIp(Array.isArray(value) ? value[0] : value);
}

export async function listIgnoredIps(database: Knex): Promise<IgnoredIp[]> {
  const rows = await database<{ ip: string; note: string | null }>(
    "ignored_ips",
  )
    .select("ip", "note")
    .orderBy("created_at", "asc");
  return rows.map((row) => ({ ip: row.ip, note: row.note }));
}

// Includes IPv4-mapped IPv6 spellings, since opens store the raw request IP.
export async function getIgnoredIpMatches(database: Knex): Promise<string[]> {
  const ips = await listIgnoredIps(database);
  return ips.flatMap(({ ip }) =>
    net.isIPv4(ip) ? [ip, `${mappedPrefix}${ip}`] : [ip],
  );
}
