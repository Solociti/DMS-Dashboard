// Dev only: fakes Rspamd metadata reports and pixel opens against a running dashboard.
// Usage: node scripts/fake-mail.mjs [messages=5] [opens=10] [--url=http://localhost:3000] [--lua=path]
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => arg.slice(2).split("=")),
);
const [messageCount = 5, openCount = 10] = args
  .filter((arg) => !arg.startsWith("--"))
  .map(Number);

const baseUrl = (flags.url ?? "http://localhost:3000").replace(/\/$/, "");
const luaPath = path.resolve(
  flags.lua ?? "dms-root/config/rspamd/rspamd.local.lua",
);

const subjects = [
  "Quarterly report",
  "Lunch on Friday?",
  "Invoice #4821",
  "Meeting notes",
  "Re: project timeline",
  "Welcome aboard",
  "Your order has shipped",
];
const people = ["alice", "bob", "carol", "dave", "erin", "frank"];
const domains = ["example.com", "example.org", "mail.test"];
const agents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15",
  "GoogleImageProxy",
];

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const address = () => `${pick(people)}@${pick(domains)}`;

async function readToken() {
  const lua = await fs.readFile(luaPath, "utf8").catch(() => {
    throw new Error(
      `Cannot read ${luaPath}; start the dashboard first so it installs the filter (or pass --lua=).`,
    );
  });
  const token = /^local TRACKING_API_TOKEN = "([0-9a-f]+)"$/m.exec(lua)?.[1];
  if (!token) {
    throw new Error(`No TRACKING_API_TOKEN found in ${luaPath}`);
  }
  return token;
}

async function createMessage(token) {
  const uid = crypto.randomBytes(3).toString("hex");
  const recipients = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, address);
  const response = await fetch(`${baseUrl}/api/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      uid,
      message_id: `<${crypto.randomUUID()}@${pick(domains)}>`,
      subject: `${pick(subjects)} ${Math.floor(Math.random() * 100)}`,
      sender: address(),
      recipients,
      user: address(),
    }),
  });
  if (!response.ok) {
    throw new Error(`POST /api/messages failed: ${response.status}`);
  }
  // Half of the new messages get an immediate open.
  if (Math.random() < 0.5) {
    await openPixel(uid);
  }
  return uid;
}

async function openPixel(uid) {
  const response = await fetch(`${baseUrl}/open/${encodeURIComponent(uid)}.png`, {
    headers: { "User-Agent": pick(agents) },
  });
  if (!response.ok) {
    throw new Error(`GET /open/${uid}.png failed: ${response.status}`);
  }
  await response.arrayBuffer();
}

const token = await readToken();

const created = [];
for (let i = 0; i < messageCount; i += 1) {
  const uid = await createMessage(token);
  created.push(uid);
  console.log(`message ${uid}`);
}

const summaries = await (await fetch(`${baseUrl}/api/opens`)).json();
// /api/opens only lists opened messages, so add this run's messages to the pool.
const pool = [...new Set([...summaries.map((row) => row.msgId), ...created])];
if (pool.length === 0) {
  console.log("No messages to open.");
} else {
  for (let i = 0; i < openCount; i += 1) {
    const msgId = pick(pool);
    await openPixel(msgId);
    console.log(`open ${msgId}`);
  }
}
