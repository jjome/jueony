import { findHitPosition, readFindText, type FindHit } from './basic-find.ts';
export type TextHit = FindHit;

/** Convert search locations without losing nested cell paths. Equation source text is
 * intentionally excluded: selecting its character offsets in the body is incorrect. */
export function hitPosition(hit: TextHit) {
  return findHitPosition(hit);
}
export function nextHitIndex(current: number, length: number, direction: 1 | -1): number {
  if (!length) return -1;
  if (current < 0) return direction === 1 ? 0 : length - 1;
  return (current + direction + length) % length;
}
export function searchExcerpt(wasm: any, hit: TextHit): string {
  const start = Math.max(0, hit.charOffset - 22), count = Math.min(hit.length + 44, 180);
  const text = readFindText(wasm, hit, start, count);
  return (start ? '…' : '') + text;
}
