import express, { type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Knex } from 'knex';

import type { OpenLogEntry, OpenSummary } from '../../common/types';
import type { AppConfig } from './config';
import { listLogFiles, readLogFile, type LogRegistry } from './logs';

const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAPAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

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

export function getClientIp(request: Request): string | null {
  const forwardedFor = request.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return request.ip || request.socket.remoteAddress || null;
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

export function createApp(config: AppConfig, database: Knex, logRegistry: LogRegistry): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json());
  app.use(express.static(config.publicRoot));
  app.use('/dashboard', express.static(config.publicDistRoot, { index: false }));

  app.get('/', (_request: Request, response: Response) => {
    response.redirect('/dashboard');
  });

  app.get('/open/:msgId.png', async (request: Request, response: Response, next) => {
    try {
      await database('opens').insert({
        msg_id: request.params.msgId,
        ip_address: getClientIp(request),
        user_agent: request.header('user-agent') || null
      });

      response.setHeader('Content-Type', 'image/gif');
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      response.send(TRANSPARENT_GIF);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/opens', async (_request, response, next) => {
    try {
      response.json(await getOpenSummaries(database));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/opens/:msgId', async (request, response, next) => {
    try {
      response.json(await getOpenEvents(database, request.params.msgId));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/logs', async (_request, response, next) => {
    try {
      response.json(await listLogFiles(logRegistry));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/logs/:name', async (request, response, next) => {
    try {
      const lines = Number(request.query.lines ?? 200);
      response.json(await readLogFile(logRegistry, request.params.name, lines));
    } catch (error) {
      next(error);
    }
  });

  app.get(['/dashboard', '/dashboard/*path'], async (_request, response, next) => {
    try {
      const html = await fs.readFile(path.join(config.publicDistRoot, 'index.html'), 'utf8');
      response.type('html').send(html);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    response.status(message.startsWith('Unknown log file') ? 404 : 500).json({ error: message });
  });

  return app;
}
