const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createServerApplication,
  createDatabase,
  ensureDatabaseDirectory,
  ensureTrackingFilter,
  loadConfig,
  runMigrations,
} = require("../build/server/index.js");

async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "dms-dashboard-"));
}

async function waitFor(check, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await check();
    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Timed out waiting for condition");
}

async function signInAdmin(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@example.com",
      password: "changeme123",
    }),
  });
  assert.equal(response.status, 200);
  const session = await response.json();
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  return { cookie, session };
}

async function authenticateAdmin(baseUrl) {
  const { cookie } = await signInAdmin(baseUrl);
  const response = await fetch(`${baseUrl}/api/auth/password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ password: "test-admin-password" }),
  });
  assert.equal(response.status, 204);
  return cookie;
}

function authFetch(url, cookie, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("cookie", cookie);
  return fetch(url, { ...options, headers });
}

test("loadConfig accepts a custom Rspamd directory", () => {
  const config = loadConfig({
    DMS_ROOT: "/mail",
    RSPAMD_DIR: "/rspamd/custom",
  });
  assert.equal(config.rspamdDir, "/rspamd/custom");

  const defaultConfig = loadConfig({ DMS_ROOT: "/mail" });
  assert.equal(defaultConfig.rspamdDir, path.join("/mail", "rspamd"));
});

test("default admin is only seeded when there are no users", async () => {
  const root = await makeTempDir();
  const databasePath = path.join(root, "data", "tracker.sqlite");
  await ensureDatabaseDirectory(databasePath);
  const database = createDatabase(databasePath);

  try {
    await runMigrations(database);
    await database("users")
      .where({ email: "admin@example.com" })
      .update({ email: "renamed-admin@example.com" });

    await runMigrations(database);

    assert.equal(
      await database("users")
        .count({ count: "*" })
        .first()
        .then((row) => Number(row.count)),
      1,
    );
    assert.equal(
      await database("users").where({ email: "admin@example.com" }).first(),
      undefined,
    );
  } finally {
    await database.destroy();
  }
});

test("ensureTrackingFilter aborts when Rspamd directory is missing", async () => {
  const root = await makeTempDir();
  const source = path.join(root, "rspamd.local.lua");
  await fs.writeFile(source, "-- lua");

  await assert.rejects(
    () => ensureTrackingFilter(path.join(root, "missing-rspamd"), source),
    /Required Rspamd directory is missing/,
  );
});

test("ensureTrackingFilter replaces an existing filter when its contents differ", async () => {
  const root = await makeTempDir();
  const dmsRoot = path.join(root, "dms");
  const rspamdDir = path.join(dmsRoot, "rspamd");
  const source = path.join(root, "rspamd.local.lua");
  const target = path.join(rspamdDir, "rspamd.local.lua");

  await fs.mkdir(rspamdDir, { recursive: true });
  await fs.writeFile(
    source,
    'local tracking_base_url = "__TRACKING_BASE_URL__"\nlocal TRACKING_API_TOKEN = "__TRACKING_API_TOKEN__"',
  );
  await fs.writeFile(target, "-- existing lua");

  const token = await ensureTrackingFilter(
    rspamdDir,
    source,
    "https://tracker.example.com",
  );
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(
    await fs.readFile(target, "utf8"),
    `local tracking_base_url = "https://tracker.example.com"\nlocal TRACKING_API_TOKEN = "${token}"`,
  );
});

test("ensureTrackingFilter leaves an identical filter unchanged", async () => {
  const root = await makeTempDir();
  const rspamdDir = path.join(root, "rspamd");
  const source = path.join(root, "rspamd.local.lua");
  const target = path.join(rspamdDir, "rspamd.local.lua");

  await fs.mkdir(rspamdDir, { recursive: true });
  const existingToken = "a".repeat(64);
  const installed = `local tracking_base_url = "https://tracker.example.com"\nlocal TRACKING_API_TOKEN = "${existingToken}"`;
  await fs.writeFile(
    source,
    'local tracking_base_url = "__TRACKING_BASE_URL__"\nlocal TRACKING_API_TOKEN = "__TRACKING_API_TOKEN__"',
  );
  await fs.writeFile(target, installed);

  const token = await ensureTrackingFilter(
    rspamdDir,
    source,
    "https://tracker.example.com",
  );
  assert.equal(token, existingToken);
  assert.equal(await fs.readFile(target, "utf8"), installed);
});

test("warning API reports missing tracking base URL and skips filter install", async () => {
  const root = await makeTempDir();
  const dmsRoot = path.join(root, "dms");
  const rspamdDir = path.join(dmsRoot, "rspamd");
  const publicDir = path.join(root, "public");
  const publicDistDir = path.join(publicDir, "dist");
  const luaSource = path.join(root, "rspamd.local.lua");
  const dbPath = path.join(root, "data", "tracker.sqlite");
  const target = path.join(rspamdDir, "rspamd.local.lua");

  await fs.mkdir(rspamdDir, { recursive: true });
  await fs.mkdir(publicDistDir, { recursive: true });
  await fs.writeFile(
    luaSource,
    'local tracking_base_url = "__TRACKING_BASE_URL__"',
  );
  await fs.writeFile(
    path.join(publicDistDir, "index.html"),
    "<!doctype html><title>ok</title>",
  );
  await fs.writeFile(
    path.join(publicDistDir, "login.html"),
    "<!doctype html><title>sign in</title>",
  );

  const { app, database } = await createServerApplication({
    appRoot: root,
    port: 0,
    databasePath: dbPath,
    dmsRoot,
    rspamdDir,
    trustProxy: false,
    trackingBaseUrl: null,
    trackingLuaSourcePath: luaSource,
    publicRoot: publicDir,
    publicDistRoot: publicDistDir,
    logFiles: {},
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const dashboardResponse = await fetch(`${baseUrl}/dashboard/logs`, {
      redirect: "manual",
    });
    assert.equal(dashboardResponse.status, 302);
    assert.equal(
      dashboardResponse.headers.get("location"),
      "/login?returnTo=%2Fdashboard%2Flogs",
    );
    const loginPageResponse = await fetch(
      `${baseUrl}${dashboardResponse.headers.get("location")}`,
    );
    assert.equal(loginPageResponse.status, 200);
    assert.match(await loginPageResponse.text(), /<title>sign in<\/title>/);

    const anonymousResponse = await fetch(`${baseUrl}/api/warnings`);
    assert.equal(anonymousResponse.status, 401);

    const { cookie, session } = await signInAdmin(baseUrl);
    assert.equal(session.email, "admin@example.com");
    assert.equal(session.mustChangePassword, true);
    const blockedResponse = await authFetch(`${baseUrl}/api/warnings`, cookie);
    assert.equal(blockedResponse.status, 403);
    assert.equal(
      (await blockedResponse.json()).code,
      "password-change-required",
    );
    const passwordChangeRedirect = await authFetch(
      `${baseUrl}/dashboard/`,
      cookie,
      { redirect: "manual" },
    );
    assert.equal(passwordChangeRedirect.status, 302);
    assert.equal(
      passwordChangeRedirect.headers.get("location"),
      "/login?returnTo=%2Fdashboard%2F",
    );

    const unchangedPasswordResponse = await fetch(
      `${baseUrl}/api/auth/password`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({ password: "changeme123" }),
      },
    );
    assert.equal(unchangedPasswordResponse.status, 400);

    const passwordResponse = await fetch(`${baseUrl}/api/auth/password`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ password: "test-admin-password" }),
    });
    assert.equal(passwordResponse.status, 204);
    const dashboardAfterReset = await authFetch(
      `${baseUrl}/dashboard/`,
      cookie,
      { redirect: "manual" },
    );
    assert.equal(dashboardAfterReset.status, 200);

    const hiddenUsersResponse = await fetch(`${baseUrl}/api/users`);
    assert.equal(hiddenUsersResponse.status, 401);
    await database("users").insert({
      email: "operator@example.com",
      password_hash: "unused-password-hash",
      must_change_password: false,
    });
    const operator = await database("users")
      .where({ email: "operator@example.com" })
      .first("id");
    const usersResponse = await authFetch(`${baseUrl}/api/users`, cookie);
    const users = await usersResponse.json();
    assert.equal(users.length, 2);
    assert.ok(users.every((user) => !("password_hash" in user)));

    const updateResponse = await authFetch(
      `${baseUrl}/api/users/${operator.id}`,
      cookie,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "support@example.com",
          password: "new-operator-password",
        }),
      },
    );
    assert.equal(updateResponse.status, 200);
    assert.deepEqual(await updateResponse.json(), {
      id: operator.id,
      email: "support@example.com",
    });
    const updatedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "support@example.com",
        password: "new-operator-password",
      }),
    });
    assert.equal(updatedLogin.status, 200);

    const warningState = await (
      await authFetch(`${baseUrl}/api/warnings`, cookie)
    ).json();
    assert.equal(warningState.warnings.length, 1);
    assert.equal(warningState.warnings[0].code, "tracking-base-url-missing");
    await assert.rejects(() => fs.access(target));
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await database.destroy();
  }
});

test("warning recheck clears missing directory warning and installs the filter", async () => {
  const root = await makeTempDir();
  const dmsRoot = path.join(root, "dms");
  const rspamdDir = path.join(root, "custom-rspamd");
  const publicDir = path.join(root, "public");
  const publicDistDir = path.join(publicDir, "dist");
  const luaSource = path.join(root, "rspamd.local.lua");
  const dbPath = path.join(root, "data", "tracker.sqlite");
  const target = path.join(rspamdDir, "rspamd.local.lua");

  await fs.mkdir(publicDistDir, { recursive: true });
  await fs.writeFile(
    luaSource,
    'local tracking_base_url = "__TRACKING_BASE_URL__"\nlocal TRACKING_API_TOKEN = "__TRACKING_API_TOKEN__"',
  );
  await fs.writeFile(
    path.join(publicDistDir, "index.html"),
    "<!doctype html><title>ok</title>",
  );

  const { app, database } = await createServerApplication({
    appRoot: root,
    port: 0,
    databasePath: dbPath,
    dmsRoot,
    rspamdDir,
    trustProxy: false,
    trackingBaseUrl: "https://tracker.example.com",
    trackingLuaSourcePath: luaSource,
    publicRoot: publicDir,
    publicDistRoot: publicDistDir,
    logFiles: {},
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const cookie = await authenticateAdmin(baseUrl);
    const warningState = await (
      await authFetch(`${baseUrl}/api/warnings`, cookie)
    ).json();
    assert.equal(warningState.warnings.length, 1);
    assert.equal(warningState.warnings[0].code, "rspamd-dir-missing");

    await fs.mkdir(rspamdDir, { recursive: true });
    const refreshedState = await (
      await authFetch(`${baseUrl}/api/warnings/recheck`, cookie, {
        method: "POST",
      })
    ).json();
    assert.equal(refreshedState.warnings.length, 0);
    assert.match(
      await fs.readFile(target, "utf8"),
      /^local tracking_base_url = "https:\/\/tracker\.example\.com"\nlocal TRACKING_API_TOKEN = "[0-9a-f]{64}"$/,
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await database.destroy();
  }
});

test("tracking blacklist API validates and persists sender addresses", async () => {
  const root = await makeTempDir();
  const rspamdDir = path.join(root, "rspamd");
  const publicDir = path.join(root, "public");
  const publicDistDir = path.join(publicDir, "dist");
  const luaSource = path.join(root, "rspamd.local.lua");
  const dbPath = path.join(root, "data", "tracker.sqlite");
  const blacklistPath = path.join(rspamdDir, "tracking-blacklist.txt");

  await fs.mkdir(rspamdDir, { recursive: true });
  await fs.mkdir(publicDistDir, { recursive: true });
  await fs.writeFile(
    luaSource,
    'local tracking_base_url = "__TRACKING_BASE_URL__"',
  );
  await fs.writeFile(
    path.join(publicDistDir, "index.html"),
    "<!doctype html><title>ok</title>",
  );

  const { app, database } = await createServerApplication({
    appRoot: root,
    port: 0,
    databasePath: dbPath,
    dmsRoot: root,
    rspamdDir,
    trustProxy: false,
    trackingBaseUrl: "https://tracker.example.com",
    trackingLuaSourcePath: luaSource,
    publicRoot: publicDir,
    publicDistRoot: publicDistDir,
    logFiles: {},
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const cookie = await authenticateAdmin(baseUrl);
    const initial = await (
      await authFetch(`${baseUrl}/api/tracking-blacklist`, cookie)
    ).json();
    assert.deepEqual(initial.addresses, []);

    const added = await authFetch(`${baseUrl}/api/tracking-blacklist`, cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: " Newsletter@Example.COM " }),
    });
    assert.equal(added.status, 200);
    assert.deepEqual((await added.json()).addresses, [
      "newsletter@example.com",
    ]);
    assert.equal(
      await fs.readFile(blacklistPath, "utf8"),
      "newsletter@example.com\n",
    );

    const duplicate = await authFetch(
      `${baseUrl}/api/tracking-blacklist`,
      cookie,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: "newsletter@example.com" }),
      },
    );
    assert.deepEqual((await duplicate.json()).addresses, [
      "newsletter@example.com",
    ]);

    const invalid = await authFetch(
      `${baseUrl}/api/tracking-blacklist`,
      cookie,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: "not-an-email" }),
      },
    );
    assert.equal(invalid.status, 400);

    const removed = await authFetch(
      `${baseUrl}/api/tracking-blacklist/${encodeURIComponent("newsletter@example.com")}`,
      cookie,
      { method: "DELETE" },
    );
    assert.deepEqual((await removed.json()).addresses, []);
    assert.equal(await fs.readFile(blacklistPath, "utf8"), "");
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await database.destroy();
  }
});

test("tracking pixel endpoint records opens and returns a png", async () => {
  const root = await makeTempDir();
  const dmsRoot = path.join(root, "dms");
  const rspamdDir = path.join(dmsRoot, "rspamd");
  const publicDir = path.join(root, "public");
  const publicDistDir = path.join(publicDir, "dist");
  const luaSource = path.join(root, "rspamd.local.lua");
  const logPath = path.join(dmsRoot, "logs", "rspamd.log");
  const dbPath = path.join(root, "data", "tracker.sqlite");

  await fs.mkdir(rspamdDir, { recursive: true });
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.mkdir(path.join(publicDir, "images"), { recursive: true });
  await fs.mkdir(publicDistDir, { recursive: true });
  await fs.writeFile(luaSource, "-- lua");
  await fs.writeFile(
    path.join(publicDir, "images", "pixel.png"),
    Buffer.from("png-pixel"),
  );
  await fs.writeFile(
    path.join(publicDistDir, "index.html"),
    "<!doctype html><title>ok</title>",
  );
  await fs.writeFile(logPath, "first\nsecond\nthird\n");

  const { app, database } = await createServerApplication({
    appRoot: root,
    port: 0,
    databasePath: dbPath,
    dmsRoot,
    rspamdDir,
    trustProxy: true,
    trackingBaseUrl: "https://tracker.example.com",
    trackingApiToken: "test-token",
    trackingLuaSourcePath: luaSource,
    publicRoot: publicDir,
    publicDistRoot: publicDistDir,
    logFiles: { rspamd: logPath },
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const cookie = await authenticateAdmin(baseUrl);
    const sentAt = "2026-10-01T12:30:00.000Z";
    const metadataResponse = await fetch(`${baseUrl}/api/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        uid: "message-123",
        message_id: "<message-123@example.com>",
        sent_at: Date.parse(sentAt) / 1000,
        subject: "Sent date test",
        sender: "sender@example.com",
        recipients: ["recipient@example.com"],
      }),
    });
    assert.equal(metadataResponse.status, 204);

    const pixelResponse = await fetch(`${baseUrl}/open/message-123.png`, {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.5",
        "user-agent": "Node Test Agent",
      },
    });

    assert.equal(pixelResponse.status, 200);
    assert.equal(pixelResponse.headers.get("content-type"), "image/png");
    assert.equal(
      pixelResponse.headers.get("cache-control"),
      "no-store, no-cache, must-revalidate, private",
    );
    assert.ok((await pixelResponse.arrayBuffer()).byteLength > 0);

    const summaries = await waitFor(async () => {
      const response = await authFetch(`${baseUrl}/api/opens`, cookie);
      const payload = (await response.json()).items;
      return payload.length ? payload : null;
    });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].msgId, "message-123");
    assert.equal(summaries[0].totalOpens, 1);
    assert.equal(summaries[0].sentAt, sentAt);
    assert.equal(summaries[0].subject, "Sent date test");

    const entries = await waitFor(async () => {
      const response = await authFetch(
        `${baseUrl}/api/opens/message-123`,
        cookie,
      );
      const payload = await response.json();
      return payload.length ? payload : null;
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].ipAddress, "203.0.113.10");
    assert.equal(entries[0].userAgent, "Node Test Agent");

    const logs = await (await authFetch(`${baseUrl}/api/logs`, cookie)).json();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].name, "rspamd");

    const logContent = await (
      await authFetch(`${baseUrl}/api/logs/rspamd?lines=2`, cookie)
    ).json();
    assert.equal(logContent.content, "second\nthird");

    const missingLogResponse = await authFetch(
      `${baseUrl}/api/logs/unknown`,
      cookie,
    );
    assert.equal(missingLogResponse.status, 404);
    assert.equal(
      (await missingLogResponse.json()).error,
      "Unknown log file: unknown",
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await database.destroy();
  }
});

