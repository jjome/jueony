import type { PreferenceScope, PreferenceStorage } from '../../modules/preferences/public/index.ts';
import {
  diagnosePreferenceStartupN017,
  type PreferenceStartupDiagnosticN017,
  type PreferenceStartupItemN017,
  type PreferenceStartupStateN017,
} from './preference-startup-diagnostic-n017.ts';

export type PreferenceActivationSourceN017 = 'stored' | 'memory-default' | 'blocked';

export type PreferenceActivationDirectiveN017 = Readonly<{
  key: string;
  scopes: readonly PreferenceScope[];
  source: PreferenceActivationSourceN017;
  blockReason?: 'corrupt' | 'unsupported-version' | 'read-error';
}>;

/**
 * The implementation owns default factories and stored-value readers. `apply`
 * must replace its in-memory activation table atomically and must not persist.
 * No preference value crosses this startup gate.
 */
export type PreferenceMemoryActivationPortN017 = Readonly<{
  apply(directives: readonly PreferenceActivationDirectiveN017[]): 'applied' | 'rejected';
}>;

export type PreferenceScopeProjectionN017 = Readonly<{
  activeKeys: readonly string[];
  defaultKeys: readonly string[];
  blockedKeys: readonly string[];
}>;

export type PreferenceStartupGateResultN017 = Readonly<{
  schema: 'n017-startup-gate-v1';
  state: PreferenceStartupStateN017;
  activation: 'applied' | 'not-applied';
  reason: 'ready' | 'defaults-in-memory' | 'diagnostic-blocked' | 'activation-rejected' | 'contract-drift';
  directives: readonly PreferenceActivationDirectiveN017[];
  scopes: Readonly<Record<PreferenceScope, PreferenceScopeProjectionN017>>;
  backup: Readonly<{
    defaultPolicy: 'excluded';
    approvedKeys: readonly string[];
    includedKeys: readonly string[];
    projectionOnlyKeys: readonly string[];
    excludedKeys: readonly string[];
  }>;
  rawValuesExposed: false;
  storageWritesAllowed: false;
  message?: string;
}>;

type DiagnosePortN017 = (storage: Pick<PreferenceStorage, 'getItem'>) => PreferenceStartupDiagnosticN017;

export type PreferenceStartupGatePortsN017 = Readonly<{
  storage: Pick<PreferenceStorage, 'getItem'>;
  activation: PreferenceMemoryActivationPortN017;
  diagnose?: DiagnosePortN017;
}>;

const stableKeysN017 = Object.freeze([
  'rhwp-settings',
  'jueony-document-defaults',
  'jueony-editor-chrome-v1',
  'jueony-style-panel',
  'jueony-recent-fonts-v1',
  'jueony-calendar-format',
  'jueony-common-snippets',
  'jueony-document-view-journal-v1',
]);

const emptyProjection = (): PreferenceScopeProjectionN017 => Object.freeze({
  activeKeys: Object.freeze([]),
  defaultKeys: Object.freeze([]),
  blockedKeys: Object.freeze([]),
});

const emptyScopes = (): Readonly<Record<PreferenceScope, PreferenceScopeProjectionN017>> => Object.freeze({
  user: emptyProjection(),
  workspace: emptyProjection(),
  document: emptyProjection(),
});

const emptyBackup = () => Object.freeze({
  defaultPolicy: 'excluded' as const,
  approvedKeys: Object.freeze([]),
  includedKeys: Object.freeze([]),
  projectionOnlyKeys: Object.freeze([]),
  excludedKeys: Object.freeze([...stableKeysN017]),
});

const expectedDecision: Readonly<Record<PreferenceStartupItemN017['status'], PreferenceStartupItemN017['decision']>> = Object.freeze({
  valid: 'use-stored-value',
  missing: 'use-default-in-memory',
  corrupt: 'preserve-and-review',
  'unsupported-version': 'preserve-and-upgrade',
  'read-error': 'preserve-and-retry-read',
});

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function unique(value: readonly string[]): boolean {
  return new Set(value).size === value.length;
}

