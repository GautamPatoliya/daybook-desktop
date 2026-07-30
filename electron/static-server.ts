import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Dedicated UI port — kept far from common developer ports
 * (3000, 5173, 8080, 4200, 5000, etc.).
 * Packaged app and `npm run dev` both use this.
 */
export const WTT_UI_PORT = 41763;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function resolveUnderRoot(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0] || '/');
  let rel = decoded.replace(/^\/+/, '');
  if (!rel || rel.endsWith('/')) {
    rel = path.join(rel, 'index.html');
  }
  const candidate = path.normalize(path.join(root, rel));
  if (!candidate.startsWith(path.normalize(root + path.sep)) && candidate !== path.normalize(root)) {
    return null;
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  // Next trailingSlash export: /analytics -> analytics/index.html
  const asDir = path.normalize(path.join(root, rel, 'index.html'));
  if (asDir.startsWith(path.normalize(root + path.sep)) && fs.existsSync(asDir)) return asDir;
  const html = `${candidate}.html`;
  if (html.startsWith(path.normalize(root + path.sep)) && fs.existsSync(html)) return html;
  return null;
}

function createServer(root: string) {
  return http.createServer((req, res) => {
    try {
      const urlPath = req.url || '/';
      const file = resolveUnderRoot(root, urlPath);
      if (!file) {
        const fallback = path.join(root, '404.html');
        if (fs.existsSync(fallback)) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(fallback).pipe(res);
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      fs.createReadStream(file).pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end((err as Error).message);
    }
  });
}

function listen(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

export function startStaticServer(root: string): Promise<{ port: number; close: () => void }> {
  return (async () => {
    // Prefer fixed unique port; if taken (rare), try a short reserved band, never 3xxx/5xxx.
    const candidates = [WTT_UI_PORT, WTT_UI_PORT + 1, WTT_UI_PORT + 2, WTT_UI_PORT + 3, WTT_UI_PORT + 4];
    let lastError: unknown;
    for (const port of candidates) {
      const server = createServer(root);
      try {
        await listen(server, port);
        return {
          port,
          close: () => {
            server.close();
          },
        };
      } catch (err) {
        lastError = err;
        server.close();
        if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Could not bind Daybook UI port near ${WTT_UI_PORT}`);
  })();
}

export function rendererOutDir(): string {
  // packaged: .../app.asar/dist-electron/electron -> .../app.asar/renderer/out
  const fromAsar = path.join(__dirname, '..', '..', 'renderer', 'out');
  if (fs.existsSync(path.join(fromAsar, 'index.html'))) return fromAsar;
  // dev/fallback
  const fromCwd = path.join(process.cwd(), 'renderer', 'out');
  if (fs.existsSync(path.join(fromCwd, 'index.html'))) return fromCwd;
  return fromAsar;
}

/** Useful for debugging load failures. */
export function rendererIndexFileUrl(): string {
  return pathToFileURL(path.join(rendererOutDir(), 'index.html')).href;
}
