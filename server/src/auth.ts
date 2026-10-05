import crypto, { scrypt as callbackScrypt, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { Knex } from "knex";

const sessionCookieName = "dms_dashboard_session";
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
const defaultEmail = "admin@example.com";
const defaultPassword = "changeme123";
const passwordHashLength = 64;

export interface AuthenticatedUser {
  id: number;
  email: string;
  mustChangePassword: boolean;
}

interface StoredUser extends AuthenticatedUser {
  password_hash: string;
  must_change_password: number;
}

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    callbackScrypt(password, salt, passwordHashLength, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [saltHex, keyHex] = storedHash.split(":");
  if (!saltHex || !keyHex || !/^[0-9a-f]{32}$/.test(saltHex)) {
    return false;
  }

  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== passwordHashLength) {
    return false;
  }

  const actual = await scrypt(password, Buffer.from(saltHex, "hex"));
  return crypto.timingSafeEqual(expected, actual);
}

export async function ensureDefaultAdmin(database: Knex): Promise<void> {
  const existing = await database("users").where({ email: defaultEmail }).first("id");
  if (existing) {
    return;
  }

  await database("users")
    .insert({
      email: defaultEmail,
      password_hash: await hashPassword(defaultPassword),
      must_change_password: true,
    })
    .onConflict("email")
    .ignore();
}

function parseSessionToken(request: Request): string | null {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  const token = cookie?.slice(sessionCookieName.length + 1);
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

export async function getAuthenticatedUser(
  database: Knex,
  request: Request,
): Promise<AuthenticatedUser | null> {
  const token = parseSessionToken(request);
  if (!token) {
    return null;
  }

  const row = (await database("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .where({ token_hash: crypto.createHash("sha256").update(token).digest("hex") })
    .where("sessions.expires_at", ">", new Date().toISOString())
    .select(
      "users.id as id",
      "users.email as email",
      "users.must_change_password as must_change_password",
    )
    .first()) as Pick<StoredUser, "id" | "email" | "must_change_password"> | undefined;

  return row
    ? {
        id: row.id,
        email: row.email,
        mustChangePassword: Boolean(row.must_change_password),
      }
    : null;
}

export async function createSession(
  database: Knex,
  userId: number,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await database("sessions").insert({
    user_id: userId,
    token_hash: crypto.createHash("sha256").update(token).digest("hex"),
    expires_at: new Date(Date.now() + sessionLifetimeMs).toISOString(),
  });
  return token;
}

export async function destroySession(
  database: Knex,
  request: Request,
): Promise<void> {
  const token = parseSessionToken(request);
  if (token) {
    await database("sessions")
      .where({ token_hash: crypto.createHash("sha256").update(token).digest("hex") })
      .delete();
  }
}

export function setSessionCookie(response: Response, token: string, secure: boolean): void {
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionLifetimeMs / 1000}${secure ? "; Secure" : ""}`,
  );
}

export function clearSessionCookie(response: Response, secure: boolean): void {
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
  );
}
