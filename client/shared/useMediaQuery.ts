import { useEffect, useState } from "react";

/**
 * Tracks whether a CSS media query currently matches.
 *
 * @param query Media query string, e.g. "(max-width: 960px)".
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);

    onChange();
    list.addEventListener("change", onChange);

    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
