import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';

import type { LogFileInfo, LogFileResponse, LogSearchResponse } from '../../common/types';

const MAX_SEARCH_HITS = 500;
const MAX_SEARCH_BYTES = 512 * 1024 * 1024;

export async function listLogFiles(logDir: string): Promise<LogFileInfo[]> {
  let names: string[];
  try {
    names = await fs.readdir(logDir);
  } catch {
    return [];
  }

  const entries = await Promise.all(
    names.map(async (name): Promise<LogFileInfo | null> => {
      try {
        const stats = await fs.stat(path.join(logDir, name));
        if (!stats.isFile()) {
          return null;
        }

        return {
          name,
          exists: true,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString()
        };
      } catch {
        return null;
      }
    })
  );

  return entries
    .filter((entry): entry is LogFileInfo => entry !== null)
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') || left.name.localeCompare(right.name));
}

function openLines(filePath: string): readline.Interface {
  const source = createReadStream(filePath);
  const input = filePath.endsWith('.gz') ? source.pipe(zlib.createGunzip()) : source;

  // Errors on the source are not forwarded by pipe().
  source.on('error', (error) => input.destroy(error));

  return readline.createInterface({ input, crlfDelay: Infinity });
}

async function readGzipTail(filePath: string, safeLines: number): Promise<string> {
  const tail: string[] = [];

  try {
    for await (const line of openLines(filePath)) {
      tail.push(line);
      if (tail.length > safeLines) {
        tail.shift();
      }
    }
  } catch {
    return tail.join('\n');
  }

  return tail.join('\n');
}

async function readTail(filePath: string, lines: number): Promise<string> {
  const safeLines = Number.isFinite(lines) && lines > 0 ? Math.min(lines, 2000) : 200;

  if (filePath.endsWith('.gz')) {
    return readGzipTail(filePath, safeLines);
  }

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

export async function readLogFile(logDir: string, name: string, lines = 200): Promise<LogFileResponse> {
  // Only names returned by the directory listing are readable, which rules out traversal.
  const log = (await listLogFiles(logDir)).find((entry) => entry.name === name);
  if (!log) {
    throw new Error(`Unknown log file: ${name}`);
  }

  return {
    log,
    lines,
    content: await readTail(path.join(logDir, name), lines)
  };
}

export async function searchLogs(
  logDir: string,
  terms: string[],
  limits: { maxHits?: number; maxBytes?: number } = {}
): Promise<LogSearchResponse> {
  const maxHits = limits.maxHits ?? MAX_SEARCH_HITS;
  let bytesLeft = limits.maxBytes ?? MAX_SEARCH_BYTES;
  const files = await listLogFiles(logDir);
  const hits: LogSearchResponse['hits'] = [];
  let truncated = false;
  let filesScanned = 0;

  for (const file of files) {
    if (truncated) {
      break;
    }

    filesScanned += 1;
    const lines = openLines(path.join(logDir, file.name));

    try {
      for await (const line of lines) {
        bytesLeft -= line.length + 1;
        if (bytesLeft < 0) {
          truncated = true;
          break;
        }

        if (terms.some((term) => line.includes(term))) {
          if (hits.length >= maxHits) {
            truncated = true;
            break;
          }

          hits.push({ file: file.name, line });
        }
      }
    } catch {
      // Unreadable or corrupt files are skipped.
    } finally {
      lines.close();
    }
  }

  return { terms, hits, truncated, filesScanned };
}
