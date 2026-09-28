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

function replaceChildren(element: Element, ...children: Node[]): void {
  element.replaceChildren(...children);
}

function createElement<K extends keyof HTMLElementTagNameMap>(tagName: K, textContent?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function runOverviewTask(task: () => Promise<void>): void {
  task().catch((error) => {
    if (messageTableBody) {
      const row = createElement('tr');
      const cell = createElement('td', getErrorMessage(error));
      cell.colSpan = 3;
      row.append(cell);
      replaceChildren(messageTableBody, row);
    }

    if (detailsTitle) {
      detailsTitle.textContent = 'Overview failed to load';
    }

    if (detailsList) {
      replaceChildren(detailsList, createElement('li', getErrorMessage(error)));
    }
  });
}

function runLogTask(task: () => Promise<void>): void {
  task().catch((error) => {
    if (logTitle) {
      logTitle.textContent = 'Log output';
    }

    if (logContent) {
      logContent.textContent = getErrorMessage(error);
    }
  });
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
    const emptyRow = createElement('tr');
    const emptyCell = createElement('td', 'No tracking data yet.');
    emptyCell.colSpan = 3;
    emptyRow.append(emptyCell);
    replaceChildren(messageTableBody, emptyRow);
    detailsTitle && (detailsTitle.textContent = 'Select a message to inspect open events.');
    detailsList && replaceChildren(detailsList, createElement('li', 'No message selected.'));
    return;
  }

  if (!selectedMessageId || !rows.some((row) => row.msgId === selectedMessageId)) {
    selectedMessageId = rows[0].msgId;
  }

  replaceChildren(
    messageTableBody,
    ...rows.map((row) => {
      const tableRow = createElement('tr');
      tableRow.dataset.msgId = row.msgId;
      tableRow.append(
        createElement('td', row.msgId),
        createElement('td', String(row.totalOpens)),
        createElement('td', formatDate(row.lastOpened))
      );
      tableRow.addEventListener('click', () => {
        selectedMessageId = row.msgId;
        void loadMessageDetails();
      });
      return tableRow;
    })
  );

  await loadMessageDetails();
}

async function loadMessageDetails(): Promise<void> {
  if (!selectedMessageId || !detailsList || !detailsTitle) {
    return;
  }

  const entries = await fetchJson<OpenLogEntry[]>(`/api/opens/${encodeURIComponent(selectedMessageId)}`);
  detailsTitle.textContent = `${selectedMessageId} • ${entries.length} open${entries.length === 1 ? '' : 's'}`;

  if (entries.length === 0) {
    replaceChildren(detailsList, createElement('li', 'No open events recorded for this message.'));
    return;
  }

  replaceChildren(
    detailsList,
    ...entries.map((entry) => {
      const item = createElement('li');
      const timestamp = createElement('strong', formatDate(entry.createdAt));
      const ip = createElement('span', `IP: ${entry.ipAddress ?? 'Unknown'}`);
      const agent = createElement('span', `User-Agent: ${entry.userAgent ?? 'Unknown'}`);
      item.append(timestamp, document.createElement('br'), ip, document.createElement('br'), agent);
      return item;
    })
  );
}

async function loadLogs(): Promise<void> {
  if (!logList) {
    return;
  }

  const logs = await fetchJson<LogFileInfo[]>('/api/logs');
  if (logs.length === 0) {
    replaceChildren(logList, createElement('li', 'No configured log files were found.'));
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

  replaceChildren(
    logList,
    ...logs.map((log) => {
      const item = createElement('li');
      const button = createElement('button');
      button.type = 'button';
      button.dataset.logName = log.name;
      button.classList.toggle('active', log.name === selectedLogName);

      const title = createElement('strong', log.name);
      const details = createElement(
        'span',
        log.exists
          ? `${log.sizeBytes ?? 0} bytes${log.updatedAt ? ` • Updated ${formatDate(log.updatedAt)}` : ''}`
          : 'Missing log file'
      );

      button.append(title, document.createElement('br'), details);
      button.addEventListener('click', () => {
        selectedLogName = log.name;
        void loadLogContent();
        void loadLogs();
      });

      item.append(button);
      return item;
    })
  );

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
    runLogTask(loadLogs);
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
  initializeView();
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
  initializeView();
});

refreshMetricsButton?.addEventListener('click', () => runOverviewTask(loadMetrics));
refreshLogsButton?.addEventListener('click', () => runLogTask(loadLogs));
tailLogButton?.addEventListener('click', () => runLogTask(loadLogContent));

function initializeView(): void {
  if (isLogsRoute()) {
    runLogTask(loadLogs);
    return;
  }

  runOverviewTask(loadMetrics);
}

updateTabs();
initializeView();
