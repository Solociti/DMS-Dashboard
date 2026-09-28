import path from 'node:path';

export interface AppConfig {
  appRoot: string;
  port: number;
  databasePath: string;
  dmsRoot: string;
  trustProxy: boolean | number | string;
  trackingBaseUrl: string;
  trackingLuaSourcePath: string;
  publicRoot: string;
  publicDistRoot: string;
  logFiles: Record<string, string>;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return value;
}

function parseLogFiles(raw: string | undefined, dmsRoot: string): Record<string, string> {
  if (!raw) {
    return {
      rspamd: path.join(dmsRoot, 'logs', 'rspamd.log'),
      mail: path.join(dmsRoot, 'logs', 'mail.log')
    };
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, entry) => {
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex <= 0) {
        return accumulator;
      }

      const name = entry.slice(0, separatorIndex).trim();
      const filePath = entry.slice(separatorIndex + 1).trim();
      if (name && filePath) {
        accumulator[name] = filePath;
      }
      return accumulator;
    }, {});
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const appRoot = process.cwd();
  const dmsRoot = environment.DMS_ROOT || '/dms';

  return {
    appRoot,
    port: parseNumber(environment.PORT, 3000),
    databasePath: environment.DATABASE_PATH || '/data/tracker.sqlite',
    dmsRoot,
    trustProxy: parseTrustProxy(environment.TRUST_PROXY),
    trackingBaseUrl: (environment.TRACKING_BASE_URL || 'https://example.invalid').replace(/\/$/, ''),
    trackingLuaSourcePath: path.join(appRoot, 'dms', 'email_tracking.lua'),
    publicRoot: path.join(appRoot, 'public'),
    publicDistRoot: path.join(appRoot, 'public', 'dist'),
    logFiles: parseLogFiles(environment.LOG_FILES, dmsRoot)
  };
}
