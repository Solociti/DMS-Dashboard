import express, { type Request, type Response } from 'express';
import path from 'node:path';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Knex } from 'knex';

import type { OpenLogEntry, OpenSummary } from '../../common/types';
import type { AppConfig } from './config';
import { listLogFiles, readLogFile, type LogRegistry } from './logs';
import { WarningStore } from './warnings';

const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAPAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const dashboardIndexPath = 'index.html';

interface RawOpenRow {
  id: number;
  msg_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface RawSummaryRow {
  msg_id: string;
  total_opens: number | string;
  last_opened: string | null;
}

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

export function getClientIp(request: Request): string | null {
  return request.ip || request.socket.remoteAddress || null;
}

function createRateLimiter(limit: number, windowMs: number): express.RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (request) => ipKeyGenerator(request.ip || request.socket.remoteAddress || '127.0.0.1')
  });
}

async function getOpenSummaries(database: Knex): Promise<OpenSummary[]> {
  const rows = (await database<RawSummaryRow>('opens')
    .select('msg_id')
    .count<{ total_opens: number | string }>({ total_opens: '*' })
    .max({ last_opened: 'created_at' })
    .groupBy('msg_id')
    .orderBy('last_opened', 'desc')) as unknown as RawSummaryRow[];

  return rows.map((row) => ({
    msgId: row.msg_id,
    totalOpens: Number(row.total_opens),
    lastOpened: row.last_opened
  }));
}

async function getOpenEvents(database: Knex, msgId: string): Promise<OpenLogEntry[]> {
  const rows = await database<RawOpenRow>('opens').where({ msg_id: msgId }).orderBy('created_at', 'desc');
  return rows.map((row) => ({
    id: row.id,
    msgId: row.msg_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at
  }));
}

export function createApp(config: AppConfig, database: Knex, logRegistry: LogRegistry, warningStore: WarningStore): express.Express {
  const app = express();
  const openPixelLimiter = createRateLimiter(120, 60_000);
  const opensApiLimiter = createRateLimiter(240, 60_000);
  const dashboardLimiter = createRateLimiter(240, 60_000);
  const logLimiter = createRateLimiter(120, 60_000);
  const warningLimiter = createRateLimiter(60, 60_000);
  const dashboardIndexFile = path.join(config.publicDistRoot, dashboardIndexPath);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(express.json());
  app.use(express.static(config.publicRoot));
  app.use('/dashboard', express.static(config.publicDistRoot, { index: false }));

  app.get('/', (_request: Request, response: Response) => {
    response.redirect('/dashboard');
  });

  app.get('/open/:msgId.png', openPixelLimiter, async (request: Request, response: Response, next) => {
    try {
      const msgId = getRouteParam(request.params.msgId);
      if (!msgId) {
        response.status(400).json({ error: 'Missing message id' });
        return;
      }

      response.setHeader('Content-Type', 'image/gif');
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      response.send(TRANSPARENT_GIF);

      void database('opens').insert({
        msg_id: msgId,
        ip_address: getClientIp(request),
        user_agent: request.header('user-agent') || null
      }).catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/opens', opensApiLimiter, async (_request, response, next) => {
    try {
      response.json(await getOpenSummaries(database));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/opens/:msgId', opensApiLimiter, async (request, response, next) => {
    try {
      const msgId = getRouteParam(request.params.msgId);
      if (!msgId) {
        response.status(400).json({ error: 'Missing message id' });
        return;
      }

      response.json(await getOpenEvents(database, msgId));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/logs', logLimiter, async (_request, response, next) => {
    try {
      response.json(await listLogFiles(logRegistry));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/logs/:name', logLimiter, async (request, response, next) => {
    try {
      const lines = Number(request.query.lines ?? 200);
      const logName = getRouteParam(request.params.name);
      if (!logName) {
        response.status(400).json({ error: 'Missing log name' });
        return;
      }

      response.json(await readLogFile(logRegistry, logName, lines));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/warnings', warningLimiter, (_request, response) => {
    response.json(warningStore.getState());
  });

  app.post('/api/warnings/recheck', warningLimiter, async (_request, response, next) => {
    try {
      response.json(await warningStore.refresh());
    } catch (error) {
      next(error);
    }
  });

  app.get(['/dashboard', '/dashboard/*path'], dashboardLimiter, (_request, response, next) => {
    response.sendFile(dashboardIndexFile, (error) => {
      if (error) {
        next(error);
      }
    });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    response.status(message.startsWith('Unknown log file') ? 404 : 500).json({ error: message });
  });

  return app;
}
