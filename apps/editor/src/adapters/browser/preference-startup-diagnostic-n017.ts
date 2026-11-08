import {
  SETTINGS_BACKUP_KEYS,
  preferenceLifetimeContracts,
  type PreferenceBackup,
  type PreferenceLifetimeContract,
  type PreferenceScope,
  type PreferenceStorage,
  type PreferenceValidation,
  type PreferenceVersion,
} from '../../modules/preferences/public/index.ts';
import {
  auditPreferenceLifetimes,
  type PreferenceLifetimeAuditResult,
  type PreferenceLifetimeAuditStatus,
} from './preference-lifetime-audit.ts';

export type PreferenceStartupDecisionN017 =
  | 'use-stored-value'
  | 'use-default-in-memory'
  | 'preserve-and-review'
  | 'preserve-and-upgrade'
  | 'preserve-and-retry-read';

export type PreferenceStartupStateN017 = 'ready' | 'defaults-in-memory' | 'blocked';

export type PreferenceStartupItemN017 = Readonly<{
  id: string;
  key: string;
  scopes: readonly PreferenceScope[];
  backup: PreferenceBackup;
  status: PreferenceLifetimeAuditStatus;
  decision: PreferenceStartupDecisionN017;
  automaticWriteAllowed: false;
}>;

export type PreferenceStartupDiagnosticN017 = Readonly<{
  schema: 'n017-stable-preferences-v1';
  state: PreferenceStartupStateN017;
  automaticRepair: 'forbidden';
  items: readonly PreferenceStartupItemN017[];
  counts: Readonly<Record<PreferenceLifetimeAuditStatus, number>>;
  scopes: Readonly<Record<PreferenceScope, readonly string[]>>;
  backup: Readonly<{
    defaultPolicy: 'excluded';
    approvedKeys: readonly string[];
    includedKeys: readonly string[];
    projectionOnlyKeys: readonly string[];
    excludedKeys: readonly string[];
  }>;
}>;

type ExpectedContractN017 = Readonly<{
  id: string;
  scopes: readonly PreferenceScope[];
  reset: PreferenceLifetimeContract['reset'];
  backup: PreferenceBackup;
  validation: PreferenceValidation;
  version: PreferenceVersion;
}>;

/**
 * Deliberately closed list. A new or changed persistent preference must update
 * this startup boundary before it can silently participate in restore/backup.
 */
const expectedContractsN017: Readonly<Record<string, ExpectedContractN017>> = Object.freeze({
  'rhwp-settings': { id: 'studio-settings', scopes: ['user'], reset: 'explicit', backup: 'projection-only', validation: 'projection-only', version: 'optional-v1' },
  'jueony-document-defaults': { id: 'document-defaults', scopes: ['user'], reset: 'explicit', backup: 'included', validation: 'full', version: 'v1' },
  'jueony-editor-chrome-v1': { id: 'editor-chrome', scopes: ['user'], reset: 'explicit', backup: 'included', validation: 'full', version: 'v1' },
  'jueony-style-panel': { id: 'legacy-style-panel', scopes: ['user'], reset: 'migration-only', backup: 'included', validation: 'legacy', version: 'unversioned' },
  'jueony-recent-fonts-v1': { id: 'recent-fonts', scopes: ['user'], reset: 'bounded-history', backup: 'excluded', validation: 'full', version: 'v1' },
  'jueony-calendar-format': { id: 'calendar-format', scopes: ['user'], reset: 'explicit', backup: 'excluded', validation: 'full', version: 'v1' },
  'jueony-common-snippets': { id: 'snippets', scopes: ['user'], reset: 'explicit', backup: 'excluded', validation: 'full', version: 'v1' },
  'jueony-document-view-journal-v1': { id: 'document-view-journal', scopes: ['workspace', 'document'], reset: 'document-lifecycle', backup: 'excluded', validation: 'full', version: 'v1' },
});

