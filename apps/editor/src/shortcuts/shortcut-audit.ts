import { keyContextPriority, type Binding, type Scope } from './keymap.ts';

export type ShortcutAuditSeverity = 'error' | 'warning' | 'info';
export type ShortcutAuditCategory =
  | 'duplicate'
  | 'context-conflict'
  | 'context-override'
  | 'prefix-shadow'
  | 'pending'
  | 'repeat-policy'
  | 'unregistered'
  | 'context-model';

export type ShortcutAuditFinding = {
  id: string;
  severity: ShortcutAuditSeverity;
  category: ShortcutAuditCategory;
  keys?: string;
  commands: string[];
  scopes: string[];
  detail: string;
};

const specialScopes: Scope[] = ['table', 'cells', 'object'];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Pure, side-effect-free audit of the effective Hangul shortcut matrix.
 *
 * This deliberately does not know about the UI or command registry. Consumers
 * can run it in node tests and pass an optional registry snapshot separately.
 */
export function auditShortcutMatrix(bindings: readonly Binding[]): ShortcutAuditFinding[] {
  const findings: ShortcutAuditFinding[] = [];
  const byScopeAndKeys = new Map<string, Binding[]>();
  const byKeys = new Map<string, Binding[]>();

  for (const item of bindings) {
    const scopeKey = `${item.scope}\u0000${item.keys}`;
    byScopeAndKeys.set(scopeKey, [...(byScopeAndKeys.get(scopeKey) ?? []), item]);
    byKeys.set(item.keys, [...(byKeys.get(item.keys) ?? []), item]);
  }

  for (const [, matches] of byScopeAndKeys) {
    if (matches.length < 2) continue;
    const first = matches[0]!;
    findings.push({
      id: `N021-DUPLICATE-${slug(first.scope)}-${slug(first.keys)}`,
      severity: 'error',
      category: 'duplicate',
      keys: first.keys,
      commands: matches.map(item => item.command),
      scopes: [first.scope],
      detail: '같은 scope와 키에 둘 이상의 명령이 있어 뒤쪽 항목은 안정적으로 선택될 수 없습니다.',
    });
  }

  for (const [keys, matches] of byKeys) {
    const activeSpecial = unique(matches.map(item => item.scope).filter(scope => scope !== 'document')) as Scope[];
    if (activeSpecial.length > 1) {
      const specialMatches = matches.filter(item => item.scope !== 'document');
      findings.push({
        id: `N021-CONTEXT-PRECEDENCE-${slug(keys)}`,
        severity: 'info',
        category: 'context-override',
        keys,
        commands: specialMatches.map(item => item.command),
        scopes: activeSpecial,
        detail: `여러 특수 scope가 동시에 참이면 명시된 우선순위(${keyContextPriority.join(' > ')})로 명령을 선택합니다.`,
      });
    }

    const documentMatches = matches.filter(item => item.scope === 'document');
    const scopedMatches = matches.filter(item => item.scope !== 'document');
    if (documentMatches.length && scopedMatches.length) {
      findings.push({
        id: `N021-CONTEXT-OVERRIDE-${slug(keys)}`,
        severity: 'info',
        category: 'context-override',
        keys,
        commands: matches.map(item => item.command),
        scopes: unique(matches.map(item => item.scope)),
        detail: '특수 scope 명령이 document 명령보다 우선하는 의도적 문맥 override 후보입니다.',
      });
    }
  }

  const exactKeys = new Set(bindings.map(item => item.keys));
  const prefixes = new Map<string, Binding[]>();
  for (const item of bindings) {
    const comma = item.keys.indexOf(',');
    if (comma < 0) continue;
    const prefix = item.keys.slice(0, comma);
    prefixes.set(prefix, [...(prefixes.get(prefix) ?? []), item]);
  }
  for (const [prefix, chordBindings] of prefixes) {
    if (!exactKeys.has(prefix)) continue;
    const exact = bindings.filter(item => item.keys === prefix);
    findings.push({
      id: `N021-PREFIX-SHADOW-${slug(prefix)}`,
      severity: 'error',
      category: 'prefix-shadow',
      keys: prefix,
      commands: [...exact, ...chordBindings].map(item => item.command),
      scopes: unique([...exact, ...chordBindings].map(item => item.scope)),
      detail: '정확 일치 단축키가 연속키 prefix보다 먼저 해석되어 연속키가 도달 불가능합니다.',
    });
  }

  for (const item of bindings.filter(item => item.command.startsWith('pending:'))) {
    findings.push({
      id: `N021-PENDING-${slug(item.command.slice('pending:'.length))}`,
      severity: 'warning',
      category: 'pending',
      keys: item.keys,
      commands: [item.command],
      scopes: [item.scope],
      detail: '예약된 단축키이며 실제 명령 registry에는 연결되지 않습니다.',
    });
  }

  const byCommand = new Map<string, Binding[]>();
  for (const item of bindings) byCommand.set(item.command, [...(byCommand.get(item.command) ?? []), item]);
  for (const [command, matches] of byCommand) {
    const policies = new Set(matches.map(item => item.repeatable === true));
    if (policies.size < 2) continue;
    findings.push({
      id: `N021-REPEAT-POLICY-${slug(command)}`,
      severity: 'warning',
      category: 'repeat-policy',
      commands: [command],
      scopes: unique(matches.map(item => item.scope)),
      detail: '같은 명령의 키 반복 허용 정책이 binding마다 다릅니다.',
    });
  }
  return findings;
}

export function auditCommandReachability(
  bindings: readonly Binding[],
  registeredCommandIds: ReadonlySet<string>,
): ShortcutAuditFinding[] {
  const findings: ShortcutAuditFinding[] = [];
  for (const item of bindings) {
    if (item.command.startsWith('pending:') || registeredCommandIds.has(item.command)) continue;
    findings.push({
      id: `N021-UNREGISTERED-${slug(item.scope)}-${slug(item.keys)}-${slug(item.command)}`,
      severity: 'error',
      category: 'unregistered',
      keys: item.keys,
      commands: [item.command],
      scopes: [item.scope],
      detail: '유효 단축키가 전달받은 command registry snapshot에 없습니다.',
    });
  }
  return findings;
}

export function auditRequiredContexts(
  declaredScopes: readonly string[],
  requiredContexts: readonly string[],
): ShortcutAuditFinding[] {
  const declared = new Set(declaredScopes);
  return requiredContexts.filter(context => !declared.has(context)).map(context => ({
    id: `N021-CONTEXT-MODEL-MISSING-${slug(context)}`,
    severity: 'warning' as const,
    category: 'context-model' as const,
    commands: [],
    scopes: [context],
    detail: 'KeyContext가 이 문서 story를 표현하지 못해 허용/차단 판단이 command canExecute에 암묵 위임됩니다.',
  }));
}

export const effectiveSpecialScopes = [...specialScopes] as const;
