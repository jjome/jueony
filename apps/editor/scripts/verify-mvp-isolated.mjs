import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const origin = 'http://127.0.0.1:4202';
if (await fetch(origin + '/api/health').then(() => true, () => false)) throw new Error('Isolated port is in use');
const server = spawn(process.execPath, ['apps/launcher/server.mjs'], { cwd: root, windowsHide: true, env: { ...process.env, JUEONY_PORT: '4202', JUEONY_DIST: process.env.JUEONY_TEST_DIST ?? join(root, 'apps/editor/dist'), JUEONY_CONNECTION_STORE: 'memory' }, stdio: 'ignore' });
try {
 let ready = false;
 for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error('Server failed'); if (await fetch(origin + '/api/health').then(r => r.ok, () => false)) { ready = true; break; } await new Promise(r => setTimeout(r, 100)); }
 if (!ready) throw new Error('Server did not become ready');
 const child = spawn(process.execPath, ['scripts/verify-mvp.mjs'], { cwd: join(root, 'apps/editor'), windowsHide: true, env: { ...process.env, JUEONY_TEST_URL: origin + '/' }, stdio: 'inherit' });
 process.exitCode = (await once(child, 'exit'))[0] ?? 1;
} finally { server.kill(); }
