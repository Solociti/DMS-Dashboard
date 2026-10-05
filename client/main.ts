import type {
  DashboardWarning,
  LogFileInfo,
  LogFileResponse,
  OpenLogEntry,
  OpenSummary,
  TrackingBlacklistResponse,
  WarningState,
} from "../common/types";

const trackedCount =
  document.querySelector<HTMLParagraphElement>("#tracked-count");
const totalOpens = document.querySelector<HTMLParagraphElement>("#total-opens");
const lastOpened = document.querySelector<HTMLParagraphElement>("#last-opened");
const messageTableBody = document.querySelector<HTMLTableSectionElement>(
  "#message-table-body",
);
const detailsTitle =
  document.querySelector<HTMLParagraphElement>("#details-title");
const detailsList = document.querySelector<HTMLUListElement>("#details-list");
const logList = document.querySelector<HTMLUListElement>("#log-list");
const logTitle = document.querySelector<HTMLElement>("#log-title");
const logContent = document.querySelector<HTMLElement>("#log-content");
const warningPanel = document.querySelector<HTMLElement>("#warning-panel");
const warningList = document.querySelector<HTMLUListElement>("#warning-list");
const warningStatus =
  document.querySelector<HTMLParagraphElement>("#warning-status");
const refreshMetricsButton =
  document.querySelector<HTMLButtonElement>("#refresh-metrics");
const refreshLogsButton =
  document.querySelector<HTMLButtonElement>("#refresh-logs");
const tailLogButton = document.querySelector<HTMLButtonElement>("#tail-log");
const refreshWarningsButton =
  document.querySelector<HTMLButtonElement>("#refresh-warnings");
const overviewView = document.querySelector<HTMLElement>("#overview-view");
const logsView = document.querySelector<HTMLElement>("#logs-view");
const blacklistView = document.querySelector<HTMLElement>("#blacklist-view");
const usersView = document.querySelector<HTMLElement>("#users-view");
const blacklistForm =
  document.querySelector<HTMLFormElement>("#blacklist-form");
const blacklistInput =
  document.querySelector<HTMLInputElement>("#blacklist-address");
const blacklistCount =
  document.querySelector<HTMLParagraphElement>("#blacklist-count");
const blacklistStatus =
  document.querySelector<HTMLParagraphElement>("#blacklist-status");
const blacklistList =
  document.querySelector<HTMLUListElement>("#blacklist-list");
const usersTableBody =
  document.querySelector<HTMLTableSectionElement>("#users-table-body");
const usersStatus = document.querySelector<HTMLParagraphElement>("#users-status");
const addBlacklistAddressButton = document.querySelector<HTMLButtonElement>(
  "#add-blacklist-address",
);
const tabs = Array.from(
  document.querySelectorAll<HTMLAnchorElement>(".tabs a"),
);
const authGate = document.querySelector<HTMLElement>("#auth-gate");
const dashboardContent = document.querySelector<HTMLElement>("#dashboard-content");
const loginForm = document.querySelector<HTMLFormElement>("#login-form");
const passwordForm = document.querySelector<HTMLFormElement>("#password-form");
const authStatus = document.querySelector<HTMLParagraphElement>("#auth-status");
const logoutButton = document.querySelector<HTMLButtonElement>("#logout-button");

interface AuthSession {
  authenticated: boolean;
  email?: string;
  mustChangePassword?: boolean;
}

interface ManagedUser {
  id: number;
  email: string;
  createdAt: string;
}

let selectedMessageId: string | null = null;
let selectedLogName: string | null = null;
let logPoller: number | undefined;

function isLogsRoute(): boolean {
  return window.location.pathname.startsWith("/dashboard/logs");
}

function isBlacklistRoute(): boolean {
  return window.location.pathname.startsWith("/dashboard/blacklist");
}

function isUsersRoute(): boolean {
  return window.location.pathname.startsWith("/dashboard/users");
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Invalid date";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const partValue = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${partValue("month")} ${partValue("day")} ${partValue("year")} ${partValue("hour")}:${partValue("minute")} ${partValue("dayPeriod")}`;
}

