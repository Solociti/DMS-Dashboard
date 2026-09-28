import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureTrackingFilter(dmsRoot: string, trackingLuaSourcePath: string): Promise<void> {
  const overrideDirectory = path.join(dmsRoot, 'rspamd', 'override.d');
  const stats = await fs.stat(overrideDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      throw new Error(`Required Rspamd override directory is missing: ${overrideDirectory}`);
    }

    throw error;
  });

  if (!stats.isDirectory()) {
    throw new Error(`${overrideDirectory} is not a directory`);
  }

  const targetPath = path.join(overrideDirectory, 'email_tracking.lua');

  try {
    await fs.access(targetPath);
    return;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }

    // Missing file is expected during first-time setup.
  }

  await fs.copyFile(trackingLuaSourcePath, targetPath);
}
