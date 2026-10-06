import { formatDate } from "../shared/formatDate";

interface StatCardsProps {
  /**
   * Messages matching the current filters, across all pages.
   */
  totalMessages: number;

  /**
   * Opens across all matching messages.
   */
  totalOpens: number;

  /**
   * Most recent open on the current page, if any.
   */
  lastActivity: string | null;
}

/**
 * Summary cards for tracked messages, total opens and last activity.
 *
 * @param {StatCardsProps} arg0 [!important, totals cover all pages]
 */
export default function StatCards({
  totalMessages,
  totalOpens,
  lastActivity,
}: StatCardsProps) {
  return (
    <div className="stats-grid">
      <article className="stat-card">
        <h2>Tracked messages</h2>
        <p>{totalMessages}</p>
      </article>

      <article className="stat-card">
        <h2>Total opens</h2>
        <p>{totalOpens}</p>
      </article>

      <article className="stat-card">
        <h2>Last activity</h2>
        <p>{lastActivity ? formatDate(lastActivity) : "No opens yet"}</p>
      </article>
    </div>
  );
}
