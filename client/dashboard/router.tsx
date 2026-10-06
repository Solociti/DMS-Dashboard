import { lazy } from "react";
import { createBrowserRouter } from "react-router";

import DashboardLayout from "../layout/DashboardLayout";
import RequireSession from "../session/RequireSession";

const OverviewPage = lazy(() => import("../overview/OverviewPage"));
const LogsPage = lazy(() => import("../logs/LogsPage"));
const BlacklistPage = lazy(() => import("../blacklist/BlacklistPage"));
const UsersPage = lazy(() => import("../users/UsersPage"));

export const router = createBrowserRouter([
  {
    path: "/dashboard",
    element: <RequireSession />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: "logs", element: <LogsPage /> },
          { path: "blacklist", element: <BlacklistPage /> },
          { path: "users", element: <UsersPage /> },
        ],
      },
    ],
  },
]);
