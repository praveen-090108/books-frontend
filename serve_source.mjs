import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(root, 'src');
const sourceCacheRoot = process.env.SOURCE_CACHE_DIR || '/private/tmp/intelliatech-source-cache';
const publicRoot = path.join(root, 'dist');
const assetsRoot = path.join(publicRoot, 'assets');
const depRoot = process.env.SOURCE_DEPS_DIR || path.join(root, '.source-deps');
const initialPort = Number(process.env.PORT || 5173);
const maxPort = Number(process.env.MAX_PORT || initialPort + 10);
let activePort = initialPort;
const host = process.env.HOST || '127.0.0.1';
const backendTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080';
const shouldOpenBrowser = process.env.OPEN_BROWSER !== '0';
let browserOpened = false;

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

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.jsx', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function contentType(filePath) {
  return mimeTypes.get(path.extname(filePath)) || 'application/octet-stream';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function safeJoin(base, requestPath) {
  const cleanPath = decodeURIComponent(requestPath).replace(/^\/+/, '');
  const resolved = path.resolve(base, cleanPath);
  if (!resolved.startsWith(path.resolve(base))) return null;
  return resolved;
}

function resolveSourcePath(requestPath) {
  const direct = safeJoin(srcRoot, requestPath.replace(/^\/src\/?/, ''));
  if (!direct) return null;
  if (existsSync(direct)) return direct;
  for (const ext of ['.jsx', '.js', '.json']) {
    if (existsSync(`${direct}${ext}`)) return `${direct}${ext}`;
  }
  return null;
}

function indexHtml() {
  const cssFile = existsSync(assetsRoot)
    ? requireReadDir(assetsRoot).find((file) => file.startsWith('index-') && file.endsWith('.css'))
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IntelliaTech Books</title>
    ${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}" />` : ''}
    <link rel="stylesheet" href="/tailwind.css" />
    <link rel="stylesheet" href="/source-styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script>
      (() => {
        const showStartupError = (reason) => {
          const root = document.getElementById('root');
          if (!root || root.childElementCount > 0) return;
          const message = reason instanceof Error ? reason.message : String(reason || 'Unknown startup error');
          root.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#06134a">' +
            '<section style="width:min(620px,100%);border:1px solid #fecaca;border-radius:8px;background:#fff;padding:24px;box-shadow:0 12px 30px rgba(15,23,42,.08)">' +
            '<h1 style="margin:0;font-size:20px">IntelliaTech Books could not start</h1>' +
            '<p style="margin:10px 0 0;color:#475569;font-size:14px">Refresh the page. If the problem continues, share this message:</p>' +
            '<pre style="margin:16px 0 0;overflow:auto;border-radius:6px;background:#fff1f2;padding:12px;color:#b91c1c;font-size:12px;white-space:pre-wrap"></pre>' +
            '</section></main>';
          root.querySelector('pre').textContent = message;
        };
        window.addEventListener('error', (event) => showStartupError(event.error || event.message));
        window.addEventListener('unhandledrejection', (event) => showStartupError(event.reason));
        window.setTimeout(() => showStartupError('The application did not render within 10 seconds.'), 10000);
      })();
    </script>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}

function shimModule(pathname) {
  const shims = {
    '/@shim/react.js': `import React from "/@deps/react.js";
export default React;
export const Children = React.Children;
export const Component = React.Component;
export const Fragment = React.Fragment;
export const Profiler = React.Profiler;
export const PureComponent = React.PureComponent;
export const StrictMode = React.StrictMode;
export const Suspense = React.Suspense;
export const cloneElement = React.cloneElement;
export const createContext = React.createContext;
export const createElement = React.createElement;
export const createFactory = React.createFactory;
export const createRef = React.createRef;
export const forwardRef = React.forwardRef;
export const isValidElement = React.isValidElement;
export const lazy = React.lazy;
export const memo = React.memo;
export const startTransition = React.startTransition;
export const useCallback = React.useCallback;
export const useContext = React.useContext;
export const useDebugValue = React.useDebugValue;
export const useDeferredValue = React.useDeferredValue;
export const useEffect = React.useEffect;
export const useId = React.useId;
export const useImperativeHandle = React.useImperativeHandle;
export const useInsertionEffect = React.useInsertionEffect;
export const useLayoutEffect = React.useLayoutEffect;
export const useMemo = React.useMemo;
export const useReducer = React.useReducer;
export const useRef = React.useRef;
export const useState = React.useState;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useTransition = React.useTransition;
export const version = React.version;`,
    '/@shim/react-dom-client.js': `import ReactDOMClient from "/@deps/react-dom_client.js";
export default ReactDOMClient;
export const createRoot = ReactDOMClient.createRoot;
export const hydrateRoot = ReactDOMClient.hydrateRoot;`,
    '/@shim/react-jsx-runtime.js': `import runtime from "/@deps/react_jsx-runtime.js";
export default runtime;
export const Fragment = runtime.Fragment;
export const jsx = runtime.jsx;
export const jsxs = runtime.jsxs;`,
    '/@shim/react-jsx-dev-runtime.js': `import runtime from "/@deps/react_jsx-dev-runtime.js";
export default runtime;
export const Fragment = runtime.Fragment;
export const jsxDEV = runtime.jsxDEV;`,
  };
  return shims[pathname] || null;
}

