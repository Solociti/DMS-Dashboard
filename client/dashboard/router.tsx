import { lazy } from "react";
import { createBrowserRouter } from "react-router";

import DashboardLayout from "../layout/DashboardLayout";
import RequireSession from "../session/RequireSession";

const OverviewPage = lazy(() => import("../overview/OverviewPage"));
const LogsPage = lazy(() => import("../logs/LogsPage"));
const SettingsPage = lazy(() => import("../settings/SettingsPage"));
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
          { path: "settings", element: <SettingsPage /> },
          { path: "users", element: <UsersPage /> },
        ],
      },
    ],
  },
]);
