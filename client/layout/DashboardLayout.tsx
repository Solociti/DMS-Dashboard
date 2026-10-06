import { Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { redirectToLogin } from "../shared/redirectToLogin";
import WarningsPanel from "../warnings/WarningsPanel";

/**
 * Dashboard shell with the header, tab navigation, warnings and the lazy-loaded page outlet.
 */
export default function DashboardLayout() {
  const { pathname } = useLocation();
  const isUsersRoute = pathname.startsWith("/dashboard/users");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    redirectToLogin();
  };

  return (
    <div className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Email tracking</p>
          <h1>DMS Dashboard</h1>
          <p className="subtitle">
            Track opens, inspect individual events, and view mounted Docker
            Mailserver logs.
          </p>
        </div>

        <button type="button" onClick={handleLogout}>
          Sign out
        </button>
      </header>

      <nav className="tabs" aria-label="Views">
        <NavLink to="/dashboard" end>
          Overview
        </NavLink>
        <NavLink to="/dashboard/logs">Logs</NavLink>
        <NavLink to="/dashboard/blacklist">Excluded senders</NavLink>
        <NavLink to="/dashboard/users">Users</NavLink>
      </nav>

      {isUsersRoute ? null : <WarningsPanel key={pathname} />}

      <main className="layout">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
