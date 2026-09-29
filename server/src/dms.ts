import fs from 'node:fs/promises';
import path from 'node:path';

function quoteLuaString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export async function ensureTrackingFilter(
  rspamdDirectory: string,
  trackingLuaSourcePath: string,
  trackingBaseUrl: string
): Promise<void> {
  const stats = await fs.stat(rspamdDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      throw new Error(`Required Rspamd directory is missing: ${rspamdDirectory}`);
    }

    throw error;
  });

  if (!stats.isDirectory()) {
    throw new Error(`${rspamdDirectory} is not a directory`);
  }

  const targetPath = path.join(rspamdDirectory, 'rspamd.local.lua');
  const sourceTemplate = await fs.readFile(trackingLuaSourcePath, 'utf8');
  const placeholder = '"__TRACKING_BASE_URL__"';
  if (!sourceTemplate.includes(placeholder)) {
    throw new Error(`Tracking URL placeholder is missing from ${trackingLuaSourcePath}`);
  }

  const source = sourceTemplate.replace(placeholder, quoteLuaString(trackingBaseUrl));

  try {
    const existing = await fs.readFile(targetPath, 'utf8');
    if (existing === source) {
      return;
    }
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.writeFile(targetPath, source, 'utf8');
}
