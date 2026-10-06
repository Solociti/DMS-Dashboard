import crypto from "node:crypto";
import type { Request } from "express";
import type { Knex } from "knex";

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

export function isAuthorized(request: Request, token: string | null): boolean {
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

export async function saveMessage(
  database: Knex,
  body: Record<string, unknown>,
): Promise<boolean> {
  const uid = optionalString(body.uid, 128);
  if (!uid) {
    return false;
  }

  const recipients = Array.isArray(body.recipients)
    ? body.recipients
        .map((item) => optionalString(item, 320))
        .filter((item): item is string => item !== null)
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

  return true;
}
