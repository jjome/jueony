type Properties = Record<string, unknown>;
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = Object.keys(a), right = Object.keys(b);
  return left.length === right.length && left.every(k => Object.hasOwn(b, k) && equal((a as Properties)[k], (b as Properties)[k]));
}
/** Compare displayed form values, retaining the exact native value behind an
 * unchanged rounded input. Only user changes become engine writes. */
export function changedDialogProperties(initial: Properties, current: Properties, original: Properties): Properties {
  return Object.fromEntries(Object.entries(current).filter(([key, value]) =>
    !(Object.hasOwn(initial, key) && equal(value, initial[key])) &&
    !(Object.hasOwn(original, key) && equal(value, original[key]))
  ).map(([key, value]) => [key, structuredClone(value)]));
}
