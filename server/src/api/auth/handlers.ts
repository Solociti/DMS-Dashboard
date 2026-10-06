import type { Request, RequestHandler } from "express";
import type { Knex } from "knex";

import {
  clearSessionCookie,
  createSession,
  destroySession,
  destroyUserSessions,
  getAuthenticatedUser,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "../../auth";

export function login(database: Knex): RequestHandler {
  return async (request, response, next) => {
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
  };
}

export function session(database: Knex): RequestHandler {
  return async (request, response, next) => {
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
  };
}

export function logout(database: Knex): RequestHandler {
  return async (request, response, next) => {
    try {
      await destroySession(database, request);
      clearSessionCookie(response, request.secure);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}

export function changePassword(database: Knex): RequestHandler {
  return async (request, response, next) => {
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
      await destroyUserSessions(database, user.id, request);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuthenticatedApi(database: Knex): RequestHandler {
  return async (request: Request, response, next) => {
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
  };
}