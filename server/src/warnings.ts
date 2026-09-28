import fs from 'node:fs/promises';
import path from 'node:path';

import type { DashboardWarning, WarningState } from '../../common/types';
import type { AppConfig } from './config';
import { ensureTrackingFilter } from './dms';

function createWarning(code: string, title: string, message: string): DashboardWarning {
  return { code, title, message };
}

async function collectTrackingWarnings(config: AppConfig): Promise<DashboardWarning[]> {
  const warnings: DashboardWarning[] = [];
  const overrideDirectory = path.join(config.dmsRoot, 'rspamd', 'override.d');

  if (!config.trackingBaseUrl) {
    warnings.push(
      createWarning(
        'tracking-base-url-missing',
        'Tracking URL not configured',
        'Set TRACKING_BASE_URL to install the Rspamd filter and enable email open tracking.'
      )
    );
  }

  try {
    const stats = await fs.stat(overrideDirectory);
    if (!stats.isDirectory()) {
      warnings.push(
        createWarning(
          'rspamd-override-invalid',
          'Rspamd override path is invalid',
          `${overrideDirectory} exists but is not a directory, so the tracking filter was not installed.`
        )
      );
    }
  } catch (error) {
    const issue = error as NodeJS.ErrnoException;
    warnings.push(
      createWarning(
        issue.code === 'ENOENT' ? 'rspamd-override-missing' : 'rspamd-override-unavailable',
        'Rspamd override directory unavailable',
        issue.code === 'ENOENT'
          ? `${overrideDirectory} does not exist, so the tracking filter copy was skipped.`
          : `The tracking filter copy was skipped because ${overrideDirectory} could not be checked: ${issue.message}.`
      )
    );
  }

  if (!config.trackingBaseUrl || warnings.some((warning) => warning.code.startsWith('rspamd-override-'))) {
    return warnings;
  }

  try {
    await ensureTrackingFilter(config.dmsRoot, config.trackingLuaSourcePath);
  } catch (error) {
    warnings.push(
      createWarning(
        'tracking-filter-install-failed',
        'Tracking filter install failed',
        error instanceof Error ? error.message : 'The bundled Rspamd filter could not be installed.'
      )
    );
  }

  return warnings;
}

export class WarningStore {
  private state: WarningState = {
    warnings: [],
    checkedAt: null
  };

  constructor(private readonly config: AppConfig) {}

  getState(): WarningState {
    return this.state;
  }

  async refresh(): Promise<WarningState> {
    this.state = {
      warnings: await collectTrackingWarnings(this.config),
      checkedAt: new Date().toISOString()
    };

    return this.state;
  }
}