function assetModuleFor(sourcePath) {
  const ext = path.extname(sourcePath);
  if (ext === '.css') return 'export default "";';
  if (!['.png', '.jpg', '.jpeg', '.svg', '.webp'].includes(ext)) return null;
  const assetName = path.basename(sourcePath, ext);
  const builtAsset = existsSync(assetsRoot)
    ? requireAssetFile(assetName, ext)
    : '';
  const url = builtAsset ? `/assets/${builtAsset}` : `/src-asset/${path.relative(srcRoot, sourcePath).split(path.sep).join('/')}`;
  return `export default ${JSON.stringify(url)};`;
}

function requireAssetFile(assetName, ext) {
  try {
    const files = requireReadDir(assetsRoot);
    return files.find((file) => file.startsWith(assetName) && path.extname(file) === ext) || '';
  } catch {
    return '';
  }
}

function requireReadDir(dir) {
  return readdirSync(dir);
}

async function serveFile(res, filePath) {
  try {
    const file = await readFile(filePath);
    send(res, 200, file, { 'Content-Type': contentType(filePath) });
  } catch {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

async function proxyApi(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  const upstream = await fetch(new URL(req.url || '/api', backendTarget), {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    redirect: 'manual',
  });
  const responseHeaders = Object.fromEntries(upstream.headers.entries());
  delete responseHeaders['content-encoding'];
  delete responseHeaders['transfer-encoding'];
  const responseBody = Buffer.from(await upstream.arrayBuffer());
  responseHeaders['content-length'] = String(responseBody.length);
  res.writeHead(upstream.status, responseHeaders);
  res.end(responseBody);
}

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${host}:${activePort}`);
    const pathname = requestUrl.pathname;

    if (
      pathname === '/api'
      || pathname.startsWith('/api/')
      || pathname.startsWith('/branding-assets/')
    ) {
      return await proxyApi(req, res);
    }

    if (pathname === '/health') {
      return send(res, 200, JSON.stringify({
        ok: true,
        host,
        port: activePort,
        sourceCacheRoot,
        depRoot,
        backendTarget,
      }, null, 2), { 'Content-Type': 'application/json; charset=utf-8' });
    }

    if (pathname === '/app.js') {
      const bundlePath = safeJoin(sourceCacheRoot, 'app.js');
      if (!bundlePath || !existsSync(bundlePath)) {
        return send(res, 500, 'Application bundle is missing. Run: node frontend/build_source_cache.mjs', {
          'Content-Type': 'text/plain; charset=utf-8',
        });
      }
      return serveFile(res, bundlePath);
    }

    if (pathname === '/tailwind.css') {
      return serveFile(res, path.join(srcRoot, 'tailwind.generated.css'));
    }

    if (pathname === '/source-styles.css') {
      return serveFile(res, path.join(srcRoot, 'styles.css'));
    }

    if (pathname.startsWith('/@shim/')) {
      const shim = shimModule(pathname);
      if (!shim) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return send(res, 200, shim, { 'Content-Type': 'text/javascript; charset=utf-8' });
    }

    if (pathname.startsWith('/@deps/')) {
      const depPath = safeJoin(depRoot, pathname.replace(/^\/@deps\/?/, ''));
      if (!depPath) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
      return serveFile(res, depPath);
    }

    if (pathname.startsWith('/assets/')) {
      const assetPath = safeJoin(assetsRoot, pathname.replace(/^\/assets\/?/, ''));
      if (!assetPath) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
      return serveFile(res, assetPath);
    }

    if (pathname.startsWith('/src-asset/')) {
      const assetPath = safeJoin(srcRoot, pathname.replace(/^\/src-asset\/?/, ''));
      if (!assetPath) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
      return serveFile(res, assetPath);
    }

    if (pathname.startsWith('/src/')) {
      const sourcePath = resolveSourcePath(pathname);
      if (!sourcePath) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      const assetModule = assetModuleFor(sourcePath);
      if (assetModule !== null) return send(res, 200, assetModule, { 'Content-Type': 'text/javascript; charset=utf-8' });
      const rel = path.relative(srcRoot, sourcePath).split(path.sep).join('/');
      const cachedPath = safeJoin(sourceCacheRoot, rel);
      if (!cachedPath || !existsSync(cachedPath)) {
        return send(res, 500, `Source cache is missing ${rel}. Run: node frontend/build_source_cache.mjs`, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      return serveFile(res, cachedPath);
    }

    return send(res, 200, indexHtml(), { 'Content-Type': 'text/html; charset=utf-8' });
  } catch (error) {
    console.error(error);
    return send(res, 500, error.message || 'Server error', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    if (!process.env.PORT && activePort < maxPort) {
      activePort += 1;
      console.warn(`Port ${activePort - 1} is already in use. Trying http://${host}:${activePort} ...`);
      server.listen(activePort, host);
      return;
    }
    console.error(`Ports ${initialPort}-${activePort} are already in use. From the project root, start on another port with: PORT=${activePort + 1} ./start-frontend.sh`);
  } else if (error.code === 'EPERM') {
    console.error(`Permission denied while starting http://${host}:${activePort}. Run ./start-frontend.sh from your normal macOS Terminal.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(activePort, host, () => {
  const url = `http://${host}:${activePort}`;
  console.log('');
  console.log('IntelliaTech Books UI is running.');
  console.log(`Open:   ${url}`);
  console.log(`Health: ${url}/health`);
  console.log('');

  if (shouldOpenBrowser && !browserOpened && process.platform === 'darwin') {
    browserOpened = true;
    const opener = spawn('open', [url], { detached: true, stdio: 'ignore' });
    opener.unref();
  }
});
