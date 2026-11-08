export type MenuReachabilityEntry = {
  surface: 'menu' | 'ribbon' | 'quick-access' | 'context-menu';
  location: string;
  commandId: string;
  /** Same command with different fixed params/conditional branches is a distinct reachability route. */
  variant?: string;
  staticallyDisabled?: boolean;
};

export type MenuReachabilityFinding = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'duplicate' | 'unregistered' | 'placeholder' | 'static-disabled';
  commandId: string;
  surfaces: string[];
  detail: string;
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

export function auditMenuReachability(
  entries: readonly MenuReachabilityEntry[],
  registeredCommandIds: ReadonlySet<string>,
  placeholderCommandIds: ReadonlySet<string> = new Set(),
): MenuReachabilityFinding[] {
  const findings: MenuReachabilityFinding[] = [];
  const byLocation = new Map<string, MenuReachabilityEntry[]>();
  for (const entry of entries) {
    const key = `${entry.surface}\u0000${entry.location}\u0000${entry.commandId}\u0000${entry.variant ?? ''}`;
    byLocation.set(key, [...(byLocation.get(key) ?? []), entry]);
  }
  for (const matches of byLocation.values()) {
    if (matches.length < 2) continue;
    const first = matches[0]!;
    findings.push({
      id: `N019-DUPLICATE-${slug(first.surface)}-${slug(first.location)}-${slug(first.commandId)}`,
      severity: 'warning',
      category: 'duplicate',
      commandId: first.commandId,
      surfaces: [first.surface],
      detail: '동일한 UI 위치에 같은 명령이 두 번 이상 선언되어 있습니다.',
    });
  }

  const uniqueEntries = new Map<string, MenuReachabilityEntry>();
  for (const entry of entries) uniqueEntries.set(`${entry.surface}\u0000${entry.location}\u0000${entry.commandId}\u0000${entry.variant ?? ''}`, entry);
  for (const entry of uniqueEntries.values()) {
    if (!registeredCommandIds.has(entry.commandId)) {
      findings.push({
        id: `N019-UNREGISTERED-${slug(entry.surface)}-${slug(entry.location)}-${slug(entry.commandId)}`,
        severity: 'error',
        category: 'unregistered',
        commandId: entry.commandId,
        surfaces: [entry.surface],
        detail: '정적 UI 항목이 command registry manifest에 없는 명령을 가리킵니다.',
      });
      continue;
    }
    if (placeholderCommandIds.has(entry.commandId)) {
      findings.push({
        id: `N019-PLACEHOLDER-${slug(entry.surface)}-${slug(entry.location)}-${slug(entry.commandId)}`,
        severity: 'warning',
        category: 'placeholder',
        commandId: entry.commandId,
        surfaces: [entry.surface],
        detail: '명령은 등록되어 있지만 canExecute=false placeholder로 선언되어 있습니다.',
      });
    } else if (entry.staticallyDisabled) {
      findings.push({
        id: `N019-STATIC-DISABLED-${slug(entry.surface)}-${slug(entry.location)}-${slug(entry.commandId)}`,
        severity: 'info',
        category: 'static-disabled',
        commandId: entry.commandId,
        surfaces: [entry.surface],
        detail: '정적 마크업은 disabled이며 런타임 command-state 갱신에 의존합니다.',
      });
    }
  }
  return findings;
}

export function findCrossSurfaceCommands(entries: readonly MenuReachabilityEntry[]): Map<string, string[]> {
  const surfaces = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!surfaces.has(entry.commandId)) surfaces.set(entry.commandId, new Set());
    surfaces.get(entry.commandId)!.add(entry.surface);
  }
  return new Map([...surfaces].filter(([, values]) => values.size > 1).map(([id, values]) => [id, [...values].sort()]));
}
