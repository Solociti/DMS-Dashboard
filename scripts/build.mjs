import { spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const clientOutDir = path.join(rootDir, 'public', 'dist');

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

await rm(buildDir, { force: true, recursive: true });
await rm(clientOutDir, { force: true, recursive: true });
await mkdir(path.join(clientOutDir, 'assets'), { recursive: true });

await build({
  entryPoints: {
    app: path.join(rootDir, 'client', 'dashboard', 'main.tsx'),
    login: path.join(rootDir, 'client', 'login', 'main.tsx')
  },
  bundle: true,
  format: 'esm',
  splitting: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  outdir: path.join(clientOutDir, 'assets'),
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  tsconfig: path.join(rootDir, 'client', 'tsconfig.json'),
  platform: 'browser',
  target: ['es2020']
});

await cp(path.join(rootDir, 'client', 'index.html'), path.join(clientOutDir, 'index.html'));
await cp(path.join(rootDir, 'client', 'login.html'), path.join(clientOutDir, 'login.html'));
await cp(path.join(rootDir, 'client', 'styles.css'), path.join(clientOutDir, 'styles.css'));

await run(path.join(rootDir, 'node_modules', '.bin', 'ncc'), [
  'build',
  path.join('server', 'src', 'index.ts'),
  '-o',
  path.join('build', 'server')
]);
