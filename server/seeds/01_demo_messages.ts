import crypto from "node:crypto";
import type { Knex } from "knex";

const DAYS = 90;
const NO_EMAIL_DAY_CHANCE = 0.2;
const NO_OPEN_DAY_CHANCE = 0.08;
const OPEN_CHANCE = 0.6;

const sender = "hello@brightpathcleaning.example";

const subjects = [
  "Your invoice is ready",
  "Quote for your upcoming project",
  "Appointment confirmation",
  "Reminder: your appointment is tomorrow",
  "Thank you for your business!",
  "Following up on our conversation",
  "Your order has shipped",
  "Monthly newsletter: tips and updates",
  "Payment received - thank you",
  "Scheduling your next service",
  "We'd love your feedback",
  "Holiday hours announcement",
  "Updated pricing for next quarter",
  "Welcome! Here's what to expect",
  "Overdue invoice reminder",
  "Proposal attached for your review",
  "Seasonal promotion: 10% off this month",
  "Service visit summary",
];

const firstNames = ["alex", "jordan", "sam", "taylor", "morgan", "casey", "riley", "jamie", "chris", "pat", "dana", "lee"];
const domains = ["gmail.com", "outlook.com", "yahoo.com", "acmeplumbing.example", "harborcafe.example", "northwindfarms.example"];

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile Safari/537.36",
  "GoogleImageProxy",
];

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const between = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min + 1));

// Matches SQLite's CURRENT_TIMESTAMP format used by the default created_at column.
const sqliteTimestamp = (date: Date): string =>
  date.toISOString().slice(0, 19).replace("T", " ");

const randomIp = (): string =>
  `${between(11, 223)}.${between(0, 255)}.${between(0, 255)}.${between(1, 254)}`;

export async function seed(knex: Knex): Promise<void> {
  const now = new Date();
  const messages: Record<string, unknown>[] = [];
  const opens: Record<string, unknown>[] = [];

  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    if (Math.random() < NO_EMAIL_DAY_CHANCE) {
      continue;
    }

    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - daysAgo);
    const isWeekend = [0, 6].includes(day.getUTCDay());
    const count = isWeekend ? between(1, 2) : between(1, 8);
    const suppressOpens = Math.random() < NO_OPEN_DAY_CHANCE;

    for (let i = 0; i < count; i++) {
      const sentAt = new Date(day);
      sentAt.setUTCHours(between(13, 23), between(0, 59), between(0, 59), 0);
      if (sentAt > now) {
        continue;
      }

      const uid = crypto.randomBytes(8).toString("hex");
      const recipient = `${pick(firstNames)}.${crypto.randomBytes(2).toString("hex")}@${pick(domains)}`;
      const openTimes: Date[] = [];

      if (!suppressOpens && Math.random() < OPEN_CHANCE) {
        // First open lands minutes to a couple of days later; repeats trail off.
        let openedAt = new Date(sentAt.getTime() + between(2, 60 * 48) * 60_000);
        for (let n = between(1, 4); n > 0; n--) {
          if (openedAt > now) {
            break;
          }
          openTimes.push(openedAt);
          openedAt = new Date(openedAt.getTime() + between(10, 60 * 24) * 60_000);
        }
      }

      for (const openedAt of openTimes) {
        opens.push({
          msg_id: uid,
          ip_address: randomIp(),
          user_agent: pick(userAgents),
          created_at: sqliteTimestamp(openedAt),
        });
      }

      messages.push({
        uid,
        message_id: `<${uid}@brightpathcleaning.example>`,
        subject: pick(subjects),
        sender,
        recipients: JSON.stringify([recipient]),
        user: sender,
        sent_at: sentAt.toISOString(),
        created_at: sqliteTimestamp(sentAt),
        open_count: openTimes.length,
        last_opened_at: openTimes.length
          ? sqliteTimestamp(openTimes[openTimes.length - 1])
          : null,
      });
    }
  }

  await knex.transaction(async (trx) => {
    await trx("opens").del();
    await trx("messages").del();
    await trx.batchInsert("messages", messages, 50);
    await trx.batchInsert("opens", opens, 50);
  });

  console.log(`Seeded ${messages.length} messages and ${opens.length} opens.`);
}
