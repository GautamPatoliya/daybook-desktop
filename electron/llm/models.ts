import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { BrowserWindow } from 'electron';
import { DataRoot } from '../../shared/store';
import { MODEL_CATALOG, type ModelCatalogItem } from '../../shared/types';
import { ruleBasedPolish } from '../../shared/email';

export type DownloadProgress = {
  id: string;
  received: number;
  total: number;
  done: boolean;
  error?: string;
  percent: number;
};

type ActiveDownload = {
  req?: http.ClientRequest;
  abort: boolean;
  received: number;
  total: number;
  lastEmit: number;
};

const downloads = new Map<string, ActiveDownload>();

function broadcastProgress(progress: DownloadProgress) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('models:progress', progress);
  }
}

function emitThrottled(state: ActiveDownload, id: string, force = false) {
  const now = Date.now();
  if (!force && now - state.lastEmit < 120) return;
  state.lastEmit = now;
  const percent = state.total > 0 ? Math.min(99.5, (state.received / state.total) * 100) : 0;
  broadcastProgress({
    id,
    received: state.received,
    total: state.total,
    done: false,
    percent,
  });
}

export function getActiveDownload(id: string): DownloadProgress | null {
  const d = downloads.get(id);
  if (!d) return null;
  return {
    id,
    received: d.received,
    total: d.total,
    done: false,
    percent: d.total > 0 ? Math.min(99.5, (d.received / d.total) * 100) : 0,
  };
}

export function listLocalModels(
  root: DataRoot,
): Array<
  ModelCatalogItem & {
    installed: boolean;
    path?: string;
    downloading: boolean;
    received: number;
    total: number;
    percent: number;
  }
> {
  root.ensureDirs();
  return MODEL_CATALOG.map((m) => {
    const dest = path.join(root.modelsDir, m.filename);
    const tmp = `${dest}.part`;
    const installed = fs.existsSync(dest);
    const active = downloads.get(m.id);
    let received = 0;
    let total = m.sizeBytes;
    let downloading = false;

    if (active) {
      downloading = true;
      received = active.received;
      total = active.total || m.sizeBytes;
    } else if (!installed && fs.existsSync(tmp)) {
      try {
        received = fs.statSync(tmp).size;
        total = m.sizeBytes;
        downloading = false; // paused/incomplete — UI can resume
      } catch {
        received = 0;
      }
    }

    const percent = installed
      ? 100
      : total > 0
        ? Math.min(99.5, (received / total) * 100)
        : 0;

    return {
      ...m,
      installed,
      path: installed ? dest : undefined,
      downloading,
      received,
      total,
      percent,
    };
  });
}

