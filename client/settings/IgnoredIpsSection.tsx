import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { IgnoredIpsResponse } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";

/**
 * Ignored IP addresses section: opens from these IPs are hidden from the message list.
 */
export default function IgnoredIpsSection() {
  const [data, setData] = useState<IgnoredIpsResponse | null>(null);
  const [ip, setIp] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchJson<IgnoredIpsResponse>("/api/ignored-ips")
      .then(setData)
      .catch((error: unknown) => setStatus(getErrorMessage(error)));
  }, []);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setData(
        await fetchJson<IgnoredIpsResponse>("/api/ignored-ips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip, note }),
        }),
      );
      setStatus(`${ip.trim()} added.`);
      setIp("");
      setNote("");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  const handleRemove = async (target: string) => {
    try {
      setData(
        await fetchJson<IgnoredIpsResponse>(
          `/api/ignored-ips/${encodeURIComponent(target)}`,
          { method: "DELETE" },
        ),
      );
      setStatus(`${target} removed.`);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  return (
    <section className="stack">
      <div>
        <h3>Ignored IP addresses</h3>
        <p className="muted">
          Opens from these addresses are not counted.
          {data?.currentIp ? ` Your current IP is ${data.currentIp}.` : ""}
        </p>
      </div>

      <form className="blacklist-form" onSubmit={handleAdd}>
        <div className="ip-input-row">
          <input
            aria-label="IP address"
            placeholder="203.0.113.10"
            value={ip}
            onChange={(event) => setIp(event.target.value)}
            required
          />

          <input
            aria-label="Name or note (optional)"
            placeholder="Name or note (optional)"
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          <button type="submit">Ignore IP</button>
        </div>
      </form>

      <p className="muted" role="status" aria-live="polite">
        {status}
      </p>

      <ul className="blacklist-list">
        {data === null ? <li>Loading…</li> : null}
        {data?.ips.length === 0 ? <li>No IP addresses are ignored.</li> : null}
        {data?.ips.map((entry) => (
          <li key={entry.ip}>
            <span>
              <code>{entry.ip}</code>
              {entry.note ? <span className="muted"> {entry.note}</span> : null}
            </span>

            <button
              type="button"
              aria-label={`Stop ignoring ${entry.ip}`}
              onClick={() => handleRemove(entry.ip)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
