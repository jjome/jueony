import type {PreferenceScope, PreferenceStorage} from '../modules/preferences/public/index.ts';
import {
  startPreferenceRuntimeN017,
  type PreferenceRuntimeFacadeN017,
  type PreferenceRuntimeKeyN017,
  type PreferenceRuntimeReadN017,
  type PreferenceRuntimeScopeN017,
  type PreferenceRuntimeStartupN017,
} from './preference-runtime-n017.ts';

export type PreferenceBootScopeN017 = Readonly<{
  origin: string;
  profileId: string;
}>;

export type PreferenceBootReadRequestN017 = Readonly<{
  scope: PreferenceBootScopeN017;
  key: PreferenceRuntimeKeyN017;
}>;

export type PreferenceBootReadResultN017 =
  | Readonly<{status: 'found'; value: string}>
  | Readonly<{status: 'missing'}>
  | Readonly<{status: 'read-error'}>;

/** Read-only host port. There is intentionally no write/remove capability. */
export type PreferenceBootStoragePortN017 = Readonly<{
  read(request: PreferenceBootReadRequestN017): PreferenceBootReadResultN017;
}>;

export type PreferenceBootUnknownReadN017 = Readonly<{
  status: 'blocked';
  reason: 'unknown-key' | 'scope-mismatch' | 'startup-blocked';
}>;

export type PreferenceBootFacadeN017 = Readonly<{
  read<Key extends PreferenceRuntimeKeyN017>(
    key: Key,
    scope: PreferenceRuntimeScopeN017<Key>,
  ): PreferenceRuntimeReadN017<Key> | PreferenceBootUnknownReadN017;
  /** Untyped callers (plugins/legacy JS) still fail closed instead of throwing. */
  readUnknown(key: unknown, scope: unknown): PreferenceBootUnknownReadN017 | PreferenceRuntimeReadN017<PreferenceRuntimeKeyN017>;
  inspect(): ReturnType<PreferenceRuntimeFacadeN017['inspect']>;
}>;

export type PreferenceBootResultN017 = Readonly<{
  schema: 'n017-preference-bootstrap-v1';
  status: 'ready' | 'degraded' | 'blocked';
  reason: 'ready' | 'defaults-in-memory' | 'diagnostic-blocked' | 'invalid-scope' | 'startup-gate-failed';
  scope: PreferenceBootScopeN017 | null;
  preferences: PreferenceBootFacadeN017;
  storageWritesAllowed: false;
  rawStorageExposed: false;
}>;

export type PreferenceBootPortsN017 = Readonly<{
  scope: PreferenceBootScopeN017;
  storage: PreferenceBootStoragePortN017;
  /** Injectable only for composition verification; production omits it. */
  start?: (storage: Pick<PreferenceStorage, 'getItem'>) => PreferenceRuntimeStartupN017;
}>;

const keys = Object.freeze([
  'rhwp-settings',
  'jueony-document-defaults',
  'jueony-editor-chrome-v1',
  'jueony-style-panel',
  'jueony-recent-fonts-v1',
  'jueony-calendar-format',
  'jueony-common-snippets',
  'jueony-document-view-journal-v1',
] as const satisfies readonly PreferenceRuntimeKeyN017[]);

const keySet = new Set<string>(keys);
const emptyProjection = Object.freeze({
  user: Object.freeze({activeKeys: Object.freeze([]), blockedKeys: Object.freeze([])}),
  workspace: Object.freeze({activeKeys: Object.freeze([]), blockedKeys: Object.freeze([])}),
  document: Object.freeze({activeKeys: Object.freeze([]), blockedKeys: Object.freeze([])}),
});

function validOrigin(origin: unknown): origin is string {
  if (typeof origin !== 'string' || origin.length < 4 || origin.length > 500 || /[\s\\]/u.test(origin)) return false;
  try {
    const url = new URL(origin);
    if (!/^[a-z][a-z0-9+.-]*:$/iu.test(url.protocol) || !url.hostname || url.username || url.password) return false;
    return (url.pathname === '' || url.pathname === '/') && url.search === '' && url.hash === '';
  } catch { return false; }
}

function validProfile(profileId: unknown): profileId is string {
  return typeof profileId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(profileId);
}

function validKey(key: unknown): key is PreferenceRuntimeKeyN017 {
  return typeof key === 'string' && keySet.has(key);
}

function validScopeForKey(key: PreferenceRuntimeKeyN017, scope: unknown): scope is PreferenceScope {
  if (scope !== 'user' && scope !== 'workspace' && scope !== 'document') return false;
  return key === 'jueony-document-view-journal-v1' ? scope !== 'user' : scope === 'user';
}

function blockedFacade(): PreferenceBootFacadeN017 {
  const blocked = Object.freeze({status: 'blocked' as const, reason: 'startup-blocked' as const});
  return Object.freeze({
    read: () => blocked,
    readUnknown: () => blocked,
    inspect: () => structuredClone(emptyProjection),
  });
}

