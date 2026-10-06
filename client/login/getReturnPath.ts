// Only same-site dashboard paths are accepted to prevent open redirects.
export function getReturnPath(): string {
  const requested = new URLSearchParams(window.location.search).get("returnTo");

  return requested === "/dashboard" || requested?.startsWith("/dashboard/")
    ? requested
    : "/dashboard";
}
