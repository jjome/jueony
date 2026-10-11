import type { DocumentFitMode, DocumentViewState, BodyCaret } from '../public/contracts.ts';

export function validateBodyCaret(value: unknown): BodyCaret | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const item = value as Record<string, unknown>;
  for (const key of ['section', 'paragraph', 'offset', 'paragraphLength']) if (!Number.isSafeInteger(item[key]) || (item[key] as number) < 0 || (item[key] as number) > 2147483647) return;
  const { section, paragraph, offset, paragraphLength, before, after } = item as BodyCaret;
  if (offset > paragraphLength || typeof before !== 'string' || typeof after !== 'string'
    || [...before].length !== Math.min(offset, 32) || [...after].length !== Math.min(paragraphLength - offset, 32)) return;
  return { section, paragraph, offset, paragraphLength, before, after };
}

export function validateDocumentView(value: unknown): DocumentViewState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (item.version !== 1 || typeof item.zoom !== 'number' || !Number.isFinite(item.zoom) || item.zoom < 0.1 || item.zoom > 5) return undefined;
  if (!['none', 'fitWidth', 'fitPage'].includes(item.fitMode as string)) return undefined;
  for (const key of ['scrollX', 'scrollY']) if (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || (item[key] as number) < 0 || (item[key] as number) > 2147483647) return undefined;
  const caret = validateBodyCaret(item.caret);
  return { version: 1, zoom: item.zoom, fitMode: item.fitMode as DocumentFitMode, scrollX: item.scrollX as number, scrollY: item.scrollY as number, ...(caret ? { caret } : {}) };
}
