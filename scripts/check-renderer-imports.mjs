/**
 * Fail if the Next.js renderer value-imports shared (or other) modules that
 * pull in Node builtins (`node:crypto`, `fs`, etc.). That breaks webpack
 * locally, in CI, and in Windows/mac packaged builds.
 *
 * Usage: node scripts/check-renderer-imports.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RENDERER = path.join(ROOT, 'renderer');
const SHARED = path.join(ROOT, 'shared');

const NODE_BUILTIN_RE =
  /\b(?:from|import)\s+['"](?:node:)?(?:fs|path|crypto|os|child_process|net|tls|http|https|stream|buffer|util|url|zlib|assert|events|module|worker_threads|readline|dns|cluster|dgram|vm|tty|perf_hooks|querystring|string_decoder|constants|inspector|async_hooks|diagnostics_channel|v8|trace_events)(?:\/[^'"]*)?['"]|require\(\s*['"](?:node:)?(?:fs|path|crypto|os|child_process)['"]\s*\)/;

const IMPORT_RE =
  /^\s*import\s+(?!type\b)(?:(?:type\s+)?[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]/gm;
const EXPORT_FROM_RE =
  /^\s*export\s+(?!type\b)(?:[\w*{}\s,$]+?\s+from\s+)['"]([^'"]+)['"]/gm;
const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === '.next' || name.name === 'out') continue;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name.name)) out.push(full);
  }
  return out;
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function collectSpecs(source) {
  const specs = new Set();
  for (const re of [IMPORT_RE, EXPORT_FROM_RE, REQUIRE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source))) specs.add(m[1]);
  }
  return [...specs];
}

/** Value-import entrypoints from renderer → shared (or relative into shared). */
function rendererSharedEntrypoints() {
  const entries = [];
  for (const file of walk(RENDERER)) {
    const src = fs.readFileSync(file, 'utf8');
    // Strip type-only imports so they are not treated as runtime edges.
    const withoutTypeImports = src
      .replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');

    for (const spec of collectSpecs(withoutTypeImports)) {
      const resolved = resolveImport(file, spec);
      if (!resolved) continue;
      const norm = resolved.split(path.sep).join('/');
      if (norm.includes('/shared/')) {
        entries.push({ from: file, spec, resolved });
      }
    }
  }
  return entries;
}

function hasNodeBuiltin(file) {
  const src = fs.readFileSync(file, 'utf8');
  return NODE_BUILTIN_RE.test(src);
}

function transitiveNodeDeps(entryFile) {
  const queue = [entryFile];
  const seen = new Set();
  const hits = [];

  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);

    // Only walk our shared/ (and other repo) sources — not node_modules.
    if (!file.startsWith(ROOT) || file.includes(`${path.sep}node_modules${path.sep}`)) continue;

    if (hasNodeBuiltin(file)) {
      hits.push(file);
      continue; // still record; no need to expand further for messaging
    }

    const src = fs.readFileSync(file, 'utf8');
    for (const spec of collectSpecs(src)) {
      const resolved = resolveImport(file, spec);
      if (resolved) queue.push(resolved);
    }
  }
  return hits;
}

const entries = rendererSharedEntrypoints();
const failures = [];

for (const { from, spec, resolved } of entries) {
  const hits = transitiveNodeDeps(resolved);
  if (hits.length) {
    failures.push({
      from: path.relative(ROOT, from),
      spec,
      resolved: path.relative(ROOT, resolved),
      via: hits.map((h) => path.relative(ROOT, h)),
    });
  }
}

if (failures.length) {
  console.error('Renderer imports Node-only modules (breaks Next.js webpack / packaged UI):\n');
  for (const f of failures) {
    console.error(`  ${f.from}`);
    console.error(`    imports "${f.spec}" → ${f.resolved}`);
    console.error(`    Node builtin via: ${f.via.join(', ')}`);
    console.error('');
  }
  console.error(
    'Fix: move browser-safe helpers into a pure shared module (no node:* imports),\n' +
      'or call Node logic only through Electron IPC from the main process.',
  );
  process.exit(1);
}

// Extra: shared/analyticsFormat.ts must stay Node-free even if unused.
const formatFile = path.join(SHARED, 'analyticsFormat.ts');
if (fs.existsSync(formatFile) && hasNodeBuiltin(formatFile)) {
  console.error('shared/analyticsFormat.ts must stay browser-safe (no Node builtins).');
  process.exit(1);
}

console.log(
  `check-renderer-imports: ok (${entries.length} shared value import${entries.length === 1 ? '' : 's'} scanned)`,
);
