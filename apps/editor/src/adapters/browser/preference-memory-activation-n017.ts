import {
  createDocumentViewJournal,
  defaultDocumentDefaults,
  defaultEditorChromePreferences,
  normalizeRecoverySettings,
  readDocumentDefaults,
  readEditorChromePreferences,
  readRecentFonts,
  readSnippetLibrary,
  type PreferenceScope,
  type PreferenceStorage,
} from '../../modules/preferences/public/index.ts';
import {createCalendarFormatPreference} from './calendar-format-preference.ts';
import {readRecoverySettings} from './recovery-settings.ts';
import type {
  PreferenceActivationDirectiveN017,
  PreferenceActivationSourceN017,
  PreferenceMemoryActivationPortN017,
} from './preference-startup-gate-n017.ts';

export type PreferenceMemoryLookupN017 =
  | Readonly<{status: 'active'; source: Exclude<PreferenceActivationSourceN017, 'blocked'>; value: unknown}>
  | Readonly<{status: 'blocked'; reason: 'corrupt' | 'unsupported-version' | 'read-error'}>
  | Readonly<{status: 'absent'}>;

export type PreferenceMemoryActivationN017 = PreferenceMemoryActivationPortN017 & Readonly<{
  lookup(scope: PreferenceScope, key: string): PreferenceMemoryLookupN017;
  inspect(): Readonly<Record<PreferenceScope, Readonly<{
    activeKeys: readonly string[];
    blockedKeys: readonly string[];
  }>>>;
}>;

type ActiveEntry = Readonly<{
  status: 'active';
  source: 'stored' | 'memory-default';
  value: unknown;
}>;
type BlockedEntry = Readonly<{
  status: 'blocked';
  reason: 'corrupt' | 'unsupported-version' | 'read-error';
}>;
type MemoryEntry = ActiveEntry | BlockedEntry;
type ScopeTable = Map<string, MemoryEntry>;
type ActivationTable = Readonly<Record<PreferenceScope, ScopeTable>>;

type RegistryEntry = Readonly<{
  scopes: readonly PreferenceScope[];
  read(raw: string): unknown;
  defaults(): unknown;
}>;

const isolatedStorage = (key: string, raw: string): PreferenceStorage => Object.freeze({
  getItem: (requested: string) => requested === key ? raw : null,
  setItem: () => { throw new Error('N017 memory activation is read-only.'); },
});

function parseViewJournal(raw: string): unknown {
  const storage = isolatedStorage('jueony-document-view-journal-v1', raw);
  createDocumentViewJournal(storage).readRecord('__n017__', '__n017__', 0);
  return JSON.parse(raw) as unknown;
}

const registry: Readonly<Record<string, RegistryEntry>> = Object.freeze({
  'rhwp-settings': Object.freeze({
    scopes: Object.freeze(['user'] as const),
    read: (raw: string) => readRecoverySettings(isolatedStorage('rhwp-settings', raw)),
    defaults: () => normalizeRecoverySettings(undefined),
  }),
  'jueony-document-defaults': Object.freeze({
    scopes: Object.freeze(['user'] as const),
    read: (raw: string) => readDocumentDefaults(isolatedStorage('jueony-document-defaults', raw)),
    defaults: () => defaultDocumentDefaults(),
  }),
  'jueony-editor-chrome-v1': Object.freeze({
    scopes: Object.freeze(['user'] as const),
    read: (raw: string) => readEditorChromePreferences(isolatedStorage('jueony-editor-chrome-v1', raw)),
    defaults: () => defaultEditorChromePreferences(),
  }),
  'jueony-style-panel': Object.freeze({
    scopes: Object.freeze(['user'] as const),
    read: (raw: string) => {
      if (raw !== 'true' && raw !== 'false') throw new Error('invalid legacy preference');
      return raw === 'true';
    },
    defaults: () => true,
  }),
  'jueony-recent-fonts-v1': Object.freeze({
    scopes: Object.freeze(['user'] as const),
    read: (raw: string) => readRecentFonts(isolatedStorage('jueony-recent-fonts-v1', raw)),
    defaults: () => ({version: 1 as const, names: [] as string[]}),
  }),
  'jueony-calendar-format': Object.freeze({
    scopes: Object.freeze(['user'] as const),
    read: (raw: string) => createCalendarFormatPreference(isolatedStorage('jueony-calendar-format', raw)).read(),
    defaults: () => 'date-dots',
  }),
  'jueony-common-snippets': Object.freeze({
    scopes: Object.freeze(['user'] as const),
    read: (raw: string) => readSnippetLibrary(isolatedStorage('jueony-common-snippets', raw)),
    defaults: () => ({version: 1 as const, snippets: [] as unknown[]}),
  }),
  'jueony-document-view-journal-v1': Object.freeze({
    scopes: Object.freeze(['workspace', 'document'] as const),
    read: parseViewJournal,
    defaults: () => ({version: 1 as const, entries: [] as unknown[]}),
  }),
});

