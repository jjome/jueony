export const USER_PROFILE_FORMAT_B150 = 'jueony-user-profile' as const;
export const USER_PROFILE_VERSION_B150 = 1 as const;
export const USER_PROFILE_MAX_BYTES_B150 = 128 * 1024;

const COMMAND_ID = /^[a-z][a-z0-9:_-]{0,95}$/;
const PROFILE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;
const MODIFIERS = new Map(MODIFIER_ORDER.map((modifier) => [modifier.toLowerCase(), modifier]));
const NAMED_KEYS = new Map([
  ['escape', 'Escape'], ['esc', 'Escape'], ['enter', 'Enter'], ['return', 'Enter'],
  ['tab', 'Tab'], ['space', 'Space'], ['backspace', 'Backspace'],
  ['delete', 'Delete'], ['del', 'Delete'], ['insert', 'Insert'], ['ins', 'Insert'],
  ['home', 'Home'], ['end', 'End'], ['pageup', 'PageUp'], ['pagedown', 'PageDown'],
  ['arrowup', 'ArrowUp'], ['up', 'ArrowUp'], ['arrowdown', 'ArrowDown'], ['down', 'ArrowDown'],
  ['arrowleft', 'ArrowLeft'], ['left', 'ArrowLeft'], ['arrowright', 'ArrowRight'], ['right', 'ArrowRight'],
]);
const OS_RESERVED = new Set([
  'Alt+F4', 'Alt+Tab', 'Alt+Escape', 'Ctrl+Alt+Delete', 'Ctrl+Shift+Escape',
  'Meta+D', 'Meta+E', 'Meta+I', 'Meta+L', 'Meta+R', 'Meta+Tab',
]);
const HANCOM_RESERVED = new Set([
  'Ctrl+A', 'Ctrl+C', 'Ctrl+F', 'Ctrl+G', 'Ctrl+H', 'Ctrl+N', 'Ctrl+O', 'Ctrl+P',
  'Ctrl+S', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Y', 'Ctrl+Z', 'Ctrl+Shift+Z',
  'Ctrl+0', 'Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4', 'Ctrl+5',
  'Ctrl+6', 'Ctrl+7', 'Ctrl+8', 'Ctrl+9',
]);

export type UserProfileScopeB150 = 'user' | 'organization';

export interface UserProfileCommandEntryB150 {
  commandId: string;
  visible: boolean;
  order: number;
}

export interface UserProfileKeymapEntryB150 {
  commandId: string;
  shortcut: string;
}

export interface UserProfileB150 {
  format: typeof USER_PROFILE_FORMAT_B150;
  version: typeof USER_PROFILE_VERSION_B150;
  scope: UserProfileScopeB150;
  profileId: string;
  revision: number;
  menu: UserProfileCommandEntryB150[];
  toolbar: UserProfileCommandEntryB150[];
  keymap: UserProfileKeymapEntryB150[];
}

export interface UserProfilePolicyB150 {
  commandAllowlist: ReadonlySet<string>;
  maxBytes?: number;
  maxEntriesPerSection?: number;
}

export type UserProfileErrorCodeB150 =
  | 'malformed' | 'oversize' | 'version' | 'identity' | 'revision'
  | 'command' | 'duplicate' | 'shortcut' | 'shortcut-conflict' | 'reserved-shortcut';

