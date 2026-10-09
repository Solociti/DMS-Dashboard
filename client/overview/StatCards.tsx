import type { DailyStat } from "../../common/types";
import { formatDate } from "../shared/formatDate";
import LineChart from "./LineChart";

interface StatCardsProps {
  /**
   * Per-day counts for the last 90 days, oldest first.
   */
  daily: DailyStat[];

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
  daily,
  totalMessages,
  totalOpens,
  lastActivity,
}: StatCardsProps) {
  return (
    <div className="stats-grid">
      <article className="stat-card">
        <div className="line-chart-container line-chart-messages">
          <LineChart
            values={daily.map((day) => day.messages)}
            label="Tracked messages per day, last 90 days"
          />
        </div>

        <div className="stat-card-text">
          <h2>Tracked messages</h2>
          <p>{totalMessages}</p>
        </div>
      </article>

      <article className="stat-card stat-card-opens">
        <div className="line-chart-container line-chart-opens">
          <LineChart
            values={daily.map((day) => day.opens)}
            label="Opens per day, last 90 days"
          />
        </div>

        <div className="stat-card-text">
          <h2>Total opens</h2>
          <p>{totalOpens}</p>
        </div>
      </article>

      <article className="stat-card">
        <h2>Last activity</h2>
        <p>{lastActivity ? formatDate(lastActivity) : "No opens yet"}</p>
      </article>
    </div>
  );
}
