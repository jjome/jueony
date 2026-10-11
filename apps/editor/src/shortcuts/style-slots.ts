/** Default Hangul style keys. Custom document shortcut assignments are not exposed by the engine. */
export const defaultStyleNames = ['바탕글', '본문', ...Array.from({ length: 8 }, (_, i) => `개요 ${i + 1}`)];

export function resolveDefaultStyle(styles: readonly { id: number; name: string }[], slot: unknown): number | undefined {
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= defaultStyleNames.length) return;
  const name = defaultStyleNames[slot].replace(/\s/g, '');
  const matches = styles.filter(style => style.name.replace(/\s/g, '') === name);
  if (matches.length !== 1 || !Number.isSafeInteger(matches[0].id) || matches[0].id < 0) return;
  return matches[0].id;
}