function replaceChildren(element: Element, ...children: Node[]): void {
  element.replaceChildren(...children);
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function renderWarnings(state: WarningState): void {
  if (!warningPanel || !warningList || !warningStatus) {
    return;
  }

  warningStatus.textContent = state.checkedAt
    ? `Last checked ${formatDate(state.checkedAt)}.`
    : "Warnings have not been checked yet.";

  if (state.warnings.length === 0) {
    warningPanel.classList.add("hidden");
    replaceChildren(warningList, createElement("li", "No warnings."));
    return;
  }

  warningPanel.classList.remove("hidden");
  replaceChildren(
    warningList,
    ...state.warnings.map((warning: DashboardWarning) => {
      const item = createElement("li");
      item.append(
        createElement("strong", warning.title),
        createElement("span", warning.message),
      );
      return item;
    }),
  );
}

function runOverviewTask(task: () => Promise<void>): void {
  task().catch((error) => {
    if (messageTableBody) {
      const row = createElement("tr");
      const cell = createElement("td", getErrorMessage(error));
      cell.colSpan = 6;
      row.append(cell);
      replaceChildren(messageTableBody, row);
    }

    if (detailsTitle) {
      detailsTitle.textContent = "Overview failed to load";
    }

    if (detailsList) {
      replaceChildren(detailsList, createElement("li", getErrorMessage(error)));
    }
  });
}

function runLogTask(task: () => Promise<void>): void {
  task().catch((error) => {
    if (logTitle) {
      logTitle.textContent = "Log output";
    }

    if (logContent) {
      logContent.textContent = getErrorMessage(error);
    }
  });
}

function runWarningTask(task: () => Promise<void>): void {
  task().catch((error) => {
    if (!warningPanel || !warningList || !warningStatus) {
      return;
    }

    warningPanel.classList.remove("hidden");
    warningStatus.textContent = "Warning refresh failed.";
    replaceChildren(warningList, createElement("li", getErrorMessage(error)));
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `Request failed (${response.status}) for ${url}`;
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error || message;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function updateTabs(): void {
  const logsRoute = isLogsRoute();
  const blacklistRoute = isBlacklistRoute();
  const usersRoute = isUsersRoute();
  overviewView?.classList.toggle(
    "hidden",
    logsRoute || blacklistRoute || usersRoute,
  );
  logsView?.classList.toggle("hidden", !logsRoute);
  blacklistView?.classList.toggle("hidden", !blacklistRoute);
  usersView?.classList.toggle("hidden", !usersRoute);
  tabs.forEach((tab) => {
    const active = usersRoute
      ? tab.dataset.tab === "users"
      : blacklistRoute
        ? tab.dataset.tab === "blacklist"
        : logsRoute
          ? tab.dataset.tab === "logs"
          : tab.dataset.tab === "overview";
    tab.classList.toggle("active", active);
  });

  if (logsRoute) {
    startLogPolling();
  } else {
    stopLogPolling();
  }
}

async function loadWarnings(recheck = false): Promise<void> {
  const state = await fetchJson<WarningState>(
    recheck ? "/api/warnings/recheck" : "/api/warnings",
    {
      method: recheck ? "POST" : "GET",
    },
  );
  renderWarnings(state);
}

function createMessageCell(row: OpenSummary): HTMLTableCellElement {
  const cell = createElement("td");
  if (
    !row.subject &&
    !row.sender &&
    row.recipients.length === 0 &&
    !row.sentAt
  ) {
    cell.textContent = row.msgId;
    return cell;
  }

  cell.append(createElement("strong", row.subject ?? "(no subject)"));
  return cell;
}

async function loadMetrics(): Promise<void> {
  if (!trackedCount || !totalOpens || !lastOpened || !messageTableBody) {
    return;
  }

  const rows = await fetchJson<OpenSummary[]>("/api/opens");
  trackedCount.textContent = String(rows.length);
  totalOpens.textContent = String(
    rows.reduce((sum, row) => sum + row.totalOpens, 0),
  );
  lastOpened.textContent = formatDate(rows[0]?.lastOpened ?? null);

  if (rows.length === 0) {
    const emptyRow = createElement("tr");
    const emptyCell = createElement("td", "No tracking data yet.");
    emptyCell.colSpan = 6;
    emptyRow.append(emptyCell);
    replaceChildren(messageTableBody, emptyRow);
    detailsTitle &&
      (detailsTitle.textContent = "Select a message to inspect open events.");
    detailsList &&
      replaceChildren(detailsList, createElement("li", "No message selected."));
    return;
  }

  if (
    !selectedMessageId ||
    !rows.some((row) => row.msgId === selectedMessageId)
  ) {
    selectedMessageId = rows[0].msgId;
  }

  replaceChildren(
    messageTableBody,
    ...rows.map((row) => {
      const tableRow = createElement("tr");
      tableRow.dataset.msgId = row.msgId;
      tableRow.append(
        createMessageCell(row),
        createElement("td", row.sender ?? "-"),
        createElement("td", row.recipients.join(", ") || "-"),
        createElement("td", row.sentAt ? formatDate(row.sentAt) : "-"),
        createElement("td", String(row.totalOpens)),
        createElement("td", formatDate(row.lastOpened)),
      );
      tableRow.addEventListener("click", () => {
        selectedMessageId = row.msgId;
        void loadMessageDetails();
      });
      return tableRow;
    }),
  );

  await loadMessageDetails();
}

async function loadMessageDetails(): Promise<void> {
  if (!selectedMessageId || !detailsList || !detailsTitle) {
    return;
  }

  const entries = await fetchJson<OpenLogEntry[]>(
    `/api/opens/${encodeURIComponent(selectedMessageId)}`,
  );
  detailsTitle.textContent = `${selectedMessageId} • ${entries.length} open${entries.length === 1 ? "" : "s"}`;

  if (entries.length === 0) {
    replaceChildren(
      detailsList,
      createElement("li", "No open events recorded for this message."),
    );
    return;
  }

  replaceChildren(
    detailsList,
    ...entries.map((entry) => {
      const item = createElement("li");
      const timestamp = createElement("strong", formatDate(entry.createdAt));
      const ip = createElement("span", `IP: ${entry.ipAddress ?? "Unknown"}`);
      const agent = createElement(
        "span",
        `User-Agent: ${entry.userAgent ?? "Unknown"}`,
      );
      item.append(
        timestamp,
        document.createElement("br"),
        ip,
        document.createElement("br"),
        agent,
      );
      return item;
    }),
  );
}

async function loadLogs(): Promise<void> {
  if (!logList) {
    return;
  }

  const logs = await fetchJson<LogFileInfo[]>("/api/logs");
  if (logs.length === 0) {
    replaceChildren(
      logList,
      createElement("li", "No configured log files were found."),
    );
    selectedLogName = null;
    if (logTitle) {
      logTitle.textContent = "Log output";
    }
    if (logContent) {
      logContent.textContent =
        "Configure LOG_FILES or mount DMS logs to inspect them here.";
    }
    return;
  }

  if (!selectedLogName || !logs.some((log) => log.name === selectedLogName)) {
    selectedLogName = logs[0].name;
  }

  replaceChildren(
    logList,
    ...logs.map((log) => {
      const item = createElement("li");
      const button = createElement("button");
      button.type = "button";
      button.dataset.logName = log.name;
      button.classList.toggle("active", log.name === selectedLogName);

      const title = createElement("strong", log.name);
      const details = createElement(
        "span",
        log.exists
          ? `${log.sizeBytes ?? 0} bytes${log.updatedAt ? ` • Updated ${formatDate(log.updatedAt)}` : ""}`
          : "Missing log file",
      );

      button.append(title, document.createElement("br"), details);
      button.addEventListener("click", () => {
        selectedLogName = log.name;
        void loadLogContent();
        void loadLogs();
      });

      item.append(button);
      return item;
    }),
  );

  await loadLogContent();
}

async function loadLogContent(): Promise<void> {
  if (!selectedLogName || !logTitle || !logContent) {
    return;
  }

  const response = await fetchJson<LogFileResponse>(
    `/api/logs/${encodeURIComponent(selectedLogName)}?lines=200`,
  );
  logTitle.textContent = `${response.log.name} (${response.log.exists ? "mounted" : "missing"})`;
  logContent.textContent = response.content || "No log content available.";
}

function renderBlacklist(addresses: string[]): void {
  if (!blacklistCount || !blacklistList) {
    return;
  }

  blacklistCount.textContent = `${addresses.length} sender${addresses.length === 1 ? "" : "s"} excluded`;
  if (addresses.length === 0) {
    replaceChildren(
      blacklistList,
      createElement("li", "No senders are excluded."),
    );
    return;
  }

  replaceChildren(
    blacklistList,
    ...addresses.map((address) => {
      const item = createElement("li");
      const value = createElement("code", address);
      const removeButton = createElement("button", "Remove");
      removeButton.type = "button";
      removeButton.setAttribute(
        "aria-label",
        `Remove ${address} from the exclusion list`,
      );
      removeButton.addEventListener("click", async () => {
        removeButton.disabled = true;
        if (blacklistStatus) {
          blacklistStatus.textContent = `Removing ${address}…`;
        }

        try {
          const response = await fetchJson<TrackingBlacklistResponse>(
            `/api/tracking-blacklist/${encodeURIComponent(address)}`,
            { method: "DELETE" },
          );
          renderBlacklist(response.addresses);
          if (blacklistStatus) {
            blacklistStatus.textContent = `${address} removed.`;
          }
        } catch (error) {
          removeButton.disabled = false;
          if (blacklistStatus) {
            blacklistStatus.textContent = getErrorMessage(error);
          }
        }
      });
      item.append(value, removeButton);
      return item;
    }),
  );
}

async function loadBlacklist(): Promise<void> {
  const response = await fetchJson<TrackingBlacklistResponse>(
    "/api/tracking-blacklist",
  );
  renderBlacklist(response.addresses);
}

function renderUsers(users: ManagedUser[]): void {
  if (!usersTableBody) {
    return;
  }

  if (usersStatus) {
    usersStatus.textContent = `${users.length} user${users.length === 1 ? "" : "s"}`;
  }

  replaceChildren(
    usersTableBody,
    ...users.map((user) => {
      const row = createElement("tr");
      const idCell = createElement("td", String(user.id));
      idCell.classList.add("user-id");
      const emailCell = createElement("td");
      const emailInput = createElement("input");
      emailInput.type = "email";
      emailInput.required = true;
      emailInput.value = user.email;
      emailInput.setAttribute("aria-label", `Email for user ${user.id}`);
      emailCell.append(emailInput);

      const passwordCell = createElement("td");
      const passwordInput = createElement("input");
      passwordInput.type = "password";
      passwordInput.minLength = 12;
      passwordInput.maxLength = 128;
      passwordInput.autocomplete = "new-password";
      passwordInput.placeholder = "Leave blank to keep current";
      passwordInput.setAttribute("aria-label", `New password for ${user.email}`);
      passwordCell.append(passwordInput);

      const actionCell = createElement("td");
      const saveButton = createElement("button", "Save changes");
      saveButton.type = "button";
      const rowStatus = createElement("span");
      rowStatus.setAttribute("role", "status");
      saveButton.addEventListener("click", async () => {
        if (!emailInput.validity.valid) {
          emailInput.reportValidity();
          return;
        }

        saveButton.disabled = true;
        rowStatus.textContent = "Saving…";
        try {
          const updated = await fetchJson<Pick<ManagedUser, "id" | "email">>(
            `/api/users/${user.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: emailInput.value,
                password: passwordInput.value,
              }),
            },
          );
          emailInput.value = updated.email;
          passwordInput.value = "";
          rowStatus.textContent = "Saved";
        } catch (error) {
          rowStatus.textContent = getErrorMessage(error);
        } finally {
          saveButton.disabled = false;
        }
      });
      actionCell.append(saveButton, rowStatus);
      row.append(idCell, emailCell, passwordCell, actionCell);
      return row;
    }),
  );
}

async function loadUsers(): Promise<void> {
  const users = await fetchJson<ManagedUser[]>("/api/users");
  renderUsers(users);
}

function runBlacklistTask(task: () => Promise<void>): void {
  task().catch((error) => {
    if (blacklistStatus) {
      blacklistStatus.textContent = getErrorMessage(error);
    }
    if (blacklistList) {
      replaceChildren(
        blacklistList,
        createElement("li", "Could not load excluded senders."),
      );
    }
  });
}

function runUsersTask(task: () => Promise<void>): void {
  task().catch((error) => {
    if (usersStatus) {
      usersStatus.textContent = getErrorMessage(error);
    }
  });
}

function startLogPolling(): void {
  if (logPoller) {
    return;
  }

  logPoller = window.setInterval(() => {
    runLogTask(loadLogs);
  }, 10000);
}

function stopLogPolling(): void {
  if (logPoller) {
    window.clearInterval(logPoller);
    logPoller = undefined;
  }
}


function renderAuthState(session: AuthSession): void {
  const mustChangePassword = Boolean(
    session.authenticated && session.mustChangePassword,
  );
  const showDashboard = session.authenticated && !mustChangePassword;
  authGate?.classList.toggle("hidden", showDashboard);
  dashboardContent?.classList.toggle("hidden", !showDashboard);
  if (loginForm) {
    loginForm.classList.toggle("hidden", session.authenticated);
  }
  if (passwordForm) {
    passwordForm.classList.toggle("hidden", !mustChangePassword);
  }
  if (authStatus) {
    authStatus.textContent = mustChangePassword
      ? `Update the password for ${session.email ?? "your account"} to continue.`
      : "";
  }
}

function startDashboard(): void {
  updateTabs();
  initializeView();
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  if (authStatus) {
    authStatus.textContent = "Signing in…";
  }

  try {
    const session = await fetchJson<AuthSession>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    renderAuthState(session);
    if (!session.mustChangePassword) {
      startDashboard();
    }
  } catch (error) {
    if (authStatus) {
      authStatus.textContent = getErrorMessage(error);
    }
  }
});

passwordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(passwordForm);
  if (authStatus) {
    authStatus.textContent = "Updating password…";
  }

  try {
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: formData.get("password") }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? `Request failed (${response.status})`);
    }

    passwordForm.reset();
    renderAuthState({ authenticated: true });
    startDashboard();
  } catch (error) {
    if (authStatus) {
      authStatus.textContent = getErrorMessage(error);
    }
  }
});

logoutButton?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  stopLogPolling();
  renderAuthState({ authenticated: false });
});

fetchJson<AuthSession>("/api/auth/session")
  .then((session) => {
    renderAuthState(session);
    if (session.authenticated && !session.mustChangePassword) {
      startDashboard();
    }
  })
  .catch((error: unknown) => {
    renderAuthState({ authenticated: false });
    if (authStatus) {
      authStatus.textContent = getErrorMessage(error);
    }
  });
window.addEventListener("popstate", () => {
  if (dashboardContent?.classList.contains("hidden")) {
    return;
  }

  updateTabs();
  initializeView();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLAnchorElement) || !target.closest(".tabs")) {
    return;
  }

  if (target.origin !== window.location.origin) {
    return;
  }

  event.preventDefault();
  window.history.pushState({}, "", target.href);
  updateTabs();
  initializeView();
});

refreshMetricsButton?.addEventListener("click", () =>
  runOverviewTask(loadMetrics),
);
refreshLogsButton?.addEventListener("click", () => runLogTask(loadLogs));
tailLogButton?.addEventListener("click", () => runLogTask(loadLogContent));
refreshWarningsButton?.addEventListener("click", () =>
  runWarningTask(() => loadWarnings(true)),
);

blacklistForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = blacklistInput?.value.trim();
  if (!address || !blacklistInput?.validity.valid) {
    blacklistInput?.reportValidity();
    return;
  }

  if (addBlacklistAddressButton) {
    addBlacklistAddressButton.disabled = true;
  }
  if (blacklistStatus) {
    blacklistStatus.textContent = `Adding ${address}…`;
  }

  try {
    const response = await fetchJson<TrackingBlacklistResponse>(
      "/api/tracking-blacklist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      },
    );
    renderBlacklist(response.addresses);
    if (blacklistInput) {
      blacklistInput.value = "";
      blacklistInput.focus();
    }
    if (blacklistStatus) {
      blacklistStatus.textContent = `${address} added to the exclusion list.`;
    }
  } catch (error) {
    if (blacklistStatus) {
      blacklistStatus.textContent = getErrorMessage(error);
    }
  } finally {
    if (addBlacklistAddressButton) {
      addBlacklistAddressButton.disabled = false;
    }
  }
});

function initializeView(): void {
  if (isUsersRoute()) {
    runUsersTask(loadUsers);
    return;
  }

  runWarningTask(() => loadWarnings(false));

  if (isLogsRoute()) {
    runLogTask(loadLogs);
    return;
  }

  if (isBlacklistRoute()) {
    runBlacklistTask(loadBlacklist);
    return;
  }

  runOverviewTask(loadMetrics);
}
