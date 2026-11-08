export type PageOutlineViewChange = Readonly<{
  pageOutline: boolean;
}>;

export type PageOutlineViewTogglePort = Readonly<{
  read(): unknown;
  write(value: boolean): void;
  publish(change: PageOutlineViewChange): void;
}>;

/**
 * Normalize only the display preference. Missing legacy values keep the
 * caller's default; document state is deliberately not part of this port.
 */
export function normalizePageOutlineView(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Toggle the app-wide page-outline view preference and publish one renderer
 * transaction. The deliberately narrow port cannot touch document history,
 * revision, dirty state, or serialized bytes.
 */
export function togglePageOutlineView(port: PageOutlineViewTogglePort): boolean {
  const next = !normalizePageOutlineView(port.read());
  port.write(next);
  port.publish({ pageOutline: next });
  return next;
}
