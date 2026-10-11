export type SettingsRecord = Record<string, unknown>;
export type Change = { path: string[]; remove: boolean; value?: unknown };

export function record(value: unknown): value is SettingsRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (record(a) && record(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
  }
  return false;
}
export function changes(before: unknown, after: unknown, path: string[] = []): Change[] {
  if (same(before, after)) return [];
  if (record(before) && record(after)) {
    const result: Change[] = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const at = [...path, key];
      if (!Object.hasOwn(after, key)) result.push({ path: at, remove: true });
      else if (!Object.hasOwn(before, key)) result.push({ path: at, remove: false, value: copy(after[key]) });
      else result.push(...changes(before[key], after[key], at));
    }
    return result;
  }
  return [{ path, remove: false, value: copy(after) }];
}
export function preferenceChangedPaths(before: unknown, after: unknown): string[] {
  return changes(before, after).map(change => change.path.join('.'));
}
function put(object: SettingsRecord, key: string, value: unknown): void {
  // Treat all persisted keys as data, including __proto__.
  Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true });
}
export function patched<T>(value: T, delta: Change[]): T {
  let result = copy(value);
  for (const change of delta) {
    if (!change.path.length) { result = copy(change.value) as T; continue; }
    if (!record(result)) result = {} as T;
    let cursor = result as SettingsRecord;
    for (const key of change.path.slice(0, -1)) {
      if (!Object.hasOwn(cursor, key) || !record(cursor[key])) put(cursor, key, {});
      cursor = cursor[key] as SettingsRecord;
    }
    const last = change.path[change.path.length - 1];
    if (change.remove) delete cursor[last]; else put(cursor, last, copy(change.value));
  }
  return result;
}
