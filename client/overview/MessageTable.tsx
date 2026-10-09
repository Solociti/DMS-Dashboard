import type { OpenSummary } from "../../common/types";
import { formatDate } from "../shared/formatDate";
import { MessageFilterValues } from "./MessageFilters";
import RefreshIntervalSelect from "./RefreshIntervalSelect";

const upArrow = "↑";
const downArrow = "↓";
const defaultTextLength = 50;

/**
 * Truncates a string to the specified length, adding an ellipsis if necessary.
 *
 * @param text
 * @param length
 * @returns
 */
function truncate(text: string, length?: number): string {
  const len = typeof length === "number" && length ? length : defaultTextLength;

  return text.length > len ? `${text.slice(0, len)}…` : text;
}

interface MessageTableProps {
  /**
   * Loaded rows, or null while the first request is pending.
   */
  rows: OpenSummary[] | null;

  /**
   * Load error shown in place of the rows.
   */
  error: string | null;

  /**
   * Currently selected message id.
   */
  selectedId: string | null;

  /**
   * Called when a row is clicked.
   */
  onSelect: (msgId: string) => void;

  /**
   * Called when the refresh button is pressed.
   */
  onRefresh: () => void;

  /**
   * Current auto refresh interval in milliseconds.
   */
  refreshMs: number;

  /**
   * Called with the newly chosen auto refresh interval.
   */
  onRefreshMsChange: (ms: number) => void;

  /**
   * Current filter values.
   */
  filters: MessageFilterValues;

  /**
   * Called with the full updated filter values on any change.
   */
  onFiltersChange: (filters: MessageFilterValues) => void;

  /**
   * Current 1-based page.
   */
  page: number;

  /**
   * Rows per page.
   */
  pageSize: number;

  /**
   * Matching messages across all pages.
   */
  total: number;

  /**
   * Called with the new page number.
   */
  onPageChange: (page: number) => void;
}

/**
 * Table of tracked messages with row selection.
 *
 * @param {MessageTableProps} arg0 [!important, selection is controlled by the parent]
 */
export default function MessageTable({
  error,
  filters,
  rows,
  selectedId,
  onFiltersChange,
  onPageChange,
  onRefresh,
  onRefreshMsChange,
  onSelect,
  page,
  pageSize,
  refreshMs,
  total,
}: MessageTableProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const MessageRow = ({ row }: { row: OpenSummary }) => {
    const title =
      !row.subject && !row.sender && row.recipients.length === 0 && !row.sentAt
        ? row.msgId
        : (row.subject ?? "(no subject)");
    const recipients = row.recipients.join(", ");

    return (
      <tr
        className={row.msgId === selectedId ? "active" : undefined}
        onClick={() => onSelect(row.msgId)}
      >
        <td title={title}>
          <strong>{truncate(title)}</strong>
        </td>
        <td>
          <small>From: {row.sender ? truncate(row.sender, 25) : "-"}</small>
          <br />
          <small>To: {recipients ? truncate(recipients, 25) : "-"}</small>
        </td>
        <td>{row.sentAt ? formatDate(row.sentAt) : "-"}</td>
        <td>{row.totalOpens}</td>
        <td>{formatDate(row.lastOpened)}</td>
      </tr>
    );
  };

  const Message = ({ text }: { text: string }) => (
    <tr>
      <td colSpan={6}>{text}</td>
    </tr>
  );

  return (
    <section className="panel inset">
      <div className="panel-heading">
        <h2>Messages</h2>
        <div className="filter-row">
          <RefreshIntervalSelect
            value={refreshMs}
            onChange={onRefreshMsChange}
          />
          <button type="button" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="text-nowrap">Message</th>
              <th className="text-nowrap"></th>
              <th
                className="text-nowrap cursor-pointer"
                onClick={() => {
                  onFiltersChange({
                    ...filters,
                    sort: "sent",
                    direction:
                      filters.sort === "sent" && filters.direction === "desc"
                        ? "asc"
                        : "desc",
                  });
                }}
              >
                Sent{" "}
                {filters.sort === "sent"
                  ? filters.direction === "asc"
                    ? upArrow
                    : downArrow
                  : null}
              </th>
              <th className="text-nowrap">Opens</th>
              <th
                className="text-nowrap cursor-pointer"
                onClick={() => {
                  onFiltersChange({
                    ...filters,
                    sort: "opened",
                    direction:
                      filters.sort === "opened" && filters.direction === "desc"
                        ? "asc"
                        : "desc",
                  });
                }}
              >
                Last Opened{" "}
                {filters.sort === "opened"
                  ? filters.direction === "asc"
                    ? upArrow
                    : downArrow
                  : null}
              </th>
            </tr>
          </thead>

          <tbody>
            {error ? <Message text={error} /> : null}
            {!error && rows === null ? <Message text="Loading…" /> : null}
            {!error && rows?.length === 0 ? (
              <Message text="No tracking data yet." />
            ) : null}
            {!error &&
              rows?.map((row) => <MessageRow key={row.msgId} row={row} />)}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>

        <span className="muted">
          Page {page} of {lastPage}
        </span>

        <button
          type="button"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