export function deleteModel(root: DataRoot, id: string): boolean {
  cancelDownload(id);
  const item = MODEL_CATALOG.find((m) => m.id === id);
  if (!item) return false;
  const dest = path.join(root.modelsDir, item.filename);
  const tmp = `${dest}.part`;
  for (const p of [dest, tmp]) {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  return true;
}

export function isDownloading(id: string): boolean {
  return downloads.has(id);
}

/**
 * Start (or resume) a model download in the background.
 * Resolves immediately once the request is underway — progress is broadcast.
 */
export function startDownload(root: DataRoot, id: string): { ok: true } | { ok: false; error: string } {
  if (downloads.has(id)) return { ok: true };
  const item = MODEL_CATALOG.find((m) => m.id === id);
  if (!item) return { ok: false, error: 'Unknown model' };

  root.ensureDirs();
  const dest = path.join(root.modelsDir, item.filename);
  const tmp = `${dest}.part`;

  if (fs.existsSync(dest)) {
    broadcastProgress({ id, received: item.sizeBytes, total: item.sizeBytes, done: true, percent: 100 });
    return { ok: true };
  }

  let startAt = 0;
  if (fs.existsSync(tmp)) {
    try {
      startAt = fs.statSync(tmp).size;
    } catch {
      startAt = 0;
    }
  }

  const state: ActiveDownload = {
    abort: false,
    received: startAt,
    total: item.sizeBytes,
    lastEmit: 0,
  };
  downloads.set(id, state);
  emitThrottled(state, id, true);

  const finishOk = () => {
    try {
      if (!fs.existsSync(tmp)) {
        throw new Error('Download file missing — please try again');
      }
      // Prefer rename; fall back to copy+unlink on Windows lock quirks
      try {
        fs.renameSync(tmp, dest);
      } catch {
        fs.copyFileSync(tmp, dest);
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
      }
      downloads.delete(id);
      broadcastProgress({
        id,
        received: state.total,
        total: state.total,
        done: true,
        percent: 100,
      });
    } catch (err) {
      downloads.delete(id);
      const message = (err as Error).message;
      broadcastProgress({ id, received: 0, total: 0, done: true, error: message, percent: 0 });
    }
  };

  const fail = (message: string) => {
    downloads.delete(id);
    broadcastProgress({ id, received: state.received, total: state.total, done: true, error: message, percent: 0 });
  };

  const get = (url: string, redirects = 0) => {
    if (redirects > 5) {
      fail('Too many redirects');
      return;
    }
    const lib = url.startsWith('https') ? https : http;
    const headers: Record<string, string> = {};
    if (startAt > 0) headers.Range = `bytes=${startAt}-`;

    const req = lib.get(url, { headers }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        get(res.headers.location, redirects + 1);
        return;
      }

      // 200 = full body, 206 = partial resume
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        fail(`Download failed: HTTP ${res.statusCode}`);
        res.resume();
        return;
      }

      if (res.statusCode === 200 && startAt > 0) {
        // Server ignored Range — restart file
        startAt = 0;
        state.received = 0;
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
      }

      const contentLength = Number(res.headers['content-length'] || 0);
      if (res.statusCode === 206 && contentLength) {
        state.total = startAt + contentLength;
      } else if (res.statusCode === 200 && contentLength) {
        state.total = contentLength;
      } else {
        state.total = Math.max(state.total, item.sizeBytes);
      }

      const out = fs.createWriteStream(tmp, { flags: startAt > 0 && res.statusCode === 206 ? 'a' : 'w' });

      res.on('data', (chunk: Buffer) => {
        if (state.abort) {
          res.destroy();
          return;
        }
        state.received += chunk.length;
        emitThrottled(state, id);
      });

      res.on('error', (err) => {
        out.destroy();
        if (!state.abort) fail(err.message);
      });

      out.on('error', (err) => {
        res.destroy();
        if (!state.abort) fail(err.message);
      });

      out.on('finish', () => {
        if (state.abort) {
          try {
            fs.unlinkSync(tmp);
          } catch {
            /* ignore */
          }
          downloads.delete(id);
          broadcastProgress({
            id,
            received: 0,
            total: 0,
            done: true,
            error: 'Download cancelled',
            percent: 0,
          });
          return;
        }
        finishOk();
      });

      res.pipe(out);
    });

    state.req = req;
    downloads.set(id, state);
    req.on('error', (err) => {
      if (!state.abort) fail(err.message);
    });
  };

  get(item.url);
  return { ok: true };
}

/** @deprecated Prefer startDownload — kept for callers that await completion. */
export function downloadModel(
  root: DataRoot,
  id: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const started = startDownload(root, id);
    if (!started.ok) {
      reject(new Error(started.error));
      return;
    }
    const item = MODEL_CATALOG.find((m) => m.id === id)!;
    const dest = path.join(root.modelsDir, item.filename);
    if (fs.existsSync(dest) && !downloads.has(id)) {
      resolve(dest);
      return;
    }

    const tick = setInterval(() => {
      if (fs.existsSync(dest) && !downloads.has(id)) {
        clearInterval(tick);
        onProgress({ id, received: item.sizeBytes, total: item.sizeBytes, done: true, percent: 100 });
        resolve(dest);
        return;
      }
      const active = getActiveDownload(id);
      if (active) onProgress(active);
      if (!downloads.has(id) && !fs.existsSync(dest)) {
        // Failed or cancelled
        clearInterval(tick);
        reject(new Error('Download did not complete'));
      }
    }, 250);
  });
}

export function cancelDownload(id: string) {
  const d = downloads.get(id);
  if (d) {
    d.abort = true;
    d.req?.destroy();
  }
}

/** Optional LLM polish — falls back to rule-based if node-llama-cpp unavailable. */
export async function polishText(root: DataRoot, modelId: string | null, raw: string): Promise<string> {
  const cleaned = raw.trim();
  if (!cleaned) return cleaned;
  if (!modelId) return ruleBasedPolish(cleaned);

  const item = MODEL_CATALOG.find((m) => m.id === modelId);
  if (!item) return ruleBasedPolish(cleaned);
  const modelPath = path.join(root.modelsDir, item.filename);
  if (!fs.existsSync(modelPath)) return ruleBasedPolish(cleaned);

  try {
    const mod = await import('node-llama-cpp');
    const llama = await mod.getLlama();
    const model = await llama.loadModel({ modelPath });
    const context = await model.createContext();
    const session = new mod.LlamaChatSession({ contextSequence: context.getSequence() });
    const result = await session.prompt(
      `Rewrite this work-log bullet to be concise and professional. Keep meaning. One line only. No quotes.\n\n${cleaned}`,
      { maxTokens: 80 },
    );
    const text = String(result || '').trim().replace(/^["']|["']$/g, '');
    if (!text || text.length > Math.max(cleaned.length * 1.4, cleaned.length + 40)) {
      return ruleBasedPolish(cleaned);
    }
    return text;
  } catch {
    return ruleBasedPolish(cleaned);
  }
}
