import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/u.test(value);
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const term = value => typeof value === 'string' && /^[\p{L}\p{M}\p{N}]{1,80}$/u.test(value);
const invalid = message => Object.assign(new Error(message), { safeMessage: message });

export async function createReferenceIndex(path) {
  const { DatabaseSync } = await import('node:sqlite');
  if (path !== ':memory:') await mkdir(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout = 2000; PRAGMA secure_delete = ON;');
    db.exec('CREATE TABLE IF NOT EXISTS scopes (scope TEXT PRIMARY KEY, workspace TEXT NOT NULL, updated INTEGER NOT NULL)');
  } catch (error) { db.close(); throw error; }
  const tableName = scope => {
    if (!digest(scope)) throw new Error('Invalid index table');
    return `fts_${scope}`;
  };
  const transaction = action => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = action(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  function drop(scope) {
    db.exec(`DROP TABLE IF EXISTS ${tableName(scope)}`);
    db.prepare('DELETE FROM scopes WHERE scope = ?').run(scope);
  }
  function clear(input) {
    if (!id(input?.workspaceId) || (input.chatId !== undefined && !id(input.chatId))) throw invalid('검색 업무나 채팅 범위가 올바르지 않습니다.');
    transaction(() => {
      if (input.chatId !== undefined) drop(hash(JSON.stringify([input.workspaceId, input.chatId])));
      else for (const row of db.prepare('SELECT scope FROM scopes WHERE workspace = ?').all(hash(input.workspaceId))) drop(row.scope);
    });
    return { cleared: true };
  }
  function updateAndSearch(input) {
    const { workspaceId, chatId, chunks, query } = input ?? {};
    if (!id(workspaceId) || !id(chatId) || !Array.isArray(chunks) || chunks.length > 280
        || !Array.isArray(query) || query.length > 160 || !query.every(term)) throw invalid('선택 자료 색인 요청이 올바르지 않습니다.');
    const authorized = new Map();
    let totalTerms = 0;
    for (const chunk of chunks) {
      if (!chunk || !digest(chunk.id) || authorized.has(chunk.id) || !Array.isArray(chunk.title) || !Array.isArray(chunk.body)
          || chunk.title.length > 250 || chunk.body.length > 1800 || !chunk.title.every(term) || !chunk.body.every(term)) {
        throw invalid('선택한 자료의 검색 색인 형식이 올바르지 않습니다.');
      }
      totalTerms += chunk.title.length + chunk.body.length;
      authorized.set(chunk.id, chunk);
    }
    if (totalTerms > 150_000) throw invalid('선택 자료 검색 색인 한도를 넘었습니다.');
    const scope = hash(JSON.stringify([workspaceId, chatId]));
    const table = tableName(scope);
    const tokens = values => values.map(value => 't' + hash(scope + ':' + value)).join(' ');
    return transaction(() => {
      if (authorized.size === 0) { drop(scope); return { hits: [], inserted: 0, deleted: 0 }; }
      if (!db.prepare('SELECT 1 FROM scopes WHERE scope = ?').get(scope)) {
        db.exec(`CREATE VIRTUAL TABLE ${table} USING fts5(chunk UNINDEXED, title, body)`);
        db.exec(`INSERT INTO ${table} (${table}, rank) VALUES ('secure-delete', 1)`);
      }
      const now = Date.now();
      db.prepare('INSERT INTO scopes VALUES (?, ?, ?) ON CONFLICT(scope) DO UPDATE SET updated=excluded.updated').run(scope, hash(workspaceId), now);
      for (const row of db.prepare('SELECT scope FROM scopes WHERE scope <> ? AND updated < ?').all(scope, now - 7 * 86_400_000)) drop(row.scope);
      for (const row of db.prepare('SELECT scope FROM scopes WHERE scope <> ? ORDER BY updated DESC LIMIT -1 OFFSET 31').all(scope)) drop(row.scope);
      const existing = new Set(db.prepare(`SELECT chunk FROM ${table}`).all().map(row => row.chunk));
      const remove = db.prepare(`DELETE FROM ${table} WHERE chunk = ?`);
      const insert = db.prepare(`INSERT INTO ${table} (chunk, title, body) VALUES (?, ?, ?)`);
      let inserted = 0;
      let deleted = 0;
      for (const key of existing) if (!authorized.has(key)) { remove.run(key); deleted++; }
      for (const [key, value] of authorized) if (!existing.has(key)) { insert.run(key, tokens(value.title), tokens(value.body)); inserted++; }
      const expression = tokens([...new Set(query)]).replace(/ /gu, ' OR ');
      const hits = expression ? db.prepare(`SELECT chunk AS id, -bm25(${table}, 0, 2, 1) AS score FROM ${table} WHERE ${table} MATCH ? ORDER BY score DESC, chunk LIMIT 280`).all(expression) : [];
      if (hits.some(hit => !authorized.has(hit.id))) throw new Error('Index returned an unselected reference');
      return { hits, inserted, deleted };
    });
  }
  return { updateAndSearch, clear, close: () => db.close() };
}
