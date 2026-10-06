import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { redirectToLogin } from "../shared/redirectToLogin";
import WarningsPanel from "../warnings/WarningsPanel";

/**
 * Dashboard shell with the header, tab navigation, warnings and the lazy-loaded page outlet.
 */
export default function DashboardLayout() {
  const { pathname } = useLocation();
  const isUsersRoute = pathname.startsWith("/dashboard/users");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    redirectToLogin();
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <strong className="brand">DMS Dashboard</strong>

        <button
          type="button"
          className="menu-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>

        <nav
          className={menuOpen ? "tabs open" : "tabs"}
          aria-label="Views"
        >
          <NavLink to="/dashboard" end>
            Overview
          </NavLink>
          <NavLink to="/dashboard/logs">Logs</NavLink>
          <NavLink to="/dashboard/blacklist">Excluded senders</NavLink>
          <NavLink to="/dashboard/users">Users</NavLink>
          <button type="button" className="signout" onClick={handleLogout}>
            Sign out
          </button>
        </nav>
      </header>

      <div className="content">
      {isUsersRoute ? null : <WarningsPanel key={pathname} />}

      <main className="layout">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
      </div>
    </div>
  );
}
