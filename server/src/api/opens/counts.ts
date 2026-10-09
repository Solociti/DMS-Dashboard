import type { Knex } from "knex";

import { getIgnoredIpMatches } from "../ignored-ips/helpers";

/** Recomputes cached open stats (excluding ignored IPs) for one message, or all when `uid` is omitted. */
export async function recalculateOpenCounts(
  database: Knex,
  uid?: string,
): Promise<void> {
  const ignoredIps = await getIgnoredIpMatches(database);

  const ignoredClause = ignoredIps.length
    ? `AND (opens.ip_address IS NULL OR opens.ip_address NOT IN (${ignoredIps.map(() => "?").join(",")}))`
    : "";
  const visibleOpens = `opens.msg_id = messages.uid ${ignoredClause}`;

  await database.raw(
    `UPDATE messages SET
      open_count = (SELECT COUNT(*) FROM opens WHERE ${visibleOpens}),
      last_opened_at = (SELECT MAX(created_at) FROM opens WHERE ${visibleOpens})
      ${uid === undefined ? "" : "WHERE uid = ?"}`,
    [...ignoredIps, ...ignoredIps, ...(uid === undefined ? [] : [uid])],
  );
}

/** Schedules `task` daily at 2AM server-local time; returns a cancel function. */
export function scheduleDailyAtTwoAm(task: () => Promise<void>): () => void {
  let timer: NodeJS.Timeout;

  const schedule = (): void => {
    const next = new Date();
    next.setHours(2, 0, 0, 0);
    if (next.getTime() <= Date.now()) {
      next.setDate(next.getDate() + 1);
    }

    timer = setTimeout(() => {
      task()
        .catch((error: unknown) => {
          console.error(error instanceof Error ? error.message : error);
        })
        .finally(schedule);
    }, next.getTime() - Date.now());
    timer.unref();
  };

  schedule();

  return () => clearTimeout(timer);
}
