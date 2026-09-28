export interface OpenSummary {
  msgId: string;
  totalOpens: number;
  lastOpened: string | null;
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
