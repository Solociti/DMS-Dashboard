import type { OpenSummary } from "../../common/types";
import { formatDate } from "../shared/formatDate";
import { MessageFilterValues } from "./MessageFilters";

const upArrow = "↑";
const downArrow = "↓";

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
  onSelect,
  page,
  pageSize,
  total,
}: MessageTableProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const MessageRow = ({ row }: { row: OpenSummary }) => (
    <tr
      className={row.msgId === selectedId ? "active" : undefined}
      onClick={() => onSelect(row.msgId)}
    >
      <td>
        <strong>
          {!row.subject &&
          !row.sender &&
          row.recipients.length === 0 &&
          !row.sentAt
            ? row.msgId
            : (row.subject ?? "(no subject)")}
        </strong>
      </td>
      <td>{row.sender ?? "-"}</td>
      <td>{row.recipients.join(", ") || "-"}</td>
      <td>{row.sentAt ? formatDate(row.sentAt) : "-"}</td>
      <td>{row.totalOpens}</td>
      <td>{formatDate(row.lastOpened)}</td>
    </tr>
  );

  const Message = ({ text }: { text: string }) => (
    <tr>
      <td colSpan={6}>{text}</td>
    </tr>
  );

  return (
    <section className="panel inset">
      <div className="panel-heading">
        <h2>Messages</h2>
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="text-nowrap">Message</th>
              <th className="text-nowrap">From</th>
              <th className="text-nowrap">To</th>
              <th
                className="text-nowrap cursor-pointer"
                onClick={() => {
                  onFiltersChange({
                    ...filters,
                    sort: "sent",
                    direction:
                      filters.sort === "sent" && filters.direction === "asc"
                        ? "desc"
                        : "asc",
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
                      filters.sort === "opened" && filters.direction === "asc"
                        ? "desc"
                        : "asc",
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
