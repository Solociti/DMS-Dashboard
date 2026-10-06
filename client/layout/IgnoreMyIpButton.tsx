import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import type { IgnoredIpsResponse } from "../../common/types";
import { fetchJson } from "../shared/fetchJson";

/**
 * Header shortcut that ignores the current IP address when it is not already ignored.
 */
export default function IgnoreMyIpButton() {
  const { pathname } = useLocation();
  const [data, setData] = useState<IgnoredIpsResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchJson<IgnoredIpsResponse>("/api/ignored-ips")
      .then(setData)
      .catch(() => setData(null));
  }, [pathname]);

  if (!data?.currentIp || data.ips.some((entry) => entry.ip === data.currentIp)) {
    return null;
  }

  const handleClick = async () => {
    setBusy(true);

    try {
      setData(
        await fetchJson<IgnoredIpsResponse>("/api/ignored-ips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip: data.currentIp, note: "My IP" }),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="ignore-ip"
      disabled={busy}
      title={`Ignore opens from ${data.currentIp}`}
      onClick={handleClick}
    >
      Ignore my IP
    </button>
  );
}
