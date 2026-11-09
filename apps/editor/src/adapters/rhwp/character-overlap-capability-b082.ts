export const characterOverlapRequiredMethodsB082 = [
  'getCharOverlapListV1',
  'insertCharOverlapAtSelectionV1',
  'removeCharOverlapV1',
  'saveSnapshot',
  'restoreSnapshot',
  'discardSnapshot',
] as const;

export type CharacterOverlapRequiredMethodB082 = typeof characterOverlapRequiredMethodsB082[number];

export interface CharacterOverlapHostB082 {
  getCharOverlapListV1(): unknown;
  insertCharOverlapAtSelectionV1(
    section: number,
    paragraph: number,
    start: number,
    end: number,
    borderType: number,
    innerCharSize: number,
  ): unknown;
  removeCharOverlapV1(section: number, paragraph: number, controlIndex: number): unknown;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
}

export type CharacterOverlapCapabilityB082 =
  | {
    readonly supported: true;
    readonly model: 'rhwp-char-overlap-control';
    readonly scope: 'body-single-range-2-4-scalars';
    readonly formats: readonly ['hwp', 'hwpx'];
  }
  | {
    readonly supported: false;
    readonly reason: 'api-unavailable';
    readonly missing: readonly CharacterOverlapRequiredMethodB082[];
  };

/**
 * B082 must never degrade a real CharOverlap control into ordinary characters.
 * The adapter therefore exposes support only when the complete native
 * query/mutation/history contract is present on one document instance.
 */
export function auditCharacterOverlapCapabilityB082(
  host: Partial<CharacterOverlapHostB082> | null | undefined,
): CharacterOverlapCapabilityB082 {
  const candidate = host && typeof host === 'object' ? host as unknown as Record<string, unknown> : {};
  const missing = characterOverlapRequiredMethodsB082.filter(name => typeof candidate[name] !== 'function');
  return missing.length === 0
    ? {
      supported: true,
      model: 'rhwp-char-overlap-control',
      scope: 'body-single-range-2-4-scalars',
      formats: ['hwp', 'hwpx'],
    }
    : {supported: false, reason: 'api-unavailable', missing};
}
