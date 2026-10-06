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
  entryPoints: {
    app: path.join(rootDir, 'client', 'dashboard', 'main.tsx'),
    login: path.join(rootDir, 'client', 'login', 'main.tsx')
  },
  bundle: true,
  format: 'esm',
  splitting: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  outdir: path.join(clientOutDir, 'assets'),
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  tsconfig: path.join(rootDir, 'client', 'tsconfig.json'),
  platform: 'browser',
  sourcemap: true,
  target: ['es2020']
});

await ctx.watch();
console.log('[dev-client] watching client/ for changes...');