function blocked(reason: 'invalid-scope' | 'startup-gate-failed'): PreferenceBootResultN017 {
  return Object.freeze({
    schema: 'n017-preference-bootstrap-v1',
    status: 'blocked',
    reason,
    scope: null,
    preferences: blockedFacade(),
    storageWritesAllowed: false,
    rawStorageExposed: false,
  });
}

function validRuntime(runtime: unknown): runtime is PreferenceRuntimeStartupN017 {
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) return false;
  const value = runtime as PreferenceRuntimeStartupN017;
  if (!value.startup || value.startup.schema !== 'n017-startup-gate-v1' || value.startup.activation !== 'applied') return false;
  if (!['ready', 'defaults-in-memory', 'diagnostic-blocked'].includes(value.startup.reason)) return false;
  if (value.startup.storageWritesAllowed !== false || value.startup.rawValuesExposed !== false) return false;
  return Boolean(value.preferences && typeof value.preferences.read === 'function' && typeof value.preferences.inspect === 'function');
}

function facade(runtime: PreferenceRuntimeFacadeN017): PreferenceBootFacadeN017 {
  const readUnknown = (key: unknown, scope: unknown) => {
    if (!validKey(key)) return Object.freeze({status: 'blocked' as const, reason: 'unknown-key' as const});
    if (!validScopeForKey(key, scope)) return Object.freeze({status: 'blocked' as const, reason: 'scope-mismatch' as const});
    return runtime.read(key, scope as never) as PreferenceRuntimeReadN017<PreferenceRuntimeKeyN017>;
  };
  return Object.freeze({
    read<Key extends PreferenceRuntimeKeyN017>(key: Key, scope: PreferenceRuntimeScopeN017<Key>) {
      return readUnknown(key, scope) as PreferenceRuntimeReadN017<Key> | PreferenceBootUnknownReadN017;
    },
    readUnknown,
    inspect: () => structuredClone(runtime.inspect()),
  });
}

/**
 * One-call boot composition seam. The host supplies an origin/profile-scoped
 * read port; this function alone adapts it to the existing startup gate. It
 * never exposes localStorage, never accepts a write port, and missing values
 * remain memory-only defaults.
 */
export function bootstrapPreferenceRuntimeN017(ports: PreferenceBootPortsN017): PreferenceBootResultN017 {
  if (!ports || !validOrigin(ports.scope?.origin) || !validProfile(ports.scope?.profileId)
    || !ports.storage || typeof ports.storage.read !== 'function') return blocked('invalid-scope');

  const scope = Object.freeze({origin: ports.scope.origin, profileId: ports.scope.profileId});
  const snapshot = new Map<PreferenceRuntimeKeyN017, PreferenceBootReadResultN017>();
  for (const key of keys) {
    let result: PreferenceBootReadResultN017;
    try { result = ports.storage.read(Object.freeze({scope, key})); }
    catch { result = Object.freeze({status: 'read-error'}); }
    if (!result || typeof result !== 'object' || Array.isArray(result)
      || !['found', 'missing', 'read-error'].includes(result.status)
      || (result.status === 'found' && typeof result.value !== 'string')) {
      result = Object.freeze({status: 'read-error'});
    }
    snapshot.set(key, result);
  }
  const storage = Object.freeze({
    getItem(key: string): string | null {
      if (!keySet.has(key)) throw new Error('unknown stable preference key');
      const result = snapshot.get(key as PreferenceRuntimeKeyN017);
      if (!result) throw new Error('preference snapshot missing');
      if (result.status === 'missing') return null;
      if (result.status === 'read-error') throw new Error('preference read failed');
      return result.value;
    },
  });

  let runtime: PreferenceRuntimeStartupN017;
  try { runtime = (ports.start ?? startPreferenceRuntimeN017)(storage); }
  catch { return blocked('startup-gate-failed'); }
  if (!validRuntime(runtime)) return blocked('startup-gate-failed');

  const reason = runtime.startup.reason;
  if (reason !== 'ready' && reason !== 'defaults-in-memory' && reason !== 'diagnostic-blocked') {
    return blocked('startup-gate-failed');
  }
  return Object.freeze({
    schema: 'n017-preference-bootstrap-v1',
    status: reason === 'diagnostic-blocked' ? 'degraded' : 'ready',
    reason,
    scope,
    preferences: facade(runtime.preferences),
    storageWritesAllowed: false,
    rawStorageExposed: false,
  });
}

export function readStartupDocumentDefaults(origin:string,read:(key:string)=>string|null) {
  const profileId='local-user';
  const boot=bootstrapPreferenceRuntimeN017({scope:{origin,profileId},storage:{read(request){
    if(request.scope.origin!==origin||request.scope.profileId!==profileId)return {status:'read-error'};
    const value=read(request.key);
    return value===null?{status:'missing'}:{status:'found',value};
  }}});
  const defaults=boot.preferences.read('jueony-document-defaults','user');
  if(defaults.status!=='active')throw new Error('새 문서 기본값을 확인하지 못했습니다. 기존 설정은 보존했습니다.');
  return defaults.value;
}