export class PreferenceStartupContractErrorN017 extends Error {
  readonly code = 'n017-contract-drift';
  constructor(message: string) {
    super(message);
    this.name = 'PreferenceStartupContractErrorN017';
  }
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function fail(message: string): never {
  throw new PreferenceStartupContractErrorN017(message);
}

/**
 * Validates the complete stable schema and the exact backup allow-list.
 * Unknown or changed keys are excluded by failure, never inferred as safe.
 */
export function assertPreferenceStartupContractN017(
  contracts: readonly PreferenceLifetimeContract[] = preferenceLifetimeContracts,
  backupKeys: readonly string[] = SETTINGS_BACKUP_KEYS,
): void {
  const expectedKeys = Object.keys(expectedContractsN017);
  const actualKeys = contracts.map(contract => contract.key);
  if (new Set(actualKeys).size !== actualKeys.length) fail('설정 수명 계약에 중복 키가 있습니다.');
  if (actualKeys.length !== expectedKeys.length || !expectedKeys.every(key => actualKeys.includes(key))) {
    fail('N017 안정 설정 키 목록이 변경되었습니다. 시작 진단 계약을 먼저 갱신하세요.');
  }

  for (const contract of contracts) {
    const expected = expectedContractsN017[contract.key];
    if (!expected) fail(`알 수 없는 안정 설정 키가 있습니다: ${contract.key}`);
    if (
      contract.id !== expected.id
      || !sameValues(contract.scope, expected.scopes)
      || contract.medium !== 'localStorage'
      || contract.survivesRestart !== true
      || contract.reset !== expected.reset
      || contract.documentDirty !== false
      || contract.documentUndo !== false
      || contract.backup !== expected.backup
      || contract.validation !== expected.validation
      || contract.version !== expected.version
    ) fail(`N017 설정 수명 계약이 변경되었습니다: ${contract.key}`);
  }

  if (new Set(backupKeys).size !== backupKeys.length) fail('환경 백업 허용 목록에 중복 키가 있습니다.');
  const approved = contracts.filter(contract => contract.backup !== 'excluded').map(contract => contract.key);
  if (backupKeys.length !== approved.length || !approved.every(key => backupKeys.includes(key))) {
    fail('환경 백업 허용 목록이 설정 수명 계약과 다릅니다.');
  }
  if (contracts.some(contract => contract.backup === 'excluded' && backupKeys.includes(contract.key))) {
    fail('백업 제외 설정이 허용 목록에 포함되었습니다.');
  }
}

function decision(status: PreferenceLifetimeAuditStatus): PreferenceStartupDecisionN017 {
  switch (status) {
    case 'valid': return 'use-stored-value';
    case 'missing': return 'use-default-in-memory';
    case 'corrupt': return 'preserve-and-review';
    case 'unsupported-version': return 'preserve-and-upgrade';
    case 'read-error': return 'preserve-and-retry-read';
  }
}

function state(results: readonly PreferenceLifetimeAuditResult[]): PreferenceStartupStateN017 {
  if (results.some(result => result.status === 'corrupt' || result.status === 'unsupported-version' || result.status === 'read-error')) return 'blocked';
  return results.some(result => result.status === 'missing') ? 'defaults-in-memory' : 'ready';
}

/**
 * Startup-only, read-only diagnostic. Missing records use runtime defaults but
 * are not materialized. Invalid/future/unreadable records are preserved and
 * block persisted preference activation until explicit user action.
 */
export function diagnosePreferenceStartupN017(
  storage: Pick<PreferenceStorage, 'getItem'>,
): PreferenceStartupDiagnosticN017 {
  assertPreferenceStartupContractN017();
  const results = auditPreferenceLifetimes(storage);
  const expectedKeys = new Set(Object.keys(expectedContractsN017));
  if (results.length !== expectedKeys.size || results.some(result => !expectedKeys.has(result.contract.key))) {
    fail('읽기 전용 감사 결과가 N017 안정 설정 스키마와 다릅니다.');
  }

  const items = results.map<PreferenceStartupItemN017>(result => Object.freeze({
    id: result.contract.id,
    key: result.contract.key,
    scopes: Object.freeze([...result.contract.scope]),
    backup: result.contract.backup,
    status: result.status,
    decision: decision(result.status),
    automaticWriteAllowed: false,
  }));

  const counts: Record<PreferenceLifetimeAuditStatus, number> = {
    missing: 0,
    valid: 0,
    corrupt: 0,
    'unsupported-version': 0,
    'read-error': 0,
  };
  for (const item of items) counts[item.status] += 1;

  const scopeKeys = (scope: PreferenceScope): readonly string[] => Object.freeze(
    items.filter(item => item.scopes.includes(scope)).map(item => item.key),
  );
  const keysByBackup = (backup: PreferenceBackup): readonly string[] => Object.freeze(
    items.filter(item => item.backup === backup).map(item => item.key),
  );

  return Object.freeze({
    schema: 'n017-stable-preferences-v1',
    state: state(results),
    automaticRepair: 'forbidden',
    items: Object.freeze(items),
    counts: Object.freeze(counts),
    scopes: Object.freeze({ user: scopeKeys('user'), workspace: scopeKeys('workspace'), document: scopeKeys('document') }),
    backup: Object.freeze({
      defaultPolicy: 'excluded',
      approvedKeys: Object.freeze([...SETTINGS_BACKUP_KEYS]),
      includedKeys: keysByBackup('included'),
      projectionOnlyKeys: keysByBackup('projection-only'),
      excludedKeys: keysByBackup('excluded'),
    }),
  });
}
