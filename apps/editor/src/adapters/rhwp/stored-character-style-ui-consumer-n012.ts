import type { StoredCharacterStyleReference } from '../../modules/document/public/character-style-reference.ts';
import { captureStoredCharacterStyle, verifyStoredCharacterStyle } from './character-style-reference.ts';
import { applySelectedCharacterStyle } from './style-flow.ts';

export type StoredCharacterStyleUiTokenN012 = Readonly<{
  kind: 'stored-character-style-ui-selection';
  version: 1;
  reference: StoredCharacterStyleReference;
}>;

export type StoreCharacterStyleUiResultN012 =
  | Readonly<{ status: 'stored'; token: StoredCharacterStyleUiTokenN012 }>
  | Readonly<{ status: 'rejected'; reason: 'definition-missing-or-ambiguous' }>;

export type ConsumeCharacterStyleUiResultN012 =
  | Readonly<{ status: 'applied' }>
  | Readonly<{ status: 'no-selection' }>
  | Readonly<{
      status: 'rejected';
      reason: 'invalid-token' | 'definition-stale-or-missing' | 'application-rejected';
    }>;

const index = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffff;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function reference(value: unknown): StoredCharacterStyleReference | undefined {
  if (!record(value)) return;
  if (
    value.kind !== 'stored-character-style'
    || value.version !== 1
    || !index(value.styleId)
    || value.styleId > 255
    || !index(value.charShapeId)
    || typeof value.definitionSha256 !== 'string'
    || !/^[0-9a-f]{64}$/u.test(value.definitionSha256)
  ) return;
  return Object.freeze({
    kind: 'stored-character-style',
    version: 1,
    styleId: value.styleId,
    charShapeId: value.charShapeId,
    definitionSha256: value.definitionSha256,
  });
}

function token(value: unknown): StoredCharacterStyleUiTokenN012 | undefined {
  if (!record(value) || value.kind !== 'stored-character-style-ui-selection' || value.version !== 1) return;
  const stored = reference(value.reference);
  if (!stored) return;
  return Object.freeze({
    kind: 'stored-character-style-ui-selection',
    version: 1,
    reference: stored,
  });
}

/**
 * Captures the definition identity when a UI keeps a character-style choice.
 * No native definition or visible formatting object is retained in the token.
 */
export function storeCharacterStyleUiSelectionN012(
  document: unknown,
  styleId: number,
): StoreCharacterStyleUiResultN012 {
  try {
    const captured = captureStoredCharacterStyle(document, styleId);
    return {
      status: 'stored',
      token: Object.freeze({
        kind: 'stored-character-style-ui-selection',
        version: 1,
        reference: Object.freeze({ ...captured }),
      }),
    };
  } catch {
    return { status: 'rejected', reason: 'definition-missing-or-ambiguous' };
  }
}

/**
 * Resolves a previously stored UI choice against the live document immediately
 * before applying it.  The existing adapter repeats the same verification at
 * transaction entry and again inside the snapshot operation, closing the race
 * between UI consumption and the first native write.
 */
export function consumeCharacterStyleUiSelectionN012(
  input: unknown,
  document: unknown,
  value: unknown,
): ConsumeCharacterStyleUiResultN012 {
  const stored = token(value);
  if (!stored) return { status: 'rejected', reason: 'invalid-token' };
  try {
    verifyStoredCharacterStyle(document, stored.reference);
  } catch {
    return { status: 'rejected', reason: 'definition-stale-or-missing' };
  }
  try {
    const applied = applySelectedCharacterStyle(input, document, stored.reference);
    return applied ? { status: 'applied' } : { status: 'no-selection' };
  } catch {
    return { status: 'rejected', reason: 'application-rejected' };
  }
}
