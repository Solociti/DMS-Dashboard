import { useEffect, useState } from "react";

import type { TrackingBlacklistResponse } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";
import { getErrorMessage } from "../shared/getErrorMessage";
import BlacklistForm from "./BlacklistForm";
import BlacklistList from "./BlacklistList";

/**
 * Excluded senders page: add and remove addresses from the tracking blacklist.
 */
export default function BlacklistPage() {
  const [addresses, setAddresses] = useState<string[] | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchJson<TrackingBlacklistResponse>("/api/tracking-blacklist")
      .then((response) => setAddresses(response.addresses))
      .catch((error: unknown) => {
        setStatus(getErrorMessage(error));
        setAddresses([]);
      });
  }, []);

  const handleAdd = async (address: string): Promise<boolean> => {
    setStatus(`Adding ${address}…`);

    try {
      const response = await fetchJson<TrackingBlacklistResponse>(
        "/api/tracking-blacklist",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        },
      );

      setAddresses(response.addresses);
      setStatus(`${address} added to the exclusion list.`);

      return true;
    } catch (error) {
      setStatus(getErrorMessage(error));

      return false;
    }
  };

  const handleRemove = async (address: string) => {
    setStatus(`Removing ${address}…`);

    try {
      const response = await fetchJson<TrackingBlacklistResponse>(
        `/api/tracking-blacklist/${encodeURIComponent(address)}`,
        { method: "DELETE" },
      );

      setAddresses(response.addresses);
      setStatus(`${address} removed.`);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  };

  return (
    <section className="stack">
      <div className="panel-heading">
        <div>
          <h2>Excluded senders</h2>
          <p className="muted">
            {addresses === null
              ? "Loading addresses…"
              : `${addresses.length} sender${addresses.length === 1 ? "" : "s"} excluded`}
          </p>
        </div>
      </div>

      <BlacklistForm onAdd={handleAdd} />

      <p className="muted" role="status" aria-live="polite">
        {status}
      </p>

      <BlacklistList addresses={addresses} onRemove={handleRemove} />
    </section>
  );
}