function validDiagnostic(value: unknown): value is PreferenceStartupDiagnosticN017 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const diagnostic = value as PreferenceStartupDiagnosticN017;
  if (diagnostic.schema !== 'n017-stable-preferences-v1' || diagnostic.automaticRepair !== 'forbidden') return false;
  if (!['ready', 'defaults-in-memory', 'blocked'].includes(diagnostic.state) || !Array.isArray((value as Record<string, unknown>).items)) return false;
  const items = diagnostic.items as readonly PreferenceStartupItemN017[];
  const keys = items.map(item => item?.key);
  if (!stringArray(keys) || !unique(keys) || !sameArray(keys, stableKeysN017)) return false;
  for (const item of items) {
    if (!item || item.automaticWriteAllowed !== false || !Array.isArray(item.scopes) || !item.scopes.every((scope: PreferenceScope) => ['user', 'workspace', 'document'].includes(scope))) return false;
    if (!Object.prototype.hasOwnProperty.call(expectedDecision, item.status)) return false;
    if (item.decision !== expectedDecision[item.status]) return false;
  }

  const counts = { missing: 0, valid: 0, corrupt: 0, 'unsupported-version': 0, 'read-error': 0 };
  for (const item of items) counts[item.status] += 1;
  if (Object.entries(counts).some(([key, count]) => diagnostic.counts?.[key as keyof typeof counts] !== count)) return false;
  const derivedState: PreferenceStartupStateN017 = counts.corrupt || counts['unsupported-version'] || counts['read-error']
    ? 'blocked'
    : counts.missing ? 'defaults-in-memory' : 'ready';
  if (diagnostic.state !== derivedState) return false;

  for (const scope of ['user', 'workspace', 'document'] as const) {
    const projected = items.filter(item => item.scopes.includes(scope)).map(item => item.key);
    if (!stringArray(diagnostic.scopes?.[scope]) || !sameArray(diagnostic.scopes[scope], projected)) return false;
  }

  const backup = diagnostic.backup;
  if (!backup || backup.defaultPolicy !== 'excluded') return false;
  const lists = [backup.approvedKeys, backup.includedKeys, backup.projectionOnlyKeys, backup.excludedKeys];
  if (lists.some(list => !stringArray(list) || !unique(list))) return false;
  const approved = [...backup.includedKeys, ...backup.projectionOnlyKeys];
  if (approved.length !== backup.approvedKeys.length || !approved.every(key => backup.approvedKeys.includes(key))) return false;
  if (backup.excludedKeys.some(key => backup.approvedKeys.includes(key))) return false;
  for (const item of items) {
    const expected = item.backup === 'included' ? backup.includedKeys : item.backup === 'projection-only' ? backup.projectionOnlyKeys : backup.excludedKeys;
    if (!expected.includes(item.key)) return false;
  }
  return true;
}

function directivesFor(diagnostic: PreferenceStartupDiagnosticN017): readonly PreferenceActivationDirectiveN017[] {
  return Object.freeze(diagnostic.items.map(item => {
    const scopes = Object.freeze([...item.scopes]);
    if (item.status === 'valid') return Object.freeze({ key: item.key, scopes, source: 'stored' as const });
    if (item.status === 'missing') return Object.freeze({ key: item.key, scopes, source: 'memory-default' as const });
    return Object.freeze({ key: item.key, scopes, source: 'blocked' as const, blockReason: item.status });
  }));
}

function projectScopes(directives: readonly PreferenceActivationDirectiveN017[]): Readonly<Record<PreferenceScope, PreferenceScopeProjectionN017>> {
  const project = (scope: PreferenceScope): PreferenceScopeProjectionN017 => {
    const scoped = directives.filter(directive => directive.scopes.includes(scope));
    return Object.freeze({
      activeKeys: Object.freeze(scoped.filter(directive => directive.source !== 'blocked').map(directive => directive.key)),
      defaultKeys: Object.freeze(scoped.filter(directive => directive.source === 'memory-default').map(directive => directive.key)),
      blockedKeys: Object.freeze(scoped.filter(directive => directive.source === 'blocked').map(directive => directive.key)),
    });
  };
  return Object.freeze({ user: project('user'), workspace: project('workspace'), document: project('document') });
}

function blockedResult(reason: 'activation-rejected' | 'contract-drift'): PreferenceStartupGateResultN017 {
  return Object.freeze({
    schema: 'n017-startup-gate-v1',
    state: 'blocked',
    activation: 'not-applied',
    reason,
    directives: Object.freeze([]),
    scopes: emptyScopes(),
    backup: emptyBackup(),
    rawValuesExposed: false,
    storageWritesAllowed: false,
    message: reason === 'contract-drift'
      ? '환경 설정 시작 계약을 확인할 수 없어 모든 설정 적용을 차단했습니다.'
      : '환경 설정을 메모리에 안전하게 적용하지 못해 모든 설정 적용을 차단했습니다.',
  });
}

/**
 * Applies the read-only diagnostic at the startup boundary. The only side
 * effect is one atomic in-memory activation-port call; this facade has no
 * storage write capability and returns no stored/default values.
 */
export function runPreferenceStartupGateN017(ports: PreferenceStartupGatePortsN017): PreferenceStartupGateResultN017 {
  let diagnostic: PreferenceStartupDiagnosticN017;
  try {
    diagnostic = (ports.diagnose ?? diagnosePreferenceStartupN017)(ports.storage);
  } catch {
    return blockedResult('contract-drift');
  }
  if (!validDiagnostic(diagnostic)) return blockedResult('contract-drift');

  const directives = directivesFor(diagnostic);
  let applied: 'applied' | 'rejected';
  try { applied = ports.activation.apply(directives); }
  catch { return blockedResult('activation-rejected'); }
  if (applied !== 'applied') return blockedResult('activation-rejected');

  return Object.freeze({
    schema: 'n017-startup-gate-v1',
    state: diagnostic.state,
    activation: 'applied',
    reason: diagnostic.state === 'ready' ? 'ready' : diagnostic.state === 'defaults-in-memory' ? 'defaults-in-memory' : 'diagnostic-blocked',
    directives,
    scopes: projectScopes(directives),
    backup: Object.freeze({
      defaultPolicy: 'excluded',
      approvedKeys: Object.freeze([...diagnostic.backup.approvedKeys]),
      includedKeys: Object.freeze([...diagnostic.backup.includedKeys]),
      projectionOnlyKeys: Object.freeze([...diagnostic.backup.projectionOnlyKeys]),
      excludedKeys: Object.freeze([...diagnostic.backup.excludedKeys]),
    }),
    rawValuesExposed: false,
    storageWritesAllowed: false,
  });
}