export class UserProfileErrorB150 extends Error {
  readonly code: UserProfileErrorCodeB150;
  constructor(code: UserProfileErrorCodeB150, message: string = code) {
    super(message);
    this.code = code;
    this.name = 'UserProfileErrorB150';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function assertIdentity(scope: unknown, profileId: unknown): asserts profileId is string {
  if ((scope !== 'user' && scope !== 'organization') || typeof profileId !== 'string' || !PROFILE_ID.test(profileId)) {
    throw new UserProfileErrorB150('identity');
  }
}

function assertCommand(commandId: unknown, policy: UserProfilePolicyB150): asserts commandId is string {
  if (typeof commandId !== 'string' || !COMMAND_ID.test(commandId) || !policy.commandAllowlist.has(commandId)) {
    throw new UserProfileErrorB150('command');
  }
}

function canonicalKey(raw: string): string | null {
  const lower = raw.toLowerCase();
  const named = NAMED_KEYS.get(lower);
  if (named) return named;
  if (/^[a-z]$/i.test(raw)) return raw.toUpperCase();
  if (/^[0-9]$/.test(raw)) return raw;
  const fn = /^f([1-9]|1[0-9]|2[0-4])$/i.exec(raw);
  if (fn) return `F${fn[1]}`;
  if (/^[-=\[\]\\;',./`]$/.test(raw)) return raw;
  return null;
}

export function normalizeUserShortcutB150(value: unknown): string {
  if (typeof value !== 'string' || value.length < 3 || value.length > 64 || value.trim() !== value) {
    throw new UserProfileErrorB150('shortcut');
  }
  const parts = value.split('+');
  if (parts.length < 2 || parts.some((part) => part.length === 0)) throw new UserProfileErrorB150('shortcut');
  const key = canonicalKey(parts.pop()!);
  if (!key) throw new UserProfileErrorB150('shortcut');
  const modifiers = new Set<string>();
  for (const raw of parts) {
    const modifier = MODIFIERS.get(raw.toLowerCase());
    if (!modifier || modifiers.has(modifier)) throw new UserProfileErrorB150('shortcut');
    modifiers.add(modifier);
  }
  if (!modifiers.has('Ctrl') && !modifiers.has('Alt') && !modifiers.has('Meta')) {
    throw new UserProfileErrorB150('shortcut');
  }
  const normalized = [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
  if (OS_RESERVED.has(normalized) || HANCOM_RESERVED.has(normalized)) {
    throw new UserProfileErrorB150('reserved-shortcut', normalized);
  }
  return normalized;
}

function parseCommandSection(value: unknown, policy: UserProfilePolicyB150): UserProfileCommandEntryB150[] {
  const limit = policy.maxEntriesPerSection ?? 256;
  if (!Array.isArray(value) || value.length > limit) throw new UserProfileErrorB150('malformed');
  const commands = new Set<string>();
  const orders = new Set<number>();
  const result = value.map((item) => {
    if (!isRecord(item) || !exactKeys(item, ['commandId', 'visible', 'order'])) throw new UserProfileErrorB150('malformed');
    assertCommand(item.commandId, policy);
    if (typeof item.visible !== 'boolean' || !Number.isSafeInteger(item.order) || (item.order as number) < 0 || (item.order as number) > 9999) {
      throw new UserProfileErrorB150('malformed');
    }
    if (commands.has(item.commandId) || orders.has(item.order as number)) throw new UserProfileErrorB150('duplicate');
    commands.add(item.commandId); orders.add(item.order as number);
    return { commandId: item.commandId, visible: item.visible, order: item.order as number };
  });
  return result.sort((a, b) => a.order - b.order || a.commandId.localeCompare(b.commandId));
}

function parseKeymap(value: unknown, policy: UserProfilePolicyB150): UserProfileKeymapEntryB150[] {
  const limit = policy.maxEntriesPerSection ?? 256;
  if (!Array.isArray(value) || value.length > limit) throw new UserProfileErrorB150('malformed');
  const commands = new Set<string>();
  const shortcuts = new Set<string>();
  const result = value.map((item) => {
    if (!isRecord(item) || !exactKeys(item, ['commandId', 'shortcut'])) throw new UserProfileErrorB150('malformed');
    assertCommand(item.commandId, policy);
    const shortcut = normalizeUserShortcutB150(item.shortcut);
    if (commands.has(item.commandId)) throw new UserProfileErrorB150('duplicate');
    if (shortcuts.has(shortcut.toLowerCase())) throw new UserProfileErrorB150('shortcut-conflict');
    commands.add(item.commandId); shortcuts.add(shortcut.toLowerCase());
    return { commandId: item.commandId, shortcut };
  });
  return result.sort((a, b) => a.commandId.localeCompare(b.commandId));
}

export function captureUserProfileB150(value: unknown, policy: UserProfilePolicyB150): UserProfileB150 {
  if (!isRecord(value) || !exactKeys(value, ['format', 'version', 'scope', 'profileId', 'revision', 'menu', 'toolbar', 'keymap'])) {
    throw new UserProfileErrorB150('malformed');
  }
  if (value.format !== USER_PROFILE_FORMAT_B150) throw new UserProfileErrorB150('malformed');
  if (value.version !== USER_PROFILE_VERSION_B150) throw new UserProfileErrorB150('version');
  assertIdentity(value.scope, value.profileId);
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0) throw new UserProfileErrorB150('revision');
  return {
    format: USER_PROFILE_FORMAT_B150,
    version: USER_PROFILE_VERSION_B150,
    scope: value.scope as UserProfileScopeB150,
    profileId: value.profileId,
    revision: value.revision as number,
    menu: parseCommandSection(value.menu, policy),
    toolbar: parseCommandSection(value.toolbar, policy),
    keymap: parseKeymap(value.keymap, policy),
  };
}

export function exportUserProfileB150(value: unknown, policy: UserProfilePolicyB150): string {
  const canonical = captureUserProfileB150(value, policy);
  const text = JSON.stringify(canonical, null, 2);
  if (byteLength(text) > (policy.maxBytes ?? USER_PROFILE_MAX_BYTES_B150)) throw new UserProfileErrorB150('oversize');
  return text;
}

export function importUserProfileB150(text: string, policy: UserProfilePolicyB150): UserProfileB150 {
  if (typeof text !== 'string' || byteLength(text) > (policy.maxBytes ?? USER_PROFILE_MAX_BYTES_B150)) {
    throw new UserProfileErrorB150('oversize');
  }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new UserProfileErrorB150('malformed'); }
  return captureUserProfileB150(value, policy);
}

function mergeCommandSection(
  current: readonly UserProfileCommandEntryB150[],
  incoming: readonly UserProfileCommandEntryB150[],
): UserProfileCommandEntryB150[] {
  const result = current.map((entry) => ({ ...entry }));
  const existing = new Set(result.map((entry) => entry.commandId));
  let nextOrder = result.reduce((max, entry) => Math.max(max, entry.order), -1) + 1;
  for (const entry of [...incoming].sort((a, b) => a.order - b.order || a.commandId.localeCompare(b.commandId))) {
    if (!existing.has(entry.commandId)) {
      result.push({ commandId: entry.commandId, visible: entry.visible, order: nextOrder++ });
      existing.add(entry.commandId);
    }
  }
  return result;
}

/** Add-only merge: every existing command override wins; imported entries only fill missing commands. */
export function mergeUserProfilesB150(
  currentValue: unknown,
  incomingValue: unknown,
  policy: UserProfilePolicyB150,
): UserProfileB150 {
  const current = captureUserProfileB150(currentValue, policy);
  const incoming = captureUserProfileB150(incomingValue, policy);
  if (current.scope !== incoming.scope || current.profileId !== incoming.profileId) throw new UserProfileErrorB150('identity');
  const keymap = current.keymap.map((entry) => ({ ...entry }));
  const commandIds = new Set(keymap.map((entry) => entry.commandId));
  const shortcuts = new Set(keymap.map((entry) => entry.shortcut.toLowerCase()));
  for (const entry of incoming.keymap) {
    if (commandIds.has(entry.commandId)) continue;
    if (shortcuts.has(entry.shortcut.toLowerCase())) throw new UserProfileErrorB150('shortcut-conflict');
    keymap.push({ ...entry }); commandIds.add(entry.commandId); shortcuts.add(entry.shortcut.toLowerCase());
  }
  return captureUserProfileB150({
    ...current,
    revision: current.revision,
    menu: mergeCommandSection(current.menu, incoming.menu),
    toolbar: mergeCommandSection(current.toolbar, incoming.toolbar),
    keymap,
  }, policy);
}

