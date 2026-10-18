import type {HistoryRecords, HistoryScope, HistoryOwner, HistoryMeta} from '../ports/history.ts';

const MAX_ENTRY = 8 * 1024 * 1024, MAX_CATALOG = 32 * 1024 * 1024;
const encode = (value: unknown): string => JSON.stringify(value);
const size = (value: unknown): number => new TextEncoder().encode(encode(value)).length;
const bad = () => Error('문서 이력의 범위·내용·무결성을 확인하지 못했습니다. 기존 이력은 변경하지 않았습니다.');
const stale = () => Error('문서나 이력 목록이 변경되었습니다. 이력 창을 닫고 다시 여세요.');
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
const int = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const keys = (value: object, expected: string): boolean => Object.keys(value).sort().join(',') === expected;
const plain = (value: unknown): boolean => Boolean(value && typeof value==='object' && !Array.isArray(value)
  && [Object.prototype,null].includes(Object.getPrototypeOf(value)) && Reflect.ownKeys(value).length===Object.keys(value).length
  && Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>'value' in d&&d.enumerable));
const dense = (value: unknown): value is unknown[] => Array.isArray(value) && Reflect.ownKeys(value).length===value.length+1
  && Object.keys(value).length===value.length && Object.keys(value).every((key,i)=>key===String(i));
type Entry = {meta: HistoryMeta; snapshot: unknown; digest: string};
type Catalog = {version: 1; scope: string[]; token: string; entries: Entry[]};

export function historyScopeKey(scope: HistoryScope): string {
  if (!plain(scope) || !keys(scope, 'documentId,windowScope,workspaceId') || ![scope.windowScope, scope.workspaceId, scope.documentId].every(v => text(v, 200))) throw bad();
  return encode([scope.windowScope, scope.workspaceId, scope.documentId]);
}
/** Snapshot data stays local. Bounds and the actual compare shape are checked before comparison. */
export function assertHistorySnapshot(value: unknown): void {
  let nodes = 0;
  function visit(v: any, depth: number): void {
    if (++nodes > 200000 || depth > 50) throw bad();
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (!(plain(v)||dense(v))) throw bad();
    Object.values(v).forEach(child => visit(child, depth + 1));
  }
  visit(value, 0);
  const s = value as any;
  const anchor = (a: any): boolean => Boolean(a && typeof a === 'object' && !Array.isArray(a) && int(a.pageIndex)
    && ['x','y','width','height'].every(k => typeof a[k] === 'number' && Number.isFinite(a[k]) && Math.abs(a[k]) <= 10000000)
    && a.width >= 0 && a.height >= 0);
  if (!plain(s) || !plain(s.meta) || !text(s.meta.name, 1024) || !int(s.meta.pageCount) || !int(s.meta.sectionCount)
      || !Array.isArray(s.paragraphs) || s.paragraphs.length > 10000 || !Array.isArray(s.controls) || s.controls.length > 20000) throw bad();
  for (const p of s.paragraphs) if (!p || ![p.section, p.paragraph, p.sectionPage, p.globalIndex, p.controlCount].every(int)
      || typeof p.stableId !== 'string' || typeof p.text !== 'string' || typeof p.normalizedText !== 'string'
      || typeof p.signature !== 'string' || typeof p.isAnchorCandidate !== 'boolean' || (p.anchor !== undefined && !anchor(p.anchor))) throw bad();
  for (const c of s.controls) if (!c || ![c.section, c.paragraph].every(int) || !text(c.key, 1024)
      || !text(c.type, 128) || typeof c.summary !== 'string' || !['text','table','shape','image','chart','paragraphMeta'].includes(c.kind) || !anchor(c.anchor)) throw bad();
  if (size(value) > MAX_ENTRY) throw Error('이력 한 개의 최대 크기 8MiB를 넘었습니다. 문서를 파일로 저장해 보관하세요.');
}

