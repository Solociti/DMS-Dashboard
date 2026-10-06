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
  msg_id: string;
  total_opens: number | string;
  last_opened: string | null;
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
  const ignoredIps = await getIgnoredIpMatches(database);

  const query = database<RawSummaryRow>("opens")
    .leftJoin("messages", "messages.uid", "opens.msg_id")
    .select(
      "opens.msg_id as msg_id",
      "messages.subject as subject",
      "messages.sender as sender",
      "messages.recipients as recipients",
      "messages.sent_at as sent_at",
    )
    .count<{ total_opens: number | string }>({ total_opens: "*" })
    .max({ last_opened: "opens.created_at" })
    .groupBy(
      "opens.msg_id",
      "messages.subject",
      "messages.sender",
      "messages.recipients",
      "messages.sent_at",
    );

  if (ignoredIps.length > 0) {
    query.where((builder) =>
      builder
        .whereNull("opens.ip_address")
        .orWhereNotIn("opens.ip_address", ignoredIps),
    );
  }

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
    .sum({ total_opens: "total_opens" })
    .max({ last_activity: "last_opened" })
    .first()) as {
    total: number | string;
    total_opens: number | string | null;
    last_activity: string | null;
  };

  if (filters.sort === "sent") {
    query.orderBy("messages.sent_at", filters.direction);
    query.orderBy("last_opened", "desc");
  } else {
    query.orderBy("last_opened", filters.direction);
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
      msgId: row.msg_id,
      totalOpens: Number(row.total_opens),
      lastOpened: row.last_opened,
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
): Promise<OpenLogEntry[]> {
  const ignoredIps = await getIgnoredIpMatches(database);

  const query = database<RawOpenRow>("opens")
    .where({ msg_id: msgId })
    .orderBy("created_at", "desc");

  if (ignoredIps.length > 0) {
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
  }));
}