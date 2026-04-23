/**
 * Vercel serverless entrypoint。
 *
 * Vercel Node runtime 默认会预解析请求 body（application/json → req.body 对象），
 * 把流提前消费掉。@hono/node-server/vercel 的 handle 依赖 Readable.toWeb(incoming)
 * 拿原始流，就会阻塞永远拿不到 body。
 *
 * 解决办法：自己把 IncomingMessage + 可能已解析的 req.body 还原成 Web Request，
 * 交给 Hono 的 app.fetch，再把返回的 Response 写回 ServerResponse。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/app.js';

export const config = { runtime: 'nodejs' };

const app = createApp();

type VercelReq = IncomingMessage & { body?: unknown };

function incomingToRequest(req: VercelReq): Request {
  const host = req.headers.host ?? 'localhost';
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ??
    ((req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http');
  const url = new URL(req.url ?? '/', `${proto}://${host}`);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, item);
    } else if (typeof v === 'string') {
      headers.set(k, v);
    }
  }

  const method = req.method ?? 'GET';
  let body: string | Uint8Array | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = new Uint8Array(req.body);
    } else if (req.body !== undefined && req.body !== null) {
      body = JSON.stringify(req.body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
  }

  return new Request(url.toString(), {
    method,
    headers,
    body,
  });
}

async function writeResponse(res: ServerResponse, webRes: Response): Promise<void> {
  const responseHeaders: Record<string, string | string[]> = {};
  const cookies: string[] = [];
  webRes.headers.forEach((value, key) => {
    if (key === 'set-cookie') {
      cookies.push(value);
    } else {
      responseHeaders[key] = value;
    }
  });
  if (cookies.length > 0) responseHeaders['set-cookie'] = cookies;
  res.writeHead(webRes.status, responseHeaders);
  if (webRes.body) {
    const reader = webRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(value);
      }
    } finally {
      res.end();
    }
  } else {
    res.end();
  }
}

export default async function handler(req: VercelReq, res: ServerResponse) {
  try {
    const request = incomingToRequest(req);
    const response = await app.fetch(request);
    await writeResponse(res, response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[vercel-handler] error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
    }
    res.end(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'handler failure' }));
  }
}
