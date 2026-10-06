import type { RequestHandler } from "express";
import type { Knex } from "knex";

import {
  canManageUsers,
  destroyUserSessions,
  getAuthenticatedUser,
  hashPassword,
} from "../../auth";
import { warnApi } from "../log";
import { getUserRouteParam } from "./helpers";

export function listUsers(database: Knex): RequestHandler {
  return async (request, response, next) => {
    try {
      const currentUser = await getAuthenticatedUser(database, request);
      if (!currentUser || !canManageUsers(currentUser)) {
        warnApi(request, "Forbidden");
        response.status(403).json({ error: "Administrator access required" });
        return;
      }

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
  };
}

export function updateUser(database: Knex): RequestHandler {
  return async (request, response, next) => {
    try {
      const currentUser = await getAuthenticatedUser(database, request);
      if (!currentUser || !canManageUsers(currentUser)) {
        warnApi(request, "Forbidden");
        response.status(403).json({ error: "Administrator access required" });
        return;
      }

      const userId = Number(getUserRouteParam(request.params.userId));
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
        updates.must_change_password = userId !== currentUser.id;
      }

      await database("users").where({ id: userId }).update(updates);
      if (updates.password_hash) {
        await destroyUserSessions(
          database,
          userId,
          userId === currentUser.id ? request : undefined,
        );
      }
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
  };
}
