/**
 * B148 is an app-local preference contract. It never claims to reconfigure the
 * Windows IME or to reproduce Hancom's keyboard engine.
 */
export type KeyboardProfileB148 = 'system-ime' | 'two-set-korean' | 'three-set-390' | 'roman';

export type KeyboardProfileOwnerB148 = Readonly<{
  identity: string;
  instance: string;
  active: true;
  composing: false;
}>;

export type KeyboardProfilePreferenceB148 = Readonly<{
  version: 1;
  scope: 'user-global';
  profile: KeyboardProfileB148;
}>;

export type KeyboardProfileViewB148 = Readonly<{
  version: 1;
  owner: KeyboardProfileOwnerB148;
  preference: KeyboardProfilePreferenceB148;
  profiles: readonly KeyboardProfileB148[];
}>;

export interface KeyboardProfileStorageB148 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface KeyboardProfileOptionsB148 {
  storage: KeyboardProfileStorageB148;
  readOwner(): unknown;
  project(view: KeyboardProfileViewB148): void;
}

type KeyboardProfileErrorCodeB148 =
  | 'invalid-owner' | 'inactive-document' | 'composition-active' | 'stale-document'
  | 'invalid-preference' | 'read-failed' | 'write-failed' | 'disposed';

export class KeyboardProfileErrorB148 extends Error {
  readonly code: KeyboardProfileErrorCodeB148;

  constructor(code: KeyboardProfileErrorCodeB148) {
    super({
      'invalid-owner': '글자판 설정의 문서 소유권을 확인하지 못했습니다.',
      'inactive-document': '현재 활성 문서의 글자판 설정이 아닙니다.',
      'composition-active': '한글 조합을 마친 뒤 글자판 설정을 바꾸세요.',
      'stale-document': '문서가 바뀌었습니다. 글자판 설정을 다시 여세요.',
      'invalid-preference': '저장된 글자판 설정이 올바르지 않습니다.',
      'read-failed': '글자판 설정을 읽지 못했습니다.',
      'write-failed': '글자판 설정을 저장하지 못했습니다.',
      disposed: '이미 끝난 글자판 설정 세션입니다.',
    }[code]);
    this.name = 'KeyboardProfileErrorB148';
    this.code = code;
  }
}

export const KEYBOARD_PROFILE_KEY_B148 = 'jueony.user.keyboard-profile.v1';
export const KEYBOARD_PROFILES_B148 = Object.freeze([
  'system-ime', 'two-set-korean', 'three-set-390', 'roman',
] as const);

const PROFILE_SET = new Set<string>(KEYBOARD_PROFILES_B148);
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const MAX_STORED_BYTES = 512;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isProfile(value: unknown): value is KeyboardProfileB148 {
  return typeof value === 'string' && PROFILE_SET.has(value);
}

function owner(value: unknown): KeyboardProfileOwnerB148 {
  const item = record(value);
  if (!item || !exact(item, ['identity', 'instance', 'active', 'composing'])
    || typeof item.identity !== 'string' || !TOKEN.test(item.identity)
    || typeof item.instance !== 'string' || !TOKEN.test(item.instance)
    || typeof item.active !== 'boolean' || typeof item.composing !== 'boolean') {
    throw new KeyboardProfileErrorB148('invalid-owner');
  }
  if (!item.active) throw new KeyboardProfileErrorB148('inactive-document');
  if (item.composing) throw new KeyboardProfileErrorB148('composition-active');
  return Object.freeze({identity: item.identity, instance: item.instance, active: true, composing: false});
}

function preference(value: unknown): KeyboardProfilePreferenceB148 {
  const item = record(value);
  if (!item || !exact(item, ['version', 'scope', 'profile']) || item.version !== 1
    || item.scope !== 'user-global' || !isProfile(item.profile)) {
    throw new KeyboardProfileErrorB148('invalid-preference');
  }
  return Object.freeze({version: 1, scope: 'user-global', profile: item.profile});
}

function parse(raw: string): KeyboardProfilePreferenceB148 {
  if (new TextEncoder().encode(raw).length > MAX_STORED_BYTES) {
    throw new KeyboardProfileErrorB148('invalid-preference');
  }
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new KeyboardProfileErrorB148('invalid-preference'); }
  return preference(value);
}

function view(ownerValue: KeyboardProfileOwnerB148, state: KeyboardProfilePreferenceB148): KeyboardProfileViewB148 {
  return Object.freeze({version: 1, owner: ownerValue, preference: state, profiles: KEYBOARD_PROFILES_B148});
}

export function createKeyboardProfileControllerB148(options: KeyboardProfileOptionsB148) {
  const capturedOwner = owner(options.readOwner());
  let state: KeyboardProfilePreferenceB148;
  try {
    const raw = options.storage.getItem(KEYBOARD_PROFILE_KEY_B148);
    state = raw === null
      ? Object.freeze({version: 1, scope: 'user-global', profile: 'system-ime'})
      : parse(raw);
  } catch (error) {
    if (error instanceof KeyboardProfileErrorB148) throw error;
    throw new KeyboardProfileErrorB148('read-failed');
  }
  let disposed = false;

  const current = (): KeyboardProfileOwnerB148 => {
    if (disposed) throw new KeyboardProfileErrorB148('disposed');
    let actual: KeyboardProfileOwnerB148;
    try { actual = owner(options.readOwner()); }
    catch (error) {
      if (error instanceof KeyboardProfileErrorB148
        && (error.code === 'inactive-document' || error.code === 'composition-active')) throw error;
      throw new KeyboardProfileErrorB148('stale-document');
    }
    if (actual.identity !== capturedOwner.identity || actual.instance !== capturedOwner.instance) {
      throw new KeyboardProfileErrorB148('stale-document');
    }
    return actual;
  };

  const project = () => options.project(view(capturedOwner, state));
  current();
  project();

  return Object.freeze({
    snapshot(): KeyboardProfileViewB148 {
      current();
      return view(capturedOwner, state);
    },
    select(profile: KeyboardProfileB148): KeyboardProfileViewB148 {
      current();
      if (!isProfile(profile)) throw new KeyboardProfileErrorB148('invalid-preference');
      const next = Object.freeze({version: 1 as const, scope: 'user-global' as const, profile});
      const previous = state;
      try {
        options.storage.setItem(KEYBOARD_PROFILE_KEY_B148, JSON.stringify(next));
        const raw = options.storage.getItem(KEYBOARD_PROFILE_KEY_B148);
        if (raw === null || JSON.stringify(parse(raw)) !== JSON.stringify(next)) throw new Error('readback');
      } catch {
        state = previous;
        project();
        throw new KeyboardProfileErrorB148('write-failed');
      }
      current();
      state = next;
      project();
      return view(capturedOwner, state);
    },
    dispose(): void { disposed = true; },
  });
}
