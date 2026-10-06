import { useEffect, useRef } from "react";

export function useInterval(callback: () => void, delayMs: number): void {
  const latest = useRef(callback);

  latest.current = callback;

  useEffect(() => {
    const id = window.setInterval(() => latest.current(), delayMs);

    return () => window.clearInterval(id);
  }, [delayMs]);
}
