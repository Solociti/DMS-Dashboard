import type { OpenSummary } from "../../common/types";
import { formatDate } from "../shared/formatDate";

interface StatCardsProps {
  /**
   * Tracked message summaries used to compute the totals.
   */
  rows: OpenSummary[];
}

/**
 * Summary cards for tracked messages, total opens and last activity.
 *
 * @param {StatCardsProps} arg0 [!important, rows are expected newest-opened first]
 */
export default function StatCards({ rows }: StatCardsProps) {
  const totalOpens = rows.reduce((sum, row) => sum + row.totalOpens, 0);

  return (
    <div className="stats-grid">
      <article className="stat-card">
        <h2>Tracked messages</h2>
        <p>{rows.length}</p>
      </article>

      <article className="stat-card">
        <h2>Total opens</h2>
        <p>{totalOpens}</p>
      </article>

      <article className="stat-card">
        <h2>Last activity</h2>
        <p>{rows.length > 0 ? formatDate(rows[0].lastOpened) : "No opens yet"}</p>
      </article>
    </div>
  );
}