const registryKeys = Object.freeze(Object.keys(registry));
const scopeNames = Object.freeze(['user', 'workspace', 'document'] as const);

function emptyTable(): ActivationTable {
  return Object.freeze({user: new Map(), workspace: new Map(), document: new Map()});
}

function sameScopes(left: readonly PreferenceScope[], right: readonly PreferenceScope[]): boolean {
  return left.length === right.length && left.every((scope, index) => scope === right[index]);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function validDirectiveSet(directives: readonly PreferenceActivationDirectiveN017[]): boolean {
  if (!Array.isArray(directives) || directives.length !== registryKeys.length) return false;
  const seen = new Set<string>();
  for (const directive of directives) {
    const contract = directive && registry[directive.key];
    if (!contract || seen.has(directive.key) || !sameScopes(directive.scopes, contract.scopes)) return false;
    seen.add(directive.key);
    if (directive.source === 'blocked') {
      if (!['corrupt', 'unsupported-version', 'read-error'].includes(directive.blockReason ?? '')) return false;
    } else if (directive.source !== 'stored' && directive.source !== 'memory-default' || directive.blockReason !== undefined) {
      return false;
    }
  }
  return registryKeys.every(key => seen.has(key));
}

function stageActivation(
  storage: Pick<PreferenceStorage, 'getItem'>,
  directives: readonly PreferenceActivationDirectiveN017[],
): ActivationTable | undefined {
  if (!validDirectiveSet(directives)) return;
  const staged = emptyTable();
  try {
    for (const directive of directives) {
      const contract = registry[directive.key];
      let entry: MemoryEntry;
      if (directive.source === 'blocked') {
        entry = Object.freeze({status: 'blocked', reason: directive.blockReason!});
      } else {
        const raw = storage.getItem(directive.key);
        if (directive.source === 'stored' && raw === null || directive.source === 'memory-default' && raw !== null) return;
        const value = directive.source === 'stored' ? contract.read(raw!) : contract.defaults();
        entry = Object.freeze({status: 'active', source: directive.source, value: cloneValue(value)});
      }
      for (const scope of contract.scopes) staged[scope].set(directive.key, entry);
    }
    return staged;
  } catch {
    return;
  }
}

/**
 * Atomic, memory-only implementation of the N017 startup activation port.
 * Explicitly blocked keys are omitted while other scopes may activate. Any
 * unexpected read/default/contract failure rejects the whole staged batch and
 * preserves the previously activated table.
 */
export function createPreferenceMemoryActivationN017(
  storage: Pick<PreferenceStorage, 'getItem'>,
): PreferenceMemoryActivationN017 {
  let table = emptyTable();
  return Object.freeze({
    apply(directives: readonly PreferenceActivationDirectiveN017[]) {
      const staged = stageActivation(storage, directives);
      if (!staged) return 'rejected' as const;
      table = staged;
      return 'applied' as const;
    },
    lookup(scope: PreferenceScope, key: string): PreferenceMemoryLookupN017 {
      const entry = table[scope]?.get(key);
      if (!entry) return Object.freeze({status: 'absent'});
      if (entry.status === 'blocked') return Object.freeze({status: 'blocked', reason: entry.reason});
      return Object.freeze({status: 'active', source: entry.source, value: cloneValue(entry.value)});
    },
    inspect() {
      const projection = (scope: PreferenceScope) => {
        const entries = [...table[scope]];
        return Object.freeze({
          activeKeys: Object.freeze(entries.filter(([, entry]) => entry.status === 'active').map(([key]) => key)),
          blockedKeys: Object.freeze(entries.filter(([, entry]) => entry.status === 'blocked').map(([key]) => key)),
        });
      };
      return Object.freeze({user: projection('user'), workspace: projection('workspace'), document: projection('document')});
    },
  });
}
