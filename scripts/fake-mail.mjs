// Dev only: fakes Rspamd metadata reports and pixel opens against a running dashboard.
// Usage: node scripts/fake-mail.mjs [messages=5] [opens=10] [--url=http://localhost:3000] [--lua=path] [--logs=dir]
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

const logDir = path.resolve(flags.logs ?? "dms-root/logs");

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

async function appendLogs(messageId, subject, sender, recipients) {
  const stamp = new Date().toISOString();
  const queueId = crypto.randomBytes(5).toString("hex").toUpperCase();
  const score = (Math.random() * 6 - 1).toFixed(2);
  const action = score > 4 ? "add header" : "no action";
  const mail = [
    `${stamp} mail postfix/smtpd[${100 + Math.floor(Math.random() * 900)}]: ${queueId}: client=unknown[10.0.0.${1 + Math.floor(Math.random() * 254)}]`,
    `${stamp} mail postfix/cleanup[${100 + Math.floor(Math.random() * 900)}]: ${queueId}: message-id=${messageId}`,
    `${stamp} mail postfix/qmgr[1]: ${queueId}: from=<${sender}>, size=${2000 + Math.floor(Math.random() * 50000)}, nrcpt=${recipients.length} (queue active)`,
    ...recipients.map(
      (to) =>
        `${stamp} mail postfix/lmtp[${100 + Math.floor(Math.random() * 900)}]: ${queueId}: to=<${to}>, relay=mail.test[private/dovecot-lmtp], delay=0.1, status=sent (250 2.0.0 OK)`,
    ),
  ];
  const rspamd = [
    `${stamp} #1 <${crypto.randomBytes(3).toString("hex")}>; task; rspamd_task_write_log: id: ${messageId}, qid: <${queueId}>, ip: 10.0.0.1, from: <${sender}>, (default: F (${action}): [${score}/15.00] [${subject.replaceAll(/\W+/g, "_")}]), len: 2048, time: 12.3ms, dns req: 2, digest: <${crypto.randomBytes(8).toString("hex")}>, rcpts: <${recipients.join(",")}>`,
  ];
  await fs.mkdir(logDir, { recursive: true });
  await Promise.all([
    fs.appendFile(path.join(logDir, "mail.log"), `${mail.join("\n")}\n`),
    fs.appendFile(path.join(logDir, "rspamd.log"), `${rspamd.join("\n")}\n`),
  ]);
}

async function createMessage(token) {
  const uid = crypto.randomBytes(3).toString("hex");
  const recipients = Array.from(
    { length: 1 + Math.floor(Math.random() * 3) },
    address,
  );
  const messageId = `<${crypto.randomUUID()}@${pick(domains)}>`;
  const subject = `${pick(subjects)} ${Math.floor(Math.random() * 100)}`;
  const sender = address();
  const response = await fetch(`${baseUrl}/api/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      uid,
      message_id: messageId,
      subject,
      sender,
      recipients,
      sent_at: Math.floor(Date.now() / 1000 - Math.random() * 3600),
      user: address(),
    }),
  });
  if (!response.ok) {
    throw new Error(`POST /api/messages failed: ${response.status}`);
  }
  await appendLogs(messageId, subject, sender, recipients);
  // Half of the new messages get an immediate open.
  if (Math.random() < 0.5) {
    await openPixel(uid);
  }
  return uid;
}

async function openPixel(uid) {
  const response = await fetch(
    `${baseUrl}/open/${encodeURIComponent(uid)}.png`,
    {
      headers: { "User-Agent": pick(agents) },
    },
  );
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

const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "fake@dev.local",
    password: "fake-dev-password",
  }),
});
if (!loginResponse.ok) {
  throw new Error(
    `Login as fake@dev.local failed: ${loginResponse.status} (is the server running with SEED_FAKE_USER=true?)`,
  );
}
const cookie = loginResponse.headers.getSetCookie()[0].split(";")[0];

const { items: summaries } = await (
  await fetch(`${baseUrl}/api/opens`, { headers: { Cookie: cookie } })
).json();
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
