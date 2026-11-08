/** Default Hangul style keys. User assignments live outside the document engine. */
export const defaultStyleNames = ['바탕글', '본문', ...Array.from({ length: 8 }, (_, i) => `개요 ${i + 1}`)];

export type StyleSlotAssignment = { slot: number; styleName: string };

const validStyle = (style: { id: number; name: string }) => Number.isSafeInteger(style.id) && style.id >= 0 && typeof style.name === 'string';
const normalizedName = (name: string) => name.normalize('NFC');

/**
 * Resolve a user slot without ever falling back to a different style when the
 * assigned definition was deleted or became ambiguous.  Passing no assignment
 * retains the Hangul 2024 default Ctrl+1..Ctrl+0 mapping.
 */
export function resolveStyleSlot(styles: readonly { id: number; name: string }[], slot: unknown, assignments: readonly StyleSlotAssignment[] = []): number | undefined {
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= defaultStyleNames.length) return;
  const assigned = assignments.filter(value => value?.slot === slot);
  if (assigned.length > 1) return;
  if (assigned.length === 1) {
    const name = typeof assigned[0].styleName === 'string' ? normalizedName(assigned[0].styleName) : '';
    if (!name) return;
    const matches = styles.filter(style => validStyle(style) && normalizedName(style.name) === name);
    return matches.length === 1 ? matches[0].id : undefined;
  }
  const name = defaultStyleNames[slot].replace(/\s/g, '');
  const matches = styles.filter(style => validStyle(style) && style.name.replace(/\s/g, '') === name);
  return matches.length === 1 ? matches[0].id : undefined;
}

export function resolveDefaultStyle(styles: readonly { id: number; name: string }[], slot: unknown): number | undefined {
  return resolveStyleSlot(styles, slot);
}
