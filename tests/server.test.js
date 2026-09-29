const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createServerApplication,
  ensureTrackingFilter,
  loadConfig,
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

test("loadConfig accepts a custom Rspamd directory", () => {
  const config = loadConfig({
    DMS_ROOT: "/mail",
    RSPAMD_DIR: "/rspamd/custom",
  });
  assert.equal(config.rspamdDir, "/rspamd/custom");

  const defaultConfig = loadConfig({ DMS_ROOT: "/mail" });
  assert.equal(defaultConfig.rspamdDir, path.join("/mail", "rspamd"));
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
    'local tracking_base_url = "__TRACKING_BASE_URL__"',
  );
  await fs.writeFile(target, "-- existing lua");

  await ensureTrackingFilter(rspamdDir, source, "https://tracker.example.com");
  assert.equal(
    await fs.readFile(target, "utf8"),
    'local tracking_base_url = "https://tracker.example.com"',
  );
});

test("ensureTrackingFilter leaves an identical filter unchanged", async () => {
  const root = await makeTempDir();
  const rspamdDir = path.join(root, "rspamd");
  const source = path.join(root, "rspamd.local.lua");
  const target = path.join(rspamdDir, "rspamd.local.lua");

  await fs.mkdir(rspamdDir, { recursive: true });
  await fs.writeFile(
    source,
    'local tracking_base_url = "__TRACKING_BASE_URL__"',
  );
  await fs.writeFile(
    target,
    'local tracking_base_url = "https://tracker.example.com"',
  );

  await ensureTrackingFilter(rspamdDir, source, "https://tracker.example.com");
  assert.equal(
    await fs.readFile(target, "utf8"),
    'local tracking_base_url = "https://tracker.example.com"',
  );
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
    const warningState = await (await fetch(`${baseUrl}/api/warnings`)).json();
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
  await fs.writeFile(luaSource, "-- lua");
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
    const warningState = await (await fetch(`${baseUrl}/api/warnings`)).json();
    assert.equal(warningState.warnings.length, 1);
    assert.equal(warningState.warnings[0].code, "rspamd-dir-missing");

    await fs.mkdir(rspamdDir, { recursive: true });
    const refreshedState = await (
      await fetch(`${baseUrl}/api/warnings/recheck`, { method: "POST" })
    ).json();
    assert.equal(refreshedState.warnings.length, 0);
    assert.equal(
      await fs.readFile(target, "utf8"),
      'local tracking_base_url = "https://tracker.example.com"',
    );
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
      const response = await fetch(`${baseUrl}/api/opens`);
      const payload = await response.json();
      return payload.length ? payload : null;
    });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].msgId, "message-123");
    assert.equal(summaries[0].totalOpens, 1);

    const entries = await waitFor(async () => {
      const response = await fetch(`${baseUrl}/api/opens/message-123`);
      const payload = await response.json();
      return payload.length ? payload : null;
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].ipAddress, "203.0.113.10");
    assert.equal(entries[0].userAgent, "Node Test Agent");

    const logs = await (await fetch(`${baseUrl}/api/logs`)).json();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].name, "rspamd");

    const logContent = await (
      await fetch(`${baseUrl}/api/logs/rspamd?lines=2`)
    ).json();
    assert.equal(logContent.content, "second\nthird");

    const missingLogResponse = await fetch(`${baseUrl}/api/logs/unknown`);
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
