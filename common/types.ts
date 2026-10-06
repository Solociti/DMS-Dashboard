export interface OpenSummary {
  msgId: string;
  totalOpens: number;
  lastOpened: string | null;
  sentAt: string | null;
  subject: string | null;
  sender: string | null;
  recipients: string[];
}

export interface OpenSummaryPage {
  items: OpenSummary[];
  /** Messages matching the filters across all pages. */
  total: number;
  /** Opens across all matching messages. */
  totalOpens: number;
  page: number;
  pageSize: number;
}

export interface OpenLogEntry {
  id: number;
  msgId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface LogFileInfo {
  name: string;
  exists: boolean;
  sizeBytes: number | null;
  updatedAt: string | null;
}

export interface LogFileResponse {
  log: LogFileInfo;
  lines: number;
  content: string;
}

export interface DashboardWarning {
  code: string;
  title: string;
  message: string;
}

export interface WarningState {
  warnings: DashboardWarning[];
  checkedAt: string | null;
}

export interface TrackingBlacklistResponse {
  addresses: string[];
}

export interface IgnoredIp {
  ip: string;
  note: string | null;
}

export interface IgnoredIpsResponse {
  ips: IgnoredIp[];
  currentIp: string | null;
}

export type OpenScope = "mine" | "all";
export type OpenSortField = "sent" | "opened";
export type SortDirection = "asc" | "desc";
