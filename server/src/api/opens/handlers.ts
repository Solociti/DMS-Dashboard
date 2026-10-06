import type { Knex } from "knex";

import type { OpenLogEntry, OpenSummary } from "../../../../common/types";

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

export async function getOpenSummaries(database: Knex): Promise<OpenSummary[]> {
  const rows = (await database<RawSummaryRow>("opens")
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
    )
    .orderBy("last_opened", "desc")) as unknown as RawSummaryRow[];

  return rows.map((row) => ({
    msgId: row.msg_id,
    totalOpens: Number(row.total_opens),
    lastOpened: row.last_opened,
    sentAt: row.sent_at,
    subject: row.subject,
    sender: row.sender,
    recipients: parseRecipients(row.recipients),
  }));
}

export async function getOpenEvents(
  database: Knex,
  msgId: string,
): Promise<OpenLogEntry[]> {
  const rows = await database<RawOpenRow>("opens")
    .where({ msg_id: msgId })
    .orderBy("created_at", "desc");
  return rows.map((row) => ({
    id: row.id,
    msgId: row.msg_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}