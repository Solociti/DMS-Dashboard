export function redirectToLogin(): void {
  const returnTo = `${window.location.pathname}${window.location.search}`;

  window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}
