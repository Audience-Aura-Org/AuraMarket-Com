import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const disabledRoot = join(root, '.capacitor-disabled-routes');
const routes = [
  ['app/api', '.capacitor-disabled-routes/api'],
  ['app/uploads', '.capacitor-disabled-routes/uploads'],
  ['app/admin', '.capacitor-disabled-routes/admin'],
  ['public/downloads/Auradime.apk', '.capacitor-disabled-routes/Auradime.apk'],
];

const moveIfExists = (from, to) => {
  const absFrom = join(root, from);
  const absTo = join(root, to);
  if (!existsSync(absFrom)) return false;
  mkdirSync(dirname(absTo), { recursive: true });
  if (existsSync(absTo)) rmSync(absTo, { recursive: true, force: true });
  // Use copy+delete instead of rename — Windows file watchers (e.g. VS Code)
  // hold directory handles that block MoveFile (rename) but not copy/delete.
  cpSync(absFrom, absTo, { recursive: true });
  rmSync(absFrom, { recursive: true, force: true });
  return true;
};

const restoreIfExists = (from, to) => {
  const absFrom = join(root, from);
  const absTo = join(root, to);
  if (!existsSync(absFrom)) return;
  mkdirSync(dirname(absTo), { recursive: true });
  if (existsSync(absTo)) rmSync(absTo, { recursive: true, force: true });
  cpSync(absFrom, absTo, { recursive: true });
  rmSync(absFrom, { recursive: true, force: true });
};

const moved = [];
const assertNoAdminExport = () => {
  const adminOut = join(root, 'out', 'admin');
  if (existsSync(adminOut)) {
    throw new Error('Capacitor build blocked: /admin routes were exported into the mobile bundle.');
  }
};

const readLocalEnv = () => {
  const envPath = join(root, '.env.local');
  if (!existsSync(envPath)) return {};

  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
      })
  );
};

const localEnv = readLocalEnv();
const insecureMobileEnv = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SOCKET_URL',
  'NEXT_PUBLIC_BACKEND_URL',
].filter((key) => /^http:\/\//i.test(process.env[key] || localEnv[key] || ''));

if (insecureMobileEnv.length > 0) {
  console.error(
    `Capacitor builds require HTTPS endpoints because Android cleartext traffic is disabled: ${insecureMobileEnv.join(', ')}`
  );
  process.exit(1);
}

try {
  for (const [source, target] of routes) {
    if (moveIfExists(source, target)) moved.push([target, source]);
  }

  const result = spawnSync('npx next build', {
    cwd: root,
    env: {
      ...process.env,
      CAPACITOR_BUILD: 'true',
      NODE_OPTIONS: '--max-old-space-size=4096',
    },
    stdio: 'inherit',
    shell: true,
  });

  if (result.error) {
    console.error(result.error);
  }
  if (result.status !== 0) process.exitCode = result.status || 1;
  if (result.status === 0) assertNoAdminExport();
} finally {
  for (const [source, target] of moved.reverse()) {
    restoreIfExists(source, target);
  }
  if (existsSync(disabledRoot)) rmSync(disabledRoot, { recursive: true, force: true });
}
