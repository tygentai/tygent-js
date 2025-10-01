import http, { IncomingMessage, ServerResponse } from 'http';
import { DEFAULT_INGESTOR_REGISTRY } from './ingestors';
import { ServiceState } from './state';
import { getLogger } from '../logging';

const log = getLogger('service-server');

export interface ServerOptions {
  port?: number;
  statePath?: string;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function notFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.end('Not Found');
}

export function createServer(options: ServerOptions = {}) {
  const state = new ServiceState(options.statePath);

  return http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'GET' && req.url === '/catalog') {
        sendJson(res, 200, { ingestors: DEFAULT_INGESTOR_REGISTRY.describe() });
        return;
      }

      if (req.method === 'GET' && req.url === '/accounts') {
        sendJson(res, 200, { accounts: state.listAccounts().map((acc) => acc.toJSON()) });
        return;
      }

      notFound(res);
    } catch (error) {
      log.error('Server request failed', { error, url: req.url });
      sendJson(res, 500, { error: 'Internal Server Error' });
    }
  });
}

export async function startServer(options: ServerOptions = {}): Promise<http.Server> {
  const server = createServer(options);
  const port = options.port ?? 8080;
  await new Promise<void>((resolve) => server.listen(port, resolve));
  log.info('Service server started', { port });
  return server;
}
