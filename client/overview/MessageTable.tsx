import type { OpenSummary } from "../../common/types";
import { formatDate } from "../shared/formatDate";

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
}

/**
 * Table of tracked messages with row selection.
 *
 * @param {MessageTableProps} arg0 [!important, selection is controlled by the parent]
 */
export default function MessageTable({
  rows,
  error,
  selectedId,
  onSelect,
  onRefresh,
}: MessageTableProps) {
  const MessageRow = ({ row }: { row: OpenSummary }) => (
    <tr
      className={row.msgId === selectedId ? "active" : undefined}
      onClick={() => onSelect(row.msgId)}
    >
      <td>
        <strong>
          {!row.subject && !row.sender && row.recipients.length === 0 && !row.sentAt
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
              <th>Message</th>
              <th>From</th>
              <th>To</th>
              <th>Sent</th>
              <th>Opens</th>
              <th>Last Opened</th>
            </tr>
          </thead>

          <tbody>
            {error ? <Message text={error} /> : null}
            {!error && rows === null ? <Message text="Loading…" /> : null}
            {!error && rows?.length === 0 ? (
              <Message text="No tracking data yet." />
            ) : null}
            {!error && rows?.map((row) => <MessageRow key={row.msgId} row={row} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
