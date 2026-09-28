import fs from 'node:fs/promises';

import type { LogFileInfo, LogFileResponse } from '../../common/types';

export interface LogRegistry {
  [name: string]: string;
}

export async function listLogFiles(registry: LogRegistry): Promise<LogFileInfo[]> {
  const entries = await Promise.all(
    Object.entries(registry).map(async ([name, filePath]) => {
      try {
        const stats = await fs.stat(filePath);
        return {
          name,
          exists: true,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString()
        } satisfies LogFileInfo;
      } catch {
        return {
          name,
          exists: false,
          sizeBytes: null,
          updatedAt: null
        } satisfies LogFileInfo;
      }
    })
  );

  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

async function readTail(filePath: string, lines: number): Promise<string> {
  const safeLines = Number.isFinite(lines) && lines > 0 ? Math.min(lines, 2000) : 200;

  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const stats = await handle.stat();
      const bytesToRead = Math.min(stats.size, 1024 * 1024);
      const buffer = Buffer.alloc(bytesToRead);
      await handle.read(buffer, 0, bytesToRead, Math.max(stats.size - bytesToRead, 0));
      const content = buffer.toString('utf8');
      const segments = content.split(/\r?\n/);
      if (segments[segments.length - 1] === '') {
        segments.pop();
      }
      return segments.slice(-safeLines).join('\n');
    } finally {
      await handle.close();
    }
  } catch {
    return '';
  }
}

export async function readLogFile(registry: LogRegistry, name: string, lines = 200): Promise<LogFileResponse> {
  const filePath = registry[name];
  if (!filePath) {
    throw new Error(`Unknown log file: ${name}`);
  }

  const [logs] = await Promise.all([listLogFiles({ [name]: filePath })]);

  return {
    log: logs[0],
    lines,
    content: logs[0].exists ? await readTail(filePath, lines) : ''
  };
}
