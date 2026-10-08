// 실행 중인 Rust 런처의 HTTP 통합 검증. 브라우저를 조작하지 않는다.
import { connect } from 'node:net';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

function request(path, { host = '127.0.0.1:4173', method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = connect(4173, '127.0.0.1', () => socket.write(`${method} ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`));
    socket.setTimeout(10000, () => socket.destroy(new Error('서버 응답 시간 초과')));
    socket.on('error', reject); socket.on('data', chunk => chunks.push(chunk));
    socket.on('end', () => {
      const bytes = Buffer.concat(chunks); const end = bytes.indexOf('\r\n\r\n');
      const header = bytes.subarray(0, end).toString();
      resolve({ status: Number(header.split(' ')[1]), header, body: bytes.subarray(end + 4) });
    });
  });
}
const passed = [];
for (const path of ['/', '/editor.html', '/build-evidence.json']) {
  const response = await request(path);
  assert.equal(response.status, 200); assert.ok(response.body.length > 0);
  assert.match(response.header, /connect-src 'self'/); assert.match(response.header, /frame-ancestors 'self'/);
  passed.push(`GET ${path}`);
}
const head = await request('/', { method: 'HEAD' });
assert.equal(head.status, 200); assert.equal(head.body.length, 0); passed.push('HEAD 본문 없음');
for (const path of ['/../README.md', '/%2e%2e/README.md', '/%5cWindows/win.ini', '/C:/Windows/win.ini', '/%00', '/%FF']) {
  assert.equal((await request(path)).status, 404); passed.push(`경로 거부 ${path}`);
}
assert.equal((await request('/', { host: 'untrusted.invalid' })).status, 404); passed.push('외부 Host 거부');
assert.equal((await request('/', { method: 'POST' })).status, 404); passed.push('쓰기 요청 거부');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../editor/dist');
const wasm = (await readdir(resolve(root, 'assets'))).find(name => /^rhwp_bg.*\.wasm$/.test(name));
assert.ok(wasm);
const binary = await request(`/assets/${wasm}`);
assert.equal(binary.status, 200); assert.match(binary.header, /Content-Type: application\/wasm/);
assert.equal(createHash('sha256').update(binary.body).digest('hex'), createHash('sha256').update(await readFile(resolve(root, 'assets', wasm))).digest('hex'));
passed.push('WASM MIME 및 바이트 무결성');
console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