test("opens API filters, sorts and hides ignored IPs", async () => {
  const root = await makeTempDir();
  const dmsRoot = path.join(root, "dms");
  const rspamdDir = path.join(dmsRoot, "rspamd");
  const publicDir = path.join(root, "public");
  const publicDistDir = path.join(publicDir, "dist");
  const luaSource = path.join(root, "rspamd.local.lua");
  const logPath = path.join(dmsRoot, "logs", "rspamd.log");

  await fs.mkdir(rspamdDir, { recursive: true });
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.mkdir(publicDistDir, { recursive: true });
  await fs.writeFile(luaSource, "-- lua");
  await fs.writeFile(logPath, "");

  const { app, database } = await createServerApplication({
    appRoot: root,
    port: 0,
    databasePath: path.join(root, "data", "tracker.sqlite"),
    dmsRoot,
    rspamdDir,
    trustProxy: true,
    trackingBaseUrl: "https://tracker.example.com",
    trackingApiToken: "test-token",
    trackingLuaSourcePath: luaSource,
    publicRoot: publicDir,
    publicDistRoot: publicDistDir,
    logFiles: { rspamd: logPath },
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const cookie = await authenticateAdmin(baseUrl);

    await database("messages").insert([
      { uid: "a", subject: "Invoice", sender: "admin@example.com", recipients: "[]", sent_at: "2026-10-01T00:00:00.000Z" },
      { uid: "b", subject: "Hello", sender: "other@example.com", recipients: "[]", sent_at: "2026-10-02T00:00:00.000Z" },
    ]);
    await database("opens").insert([
      { msg_id: "a", ip_address: "203.0.113.10" },
      { msg_id: "b", ip_address: "198.51.100.7" },
    ]);

    const list = async (query) =>
      (await (await authFetch(`${baseUrl}/api/opens?${query}`, cookie)).json()).items.map((row) => row.msgId);

    assert.deepEqual(await list("sort=sent&dir=asc"), ["a", "b"]);
    assert.deepEqual(await list("sort=sent&dir=desc"), ["b", "a"]);
    assert.deepEqual(await list("scope=mine"), ["a"]);
    assert.deepEqual(await list("q=hello"), ["b"]);

    const invalid = await authFetch(`${baseUrl}/api/ignored-ips`, cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ip: "not-an-ip" }),
    });
    assert.equal(invalid.status, 400);

    const added = await (
      await authFetch(`${baseUrl}/api/ignored-ips`, cookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ip: "203.0.113.10", note: "Home" }),
      })
    ).json();
    assert.deepEqual(added.ips, [{ ip: "203.0.113.10", note: "Home" }]);
    assert.deepEqual(await list(""), ["b"]);

    const removed = await (
      await authFetch(`${baseUrl}/api/ignored-ips/203.0.113.10`, cookie, {
        method: "DELETE",
      })
    ).json();
    assert.deepEqual(removed.ips, []);
    assert.equal((await list("")).length, 2);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await database.destroy();
  }
});
