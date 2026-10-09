import type { Knex } from "knex";

import type {
  DailyStat,
  OpenLogEntry,
  OpenSummaryPage,
} from "../../../../common/types";
import { getIgnoredIpMatches } from "../ignored-ips/helpers";
import { OPEN_PAGE_SIZE, type OpenFilters } from "./helpers";

interface RawOpenRow {
  id: number;
  msg_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface RawSummaryRow {
  uid: string;
  open_count: number | string;
  last_opened_at: string | null;
  sent_at: string | null;
  subject: string | null;
  sender: string | null;
  recipients: string | null;
}

function parseRecipients(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function getOpenSummaries(
  database: Knex,
  filters: OpenFilters,
  userEmail: string | null,
): Promise<OpenSummaryPage> {
  const query = database<RawSummaryRow>("messages").select(
    "uid",
    "open_count",
    "last_opened_at",
    "sent_at",
    "subject",
    "sender",
    "recipients",
  );

  if (filters.scope === "mine") {
    const email = (userEmail ?? "").toLowerCase();
    query.where((builder) =>
      builder
        .whereRaw("lower(messages.user) = ?", [email])
        .orWhereRaw("lower(messages.sender) = ?", [email]),
    );
  }

  if (filters.query) {
    const pattern = `%${filters.query.replace(/[\\%_]/g, "\\$&")}%`;
    query.where((builder) =>
      builder
        .whereRaw("messages.subject like ? escape '\\'", [pattern])
        .orWhereRaw("messages.sender like ? escape '\\'", [pattern])
        .orWhereRaw("messages.recipients like ? escape '\\'", [pattern]),
    );
  }

  const totals = (await database
    .from(query.clone().as("filtered"))
    .count({ total: "*" })
    .sum({ total_opens: "open_count" })
    .max({ last_activity: "last_opened_at" })
    .first()) as {
    total: number | string;
    total_opens: number | string | null;
    last_activity: string | null;
  };

  if (filters.sort === "sent") {
    query.orderBy("sent_at", filters.direction);
    query.orderBy("last_opened_at", "desc");
  } else {
    // Never-opened messages sort after opened ones, newest first.
    query.orderByRaw("last_opened_at is null");
    query.orderBy("last_opened_at", filters.direction);
    query.orderBy("created_at", "desc");
  }

  query.limit(OPEN_PAGE_SIZE).offset((filters.page - 1) * OPEN_PAGE_SIZE);

  const rows = (await query) as unknown as RawSummaryRow[];

  return {
    total: Number(totals.total),
    totalOpens: Number(totals.total_opens ?? 0),
    lastActivity: totals.last_activity ?? null,
    page: filters.page,
    pageSize: OPEN_PAGE_SIZE,
    items: rows.map((row) => ({
      msgId: row.uid,
      totalOpens: Number(row.open_count),
      lastOpened: row.last_opened_at,
      sentAt: row.sent_at,
      subject: row.subject,
      sender: row.sender,
      recipients: parseRecipients(row.recipients),
    })),
  };
}

export const DAILY_STAT_DAYS = 90;

export async function getDailyStats(database: Knex): Promise<DailyStat[]> {
  const ignoredIps = await getIgnoredIpMatches(database);

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (DAILY_STAT_DAYS - 1));
  const startDate = start.toISOString().slice(0, 10);

  const messageQuery = database("messages")
    .select(database.raw("date(created_at) as day"))
    .count({ count: "*" })
    .whereRaw("date(created_at) >= ?", [startDate])
    .groupBy("day");

  const openQuery = database("opens")
    .select(database.raw("date(created_at) as day"))
    .count({ count: "*" })
    .whereRaw("date(created_at) >= ?", [startDate])
    .groupBy("day");

  if (ignoredIps.length > 0) {
    openQuery.where((builder) =>
      builder.whereNull("ip_address").orWhereNotIn("ip_address", ignoredIps),
    );
  }

  const [messageRows, openRows] = (await Promise.all([
    messageQuery,
    openQuery,
  ])) as unknown as Array<Array<{ day: string; count: number | string }>>;

  const messages = new Map(messageRows.map((r) => [r.day, Number(r.count)]));
  const opens = new Map(openRows.map((r) => [r.day, Number(r.count)]));

  const days: DailyStat[] = [];
  for (let i = 0; i < DAILY_STAT_DAYS; i += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const date = day.toISOString().slice(0, 10);
    days.push({
      date,
      messages: messages.get(date) ?? 0,
      opens: opens.get(date) ?? 0,
    });
  }

  return days;
}

export async function getOpenEvents(
  database: Knex,
  msgId: string,
  includeIgnored = false,
): Promise<OpenLogEntry[]> {
  const ignoredIps = await getIgnoredIpMatches(database);
  const ignoredSet = new Set(ignoredIps);

  const query = database<RawOpenRow>("opens")
    .where({ msg_id: msgId })
    .orderBy("created_at", "desc");

  if (!includeIgnored && ignoredIps.length > 0) {
    query.where((builder) =>
      builder.whereNull("ip_address").orWhereNotIn("ip_address", ignoredIps),
    );
  }

  const rows = await query;
  return rows.map((row) => ({
    id: row.id,
    msgId: row.msg_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    ignored: row.ip_address !== null && ignoredSet.has(row.ip_address),
  }));
}