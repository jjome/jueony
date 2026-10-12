import type { BodyCaret } from '../public/contracts.ts';
export function validateBodyCaret(value: unknown): BodyCaret | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const item = value as Record<string, unknown>;
  for (const key of ['section', 'paragraph', 'offset', 'paragraphLength']) if (!Number.isSafeInteger(item[key]) || (item[key] as number) < 0 || (item[key] as number) > 2147483647) return;
  const { section, paragraph, offset, paragraphLength, before, after } = item as BodyCaret;
  if (offset > paragraphLength || typeof before !== 'string' || typeof after !== 'string'
    || [...before].length !== Math.min(offset, 32) || [...after].length !== Math.min(paragraphLength - offset, 32)) return;
  return { section, paragraph, offset, paragraphLength, before, after };
}
