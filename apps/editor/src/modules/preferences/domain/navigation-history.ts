/** Memory-only navigation policy. Values are owned snapshots supplied by the adapter. */
export function createNavigationHistory<T>(key: (value: T) => string, limit = 64) {
  if (!Number.isSafeInteger(limit) || limit < 2 || limit > 256) throw new Error('Invalid navigation history limit.');
  let entries: { key: string; value: T }[] = [], index = -1;
  function target(direction: -1 | 1) {
    if (direction !== -1 && direction !== 1) throw new Error('Invalid navigation direction.');
    const next = index + direction;
    return next >= 0 && next < entries.length ? next : undefined;
  }
  return {
    record(value: T): boolean {
      const identity = key(value);
      if (entries[index]?.key === identity) return false;
      entries = entries.slice(0, index + 1);
      entries.push({ key: identity, value });
      if (entries.length > limit) entries.shift();
      index = entries.length - 1;
      return true;
    },
    peek(direction: -1 | 1): T | undefined {
      const next = target(direction); return next === undefined ? undefined : entries[next].value;
    },
    accept(direction: -1 | 1): boolean {
      const next = target(direction); if (next === undefined) return false;
      index = next; return true;
    },
    discard(direction: -1 | 1): boolean {
      const next = target(direction); if (next === undefined) return false;
      entries.splice(next, 1); if (next < index) index--;
      return true;
    },
    clear() { entries = []; index = -1; },
    current: () => entries[index]?.value,
    state: () => ({ size: entries.length, index, previous: index > 0, next: index >= 0 && index < entries.length - 1 }),
  };
}
