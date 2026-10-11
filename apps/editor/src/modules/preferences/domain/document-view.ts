import type { DocumentFitMode, DocumentViewState } from '../public/contracts.ts';

export function validateDocumentView(value: unknown): DocumentViewState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (item.version !== 1 || typeof item.zoom !== 'number' || !Number.isFinite(item.zoom) || item.zoom < 0.1 || item.zoom > 5) return undefined;
  if (!['none', 'fitWidth', 'fitPage'].includes(item.fitMode as string)) return undefined;
  for (const key of ['scrollX', 'scrollY']) if (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || (item[key] as number) < 0 || (item[key] as number) > 2147483647) return undefined;
  return { version: 1, zoom: item.zoom, fitMode: item.fitMode as DocumentFitMode, scrollX: item.scrollX as number, scrollY: item.scrollY as number };
}