export function createDocumentHistory(options: {scope: HistoryScope; owner: () => HistoryOwner; records: HistoryRecords;
  digest: (value: unknown) => string; nextId?: () => string; now?: () => number}) {
  const key = historyScopeKey(options.scope), scope = JSON.parse(key) as string[], initial = {...options.owner()};
  const next = options.nextId ?? (() => crypto.randomUUID()), now = options.now ?? Date.now;
  const assertCurrent = () => {const current = options.owner(); if (!initial.available || !current.available || !text(initial.instance, 300)
    || !text(initial.revision, 300) || current.instance !== initial.instance || current.revision !== initial.revision) throw stale();};
  assertCurrent();
  let viewed: string | null | undefined;
  const fingerprint = (entry: Omit<Entry, 'digest'>) => options.digest([1, scope, entry.meta, entry.snapshot]);
  function validate(raw: unknown): Catalog | null {
    if (raw == null) return null;
    if (!plain(raw) || size(raw) > MAX_CATALOG) throw bad();
    const c = raw as Catalog;
    if (!keys(c, 'entries,scope,token,version') || c.version !== 1 || !dense(c.scope) || encode(c.scope) !== key || !text(c.token, 200)
        || !dense(c.entries) || c.entries.length > 24) throw bad();
    const ids = new Set<string>();
    for (const e of c.entries) {
      if (!plain(e) || !keys(e, 'digest,meta,snapshot') || !plain(e.meta) || !keys(e.meta, 'byteLength,createdAt,id,label,sourceFileName,storageKind')) throw bad();
      const m = e.meta;
      if (!text(m.id, 200) || ids.has(m.id) || !text(m.label, 512) || !text(m.sourceFileName, 1024) || !int(m.createdAt)
          || m.storageKind !== 'ir' || !int(m.byteLength) || typeof e.digest !== 'string' || !/^[0-9a-f]{64}$/.test(e.digest)) throw bad();
      ids.add(m.id); assertHistorySnapshot(e.snapshot);
      if (m.byteLength !== size(e.snapshot) || e.digest !== fingerprint(e)) throw bad();
    }
    return c;
  }
  async function read() {assertCurrent(); const raw = await options.records.read(key); assertCurrent(); return {raw, catalog: validate(raw)};}
  function assertViewed(c: Catalog | null) {if (viewed === undefined || viewed !== (c?.token ?? null)) throw stale();}
  async function write(raw: unknown, value: Catalog | null) {
    if (value) validate(value);
    assertCurrent(); await options.records.exchange(key, raw, value, assertCurrent); assertCurrent(); viewed = value?.token ?? null;
  }
  return {
    assertCurrent,
    async list(): Promise<HistoryMeta[]> {const {catalog} = await read(); viewed = catalog?.token ?? null;
      return structuredClone((catalog?.entries ?? []).map(e => e.meta).sort((a,b) => b.createdAt-a.createdAt || a.id.localeCompare(b.id)));},
    async get(id: string): Promise<unknown | null> {const {catalog} = await read(); assertViewed(catalog);
      const entry = catalog?.entries.find(e => e.meta.id === id); return entry ? structuredClone(entry.snapshot) : null;},
    async save(label: string, sourceFileName: string, snapshot: unknown): Promise<HistoryMeta> {
      assertCurrent(); assertHistorySnapshot(snapshot);
      const stamp = now(), id = next(); if (!int(stamp) || !text(id, 200) || !text(sourceFileName, 1024) || typeof label !== 'string' || label.length > 512) throw bad();
      const meta: HistoryMeta = {id, label: label.trim() || `스냅샷 ${new Date(stamp).toLocaleString('ko-KR')}`, sourceFileName, createdAt: stamp, byteLength: size(snapshot), storageKind: 'ir'};
      const entry: Entry = {meta, snapshot: structuredClone(snapshot), digest: fingerprint({meta, snapshot})};
      const {raw, catalog} = await read(); if (catalog?.entries.some(e => e.meta.id === id)) throw stale();
      const value: Catalog = {version: 1, scope: [...scope], token: next(), entries: [...(catalog?.entries ?? []), entry].sort((a,b) => a.meta.createdAt-b.meta.createdAt || a.meta.id.localeCompare(b.meta.id))};
      while (value.entries.length > 24 || size(value) > MAX_CATALOG) value.entries.shift();
      if (!value.entries.some(e => e.meta.id === id)) throw bad();
      await write(raw, value); return structuredClone(meta);
    },
    async remove(id: string): Promise<void> {const {raw, catalog} = await read(); assertViewed(catalog);
      if (!catalog || !catalog.entries.some(e => e.meta.id === id)) throw stale();
      await write(raw, {...catalog, token: next(), entries: catalog.entries.filter(e => e.meta.id !== id)});},
    async clear(): Promise<void> {const {raw, catalog} = await read(); assertViewed(catalog); await write(raw, null);},
  };
}
