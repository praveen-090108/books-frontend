import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(root, 'src');
const outRoot = process.env.SOURCE_CACHE_DIR || '/private/tmp/intelliatech-source-cache';
const depOutRoot = process.env.SOURCE_DEPS_DIR || path.join(root, '.source-deps');
const pnpmRoot = path.join(root, 'node_modules/.pnpm');
const esbuildPackage = readdirSync(pnpmRoot)
  .filter((entry) => /^esbuild@\d/.test(entry))
  .sort()
  .at(-1);
if (!esbuildPackage) throw new Error('The esbuild package is missing. Run pnpm install in the frontend directory.');
const esbuildBin = path.join(pnpmRoot, esbuildPackage, 'node_modules/esbuild/bin/esbuild');

const depEntries = new Map([
  ['@tanstack/react-query', '@tanstack_react-query.js'],
  ['axios', 'axios.js'],
  ['lucide-react', 'lucide-react.js'],
  ['react', 'react.js'],
  ['react-dom/client', 'react-dom_client.js'],
  ['react/jsx-runtime', 'react_jsx-runtime.js'],
  ['react/jsx-dev-runtime', 'react_jsx-dev-runtime.js'],
  ['react-router-dom', 'react-router-dom.js'],
  ['zustand', 'zustand.js'],
]);

const depMap = new Map([
  ['@tanstack/react-query', '/@deps/@tanstack_react-query.js'],
  ['axios', '/@deps/axios.js'],
  ['lucide-react', '/@deps/lucide-react.js'],
  ['react', '/@shim/react.js'],
  ['react-dom/client', '/@shim/react-dom-client.js'],
  ['react/jsx-runtime', '/@shim/react-jsx-runtime.js'],
  ['react/jsx-dev-runtime', '/@shim/react-jsx-dev-runtime.js'],
  ['react-router-dom', '/@deps/react-router-dom.js'],
  ['zustand', '/@deps/zustand.js'],
]);

function resolveSourcePath(requestPath) {
  const cleanPath = requestPath.replace(/^\/src\/?/, '');
  const direct = path.resolve(srcRoot, cleanPath);
  if (!direct.startsWith(srcRoot)) return null;
  if (existsSync(direct)) return direct;
  for (const ext of ['.jsx', '.js', '.json']) {
    if (existsSync(`${direct}${ext}`)) return `${direct}${ext}`;
  }
  return null;
}

function rewriteImports(code, sourcePath) {
  const rewrite = (specifier) => {
    if (depMap.has(specifier)) return depMap.get(specifier);
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const baseUrl = path.posix.dirname(sourcePath);
      const normalized = specifier.startsWith('/')
        ? specifier
        : path.posix.normalize(path.posix.join(baseUrl, specifier));
      const fsPath = resolveSourcePath(`/src/${normalized.replace(/^\/?src\/?/, '')}`);
      if (!fsPath) return specifier;
      const rel = path.relative(srcRoot, fsPath).split(path.sep).join('/');
      return `/src/${rel}`;
    }
    return specifier;
  };

  return code
    .replace(/(from\s*["'])([^"']+)(["'])/g, (_, prefix, specifier, suffix) => `${prefix}${rewrite(specifier)}${suffix}`)
    .replace(/(import\s*["'])([^"']+)(["'])/g, (_, prefix, specifier, suffix) => `${prefix}${rewrite(specifier)}${suffix}`);
}

async function walk(dir) {
  const entries = await import('node:fs/promises').then(({ readdir }) => readdir(dir, { withFileTypes: true }));
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(abs));
    else if (/\.(js|jsx|json)$/.test(entry.name)) files.push(abs);
  }
  return files;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function transformWithRetry(filePath, rel, attempts = 8) {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(
      esbuildBin,
      [
        filePath,
        '--format=esm',
        '--jsx=automatic',
        '--loader:.js=jsx',
        '--loader:.jsx=jsx',
        '--log-level=warning',
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 },
    );
    if (result.status === 0) return result.stdout;
    lastError = result.stderr || result.error?.message || `Unable to transform ${rel}`;
    sleep(250);
  }
  throw new Error(lastError);
}

function bundleDependencyWithRetry(specifier, outputFile, attempts = 8) {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(
      esbuildBin,
      [
        specifier,
        '--bundle',
        '--format=esm',
        '--platform=browser',
        '--target=es2020',
        '--log-level=warning',
        `--outfile=${outputFile}`,
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 },
    );
    if (result.status === 0) return;
    lastError = result.stderr || result.error?.message || `Unable to bundle dependency ${specifier}`;
    sleep(250);
  }
  throw new Error(lastError);
}

function bundleApplicationWithRetry(outputFile, attempts = 8) {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(
      esbuildBin,
      [
        path.join(srcRoot, 'static-main.jsx'),
        '--bundle',
        '--format=esm',
        '--platform=browser',
        '--target=es2020',
        '--jsx=automatic',
        '--loader:.png=dataurl',
        '--loader:.jpg=dataurl',
        '--loader:.jpeg=dataurl',
        '--loader:.svg=dataurl',
        '--define:import.meta.env={"VITE_API_BASE_URL":""}',
        '--log-level=warning',
        `--outfile=${outputFile}`,
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 },
    );
    if (result.status === 0) return;
    lastError = result.stderr || result.error?.message || 'Unable to bundle the application';
    sleep(250);
  }
  throw new Error(lastError);
}

await rm(outRoot, { recursive: true, force: true });
await mkdir(outRoot, { recursive: true });
bundleApplicationWithRetry(path.join(outRoot, 'app.js'));

console.log(`Built browser application bundle into ${path.join(outRoot, 'app.js')}`);
