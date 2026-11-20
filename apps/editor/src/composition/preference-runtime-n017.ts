import type {CalendarStampFormat} from '../modules/document/public/index.ts';
import type {
  DocumentDefaults,
  EditorChromePreferences,
  PreferenceScope,
  PreferenceStorage,
  RecentFonts,
  RecoverySettings,
  SnippetLibrary,
  ViewJournalEntry,
} from '../modules/preferences/public/index.ts';
import {
  createPreferenceMemoryActivationN017,
  type PreferenceMemoryActivationN017,
} from '../adapters/browser/preference-memory-activation-n017.ts';
import {
  runPreferenceStartupGateN017,
  type PreferenceStartupGateResultN017,
} from '../adapters/browser/preference-startup-gate-n017.ts';

export type PreferenceRuntimeViewJournalN017 = Readonly<{
  version: 1;
  entries: readonly ViewJournalEntry[];
}>;

export type PreferenceRuntimeValuesN017 = Readonly<{
  'rhwp-settings': RecoverySettings;
  'jueony-document-defaults': DocumentDefaults;
  'jueony-editor-chrome-v1': EditorChromePreferences;
  'jueony-style-panel': boolean;
  'jueony-recent-fonts-v1': RecentFonts;
  'jueony-calendar-format': CalendarStampFormat;
  'jueony-common-snippets': SnippetLibrary;
  'jueony-document-view-journal-v1': PreferenceRuntimeViewJournalN017;
}>;

export type PreferenceRuntimeKeyN017 = keyof PreferenceRuntimeValuesN017;
export type PreferenceRuntimeScopeN017<Key extends PreferenceRuntimeKeyN017> =
  Key extends 'jueony-document-view-journal-v1' ? 'workspace' | 'document' : 'user';

export type PreferenceRuntimeReadN017<Key extends PreferenceRuntimeKeyN017> =
  | Readonly<{
      status: 'active';
      source: 'stored' | 'memory-default';
      value: PreferenceRuntimeValuesN017[Key];
    }>
  | Readonly<{status: 'blocked'; reason: 'corrupt' | 'unsupported-version' | 'read-error'}>
  | Readonly<{status: 'absent'}>;

export type PreferenceRuntimeProjectionN017 = Readonly<Record<PreferenceScope, Readonly<{
  activeKeys: readonly PreferenceRuntimeKeyN017[];
  blockedKeys: readonly PreferenceRuntimeKeyN017[];
}>>>;

export type PreferenceRuntimeFacadeN017 = Readonly<{
  read<Key extends PreferenceRuntimeKeyN017>(
    key: Key,
    scope: PreferenceRuntimeScopeN017<Key>,
  ): PreferenceRuntimeReadN017<Key>;
  inspect(): PreferenceRuntimeProjectionN017;
}>;

export type PreferenceRuntimeStartupN017 = Readonly<{
  startup: PreferenceStartupGateResultN017;
  preferences: PreferenceRuntimeFacadeN017;
}>;

const scopeByKey: Readonly<Record<PreferenceRuntimeKeyN017, readonly PreferenceScope[]>> = Object.freeze({
  'rhwp-settings': Object.freeze(['user'] as const),
  'jueony-document-defaults': Object.freeze(['user'] as const),
  'jueony-editor-chrome-v1': Object.freeze(['user'] as const),
  'jueony-style-panel': Object.freeze(['user'] as const),
  'jueony-recent-fonts-v1': Object.freeze(['user'] as const),
  'jueony-calendar-format': Object.freeze(['user'] as const),
  'jueony-common-snippets': Object.freeze(['user'] as const),
  'jueony-document-view-journal-v1': Object.freeze(['workspace', 'document'] as const),
});

function runtimeKey(value: string): value is PreferenceRuntimeKeyN017 {
  return Object.prototype.hasOwnProperty.call(scopeByKey, value);
}

/** Read-only consumer facade over an already-validated memory activation. */
export function createPreferenceRuntimeFacadeN017(
  activation: Pick<PreferenceMemoryActivationN017, 'lookup' | 'inspect'>,
): PreferenceRuntimeFacadeN017 {
  return Object.freeze({
    read<Key extends PreferenceRuntimeKeyN017>(
      key: Key,
      scope: PreferenceRuntimeScopeN017<Key>,
    ): PreferenceRuntimeReadN017<Key> {
      if (!scopeByKey[key].includes(scope)) return Object.freeze({status: 'absent'});
      const result = activation.lookup(scope, key);
      if (result.status === 'active') {
        return Object.freeze({
          status: 'active',
          source: result.source,
          value: structuredClone(result.value) as PreferenceRuntimeValuesN017[Key],
        });
      }
      if (result.status === 'blocked') return Object.freeze({status: 'blocked', reason: result.reason});
      return Object.freeze({status: 'absent'});
    },
    inspect(): PreferenceRuntimeProjectionN017 {
      const projection = activation.inspect();
      const scoped = (scope: PreferenceScope) => Object.freeze({
        activeKeys: Object.freeze(projection[scope].activeKeys.filter(runtimeKey)),
        blockedKeys: Object.freeze(projection[scope].blockedKeys.filter(runtimeKey)),
      });
      return Object.freeze({user: scoped('user'), workspace: scoped('workspace'), document: scoped('document')});
    },
  });
}

/**
 * Startup composition seam for the dirty app shell. It accepts only read
 * capability, activates defaults in memory, and exposes no persistence API.
 */
export function startPreferenceRuntimeN017(
  storage: Pick<PreferenceStorage, 'getItem'>,
): PreferenceRuntimeStartupN017 {
  const activation = createPreferenceMemoryActivationN017(storage);
  const startup = runPreferenceStartupGateN017({storage, activation});
  return Object.freeze({startup, preferences: createPreferenceRuntimeFacadeN017(activation)});
}
