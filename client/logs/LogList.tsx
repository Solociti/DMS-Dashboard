import type { LogFileInfo } from "../../common/types";
import { formatDate } from "../shared/formatDate";

interface LogListProps {
  /**
   * Configured logs, or null while loading.
   */
  logs: LogFileInfo[] | null;

  /**
   * Name of the selected log.
   */
  selected: string | null;

  /**
   * Called when a log is chosen.
   */
  onSelect: (name: string) => void;

  /**
   * Called when the refresh button is pressed.
   */
  onRefresh: () => void;
}

/**
 * List of mounted log files.
 *
 * @param {LogListProps} arg0 [!important, selection is controlled by the parent]
 */
export default function LogList({
  logs,
  selected,
  onSelect,
  onRefresh,
}: LogListProps) {
  return (
    <section className="panel inset">
      <div className="panel-heading">
        <h2>Mounted logs</h2>
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <ul className="log-list">
        {logs === null ? <li>Loading…</li> : null}
        {logs?.length === 0 ? <li>No configured log files were found.</li> : null}
        {logs?.map((log) => (
          <li key={log.name}>
            <button
              type="button"
              className={log.name === selected ? "active" : undefined}
              onClick={() => onSelect(log.name)}
            >
              <strong>{log.name}</strong>
              <br />
              <span>
                {log.exists
                  ? `${log.sizeBytes ?? 0} bytes${log.updatedAt ? ` • Updated ${formatDate(log.updatedAt)}` : ""}`
                  : "Missing log file"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
