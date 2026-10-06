import { cp, mkdir, rm } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { context } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientOutDir = path.join(rootDir, 'public', 'dist');

async function copyStaticAssets() {
  await cp(path.join(rootDir, 'client', 'index.html'), path.join(clientOutDir, 'index.html'));
  await cp(path.join(rootDir, 'client', 'login.html'), path.join(clientOutDir, 'login.html'));
  await cp(path.join(rootDir, 'client', 'styles.css'), path.join(clientOutDir, 'styles.css'));
}

await rm(clientOutDir, { force: true, recursive: true });
await mkdir(path.join(clientOutDir, 'assets'), { recursive: true });
await copyStaticAssets();

for (const file of ['index.html', 'login.html', 'styles.css']) {
  watch(path.join(rootDir, 'client', file), () => {
    copyStaticAssets().catch((error) => console.error(error));
  });
}

const ctx = await context({
  entryPoints: [path.join(rootDir, 'client', 'main.ts')],
  bundle: true,
  format: 'iife',
  outfile: path.join(clientOutDir, 'assets', 'app.js'),
  platform: 'browser',
  sourcemap: true,
  target: ['es2020']
});

const loginCtx = await context({
  entryPoints: [path.join(rootDir, 'client', 'login.ts')],
  bundle: true,
  format: 'iife',
  outfile: path.join(clientOutDir, 'assets', 'login.js'),
  platform: 'browser',
  sourcemap: true,
  target: ['es2020']
});

await Promise.all([ctx.watch(), loginCtx.watch()]);
console.log('[dev-client] watching client/ for changes...');
