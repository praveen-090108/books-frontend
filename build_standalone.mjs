import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, 'standalone');
const assetsDir = path.join(outDir, 'assets');
const esbuildCandidates = [
  path.join(root, 'node_modules/.pnpm/esbuild@0.21.5/node_modules/esbuild/bin/esbuild'),
  path.join(root, 'node_modules/.pnpm/node_modules/.bin/esbuild'),
  path.join(root, 'node_modules/.bin/esbuild'),
];
const esbuildBin = esbuildCandidates.find((candidate) => existsSync(candidate));

if (!esbuildBin) {
  throw new Error('Unable to find esbuild. Run pnpm install inside frontend first.');
}

await rm(outDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

const result = spawnSync(
  esbuildBin,
  [
    path.join(root, 'src/standalone-main.jsx'),
    '--bundle',
    '--format=iife',
    '--global-name=IntelliaTechBooks',
    '--platform=browser',
    '--target=es2020',
    '--loader:.js=jsx',
    '--loader:.jsx=jsx',
    '--loader:.png=file',
    '--loader:.jpg=file',
    '--loader:.jpeg=file',
    '--loader:.svg=file',
    '--loader:.webp=file',
    '--loader:.css=css',
    '--entry-names=app',
    '--asset-names=assets/[name]-[hash]',
    '--define:import.meta.env={}',
    `--outdir=${assetsDir}`,
    '--log-level=warning',
  ],
  { cwd: root, encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 },
);

if (result.status !== 0) {
  throw new Error(result.stderr || result.error?.message || 'Unable to build standalone UI.');
}

const files = await readdir(assetsDir);
const jsFile = files.find((file) => /^app.*\.js$/.test(file));
const cssFile = files.find((file) => /^app.*\.css$/.test(file));

if (!jsFile) {
  throw new Error('Standalone build did not create an app JavaScript file.');
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IntelliaTech Books</title>
    ${cssFile ? `<link rel="stylesheet" href="./assets/${cssFile}" />` : ''}
  </head>
  <body>
    <div id="root"></div>
    <script src="./assets/${jsFile}"></script>
  </body>
</html>
`;

await writeFile(path.join(outDir, 'index.html'), html);
console.log(`Built standalone UI: ${path.join(outDir, 'index.html')}`);
