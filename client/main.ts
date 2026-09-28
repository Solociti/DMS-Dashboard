import type { LogFileInfo, LogFileResponse, OpenLogEntry, OpenSummary } from '../common/types';

const trackedCount = document.querySelector<HTMLParagraphElement>('#tracked-count');
const totalOpens = document.querySelector<HTMLParagraphElement>('#total-opens');
const lastOpened = document.querySelector<HTMLParagraphElement>('#last-opened');
const messageTableBody = document.querySelector<HTMLTableSectionElement>('#message-table-body');
const detailsTitle = document.querySelector<HTMLParagraphElement>('#details-title');
const detailsList = document.querySelector<HTMLUListElement>('#details-list');
const logList = document.querySelector<HTMLUListElement>('#log-list');
const logTitle = document.querySelector<HTMLElement>('#log-title');
const logContent = document.querySelector<HTMLElement>('#log-content');
const refreshMetricsButton = document.querySelector<HTMLButtonElement>('#refresh-metrics');
const refreshLogsButton = document.querySelector<HTMLButtonElement>('#refresh-logs');
const tailLogButton = document.querySelector<HTMLButtonElement>('#tail-log');
const overviewView = document.querySelector<HTMLElement>('#overview-view');
const logsView = document.querySelector<HTMLElement>('#logs-view');
const tabs = Array.from(document.querySelectorAll<HTMLAnchorElement>('.tabs a'));

let selectedMessageId: string | null = null;
let selectedLogName: string | null = null;
let logPoller: number | undefined;

function isLogsRoute(): boolean {
  return window.location.pathname.startsWith('/dashboard/logs');
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json() as Promise<T>;
}

function updateTabs(): void {
  const logsRoute = isLogsRoute();
  overviewView?.classList.toggle('hidden', logsRoute);
  logsView?.classList.toggle('hidden', !logsRoute);
  tabs.forEach((tab) => {
    const active = logsRoute ? tab.dataset.tab === 'logs' : tab.dataset.tab === 'overview';
    tab.classList.toggle('active', active);
  });

  if (logsRoute) {
    startLogPolling();
  } else {
    stopLogPolling();
  }
}

async function loadMetrics(): Promise<void> {
  if (!trackedCount || !totalOpens || !lastOpened || !messageTableBody) {
    return;
  }

  const rows = await fetchJson<OpenSummary[]>('/api/opens');
  trackedCount.textContent = String(rows.length);
  totalOpens.textContent = String(rows.reduce((sum, row) => sum + row.totalOpens, 0));
  lastOpened.textContent = formatDate(rows[0]?.lastOpened ?? null);

  if (rows.length === 0) {
    messageTableBody.innerHTML = '<tr><td colspan="3">No tracking data yet.</td></tr>';
    detailsTitle && (detailsTitle.textContent = 'Select a message to inspect open events.');
    detailsList && (detailsList.innerHTML = '<li>No message selected.</li>');
    return;
  }

  if (!selectedMessageId) {
    selectedMessageId = rows[0].msgId;
  }

  messageTableBody.innerHTML = rows
    .map(
      (row) => `
        <tr data-msg-id="${row.msgId}">
          <td>${row.msgId}</td>
          <td>${row.totalOpens}</td>
          <td>${formatDate(row.lastOpened)}</td>
        </tr>
      `
    )
    .join('');

  messageTableBody.querySelectorAll<HTMLTableRowElement>('tr[data-msg-id]').forEach((row) => {
    row.addEventListener('click', () => {
      selectedMessageId = row.dataset.msgId ?? null;
      void loadMessageDetails();
    });
  });

  await loadMessageDetails();
}

async function loadMessageDetails(): Promise<void> {
  if (!selectedMessageId || !detailsList || !detailsTitle) {
    return;
  }

  const entries = await fetchJson<OpenLogEntry[]>(`/api/opens/${encodeURIComponent(selectedMessageId)}`);
  detailsTitle.textContent = `${selectedMessageId} • ${entries.length} open${entries.length === 1 ? '' : 's'}`;

  detailsList.innerHTML = entries.length
    ? entries
        .map(
          (entry) => `
            <li>
              <strong>${formatDate(entry.createdAt)}</strong><br />
              <span>IP: ${entry.ipAddress ?? 'Unknown'}</span><br />
              <span>User-Agent: ${entry.userAgent ?? 'Unknown'}</span>
            </li>
          `
        )
        .join('')
    : '<li>No open events recorded for this message.</li>';
}

async function loadLogs(): Promise<void> {
  if (!logList) {
    return;
  }

  const logs = await fetchJson<LogFileInfo[]>('/api/logs');
  if (logs.length === 0) {
    logList.innerHTML = '<li>No configured log files were found.</li>';
    selectedLogName = null;
    if (logTitle) {
      logTitle.textContent = 'Log output';
    }
    if (logContent) {
      logContent.textContent = 'Configure LOG_FILES or mount DMS logs to inspect them here.';
    }
    return;
  }

  if (!selectedLogName || !logs.some((log) => log.name === selectedLogName)) {
    selectedLogName = logs[0].name;
  }

  logList.innerHTML = logs
    .map(
      (log) => `
        <li>
          <button type="button" data-log-name="${log.name}" class="${log.name === selectedLogName ? 'active' : ''}">
            <strong>${log.name}</strong><br />
            <span>${log.exists ? `${log.path} • ${log.sizeBytes ?? 0} bytes` : `Missing: ${log.path}`}</span>
          </button>
        </li>
      `
    )
    .join('');

  logList.querySelectorAll<HTMLButtonElement>('button[data-log-name]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedLogName = button.dataset.logName ?? null;
      void loadLogContent();
      void loadLogs();
    });
  });

  await loadLogContent();
}

async function loadLogContent(): Promise<void> {
  if (!selectedLogName || !logTitle || !logContent) {
    return;
  }

  const response = await fetchJson<LogFileResponse>(`/api/logs/${encodeURIComponent(selectedLogName)}?lines=200`);
  logTitle.textContent = `${response.log.name} (${response.log.exists ? 'mounted' : 'missing'})`;
  logContent.textContent = response.content || 'No log content available.';
}

function startLogPolling(): void {
  if (logPoller) {
    return;
  }

  logPoller = window.setInterval(() => {
    void loadLogs();
  }, 10000);
}

function stopLogPolling(): void {
  if (logPoller) {
    window.clearInterval(logPoller);
    logPoller = undefined;
  }
}

window.addEventListener('popstate', () => {
  updateTabs();
  void initializeView();
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLAnchorElement) || !target.closest('.tabs')) {
    return;
  }

  if (target.origin !== window.location.origin) {
    return;
  }

  event.preventDefault();
  window.history.pushState({}, '', target.href);
  updateTabs();
  void initializeView();
});

refreshMetricsButton?.addEventListener('click', () => void loadMetrics());
refreshLogsButton?.addEventListener('click', () => void loadLogs());
tailLogButton?.addEventListener('click', () => void loadLogContent());

async function initializeView(): Promise<void> {
  if (isLogsRoute()) {
    await loadLogs();
    return;
  }

  await loadMetrics();
}

updateTabs();
void initializeView();
