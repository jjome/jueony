/** Cursor/model offsets are Unicode scalars, never JavaScript UTF-16 units.
 * Keep the editor's established word classes; do not silently switch to a
 * locale segmenter with different punctuation/Hangul deletion semantics.
 */
function characterClass(character: string): 'space' | 'hangul' | 'latin' | 'digit' | 'punctuation' {
  const code = character.codePointAt(0)!;
  if ([0x20, 0x09, 0x0a, 0x0d, 0xa0].includes(code)) return 'space';
  if (code >= 0xac00 && code <= 0xd7af || code >= 0x3131 && code <= 0x318e || code >= 0x1100 && code <= 0x11ff) return 'hangul';
  if (code >= 0x41 && code <= 0x5a || code >= 0x61 && code <= 0x7a) return 'latin';
  if (code >= 0x30 && code <= 0x39) return 'digit';
  return 'punctuation';
}

export function findWordBoundaryForward(text: string): number {
  const characters = Array.from(text);
  if (!characters.length) return 0;
  const first = characterClass(characters[0]);
  let offset = 0;
  while (offset < characters.length && characterClass(characters[offset]) === first) offset++;
  if (first !== 'space') while (offset < characters.length && characterClass(characters[offset]) === 'space') offset++;
  return offset;
}

export function findWordBoundaryBackward(text: string): number {
  const characters = Array.from(text);
  let offset = characters.length;
  while (offset > 0 && characterClass(characters[offset - 1]) === 'space') offset--;
  if (!offset) return 0;
  const last = characterClass(characters[offset - 1]);
  while (offset > 0 && characterClass(characters[offset - 1]) === last) offset--;
  return offset;
}

// Block-selection word grouping intentionally retains the existing policy:
// letters/digits/Hangul are a word, other characters form the adjacent group.
function isBlockWordCharacter(character: string): boolean {
  const code = character.codePointAt(0)!;
  return code >= 0x30 && code <= 0x39 || code >= 0x41 && code <= 0x5a || code >= 0x61 && code <= 0x7a
    || code >= 0xac00 && code <= 0xd7af || code >= 0x3131 && code <= 0x318e;
}

export function findWordAt(text: string, offset: number): { start: number; end: number } {
  const characters = Array.from(text);
  if (!characters.length || offset >= characters.length) return { start: offset, end: offset };
  const atWord = isBlockWordCharacter(characters[offset]);
  let start = offset, end = offset;
  while (start > 0 && isBlockWordCharacter(characters[start - 1]) === atWord) start--;
  while (end < characters.length && isBlockWordCharacter(characters[end]) === atWord) end++;
  return { start, end };
}

const sentenceTerminators = new Set(['.', '?', '!', '。', '？', '！']);
export function findSentenceAt(text: string, offset: number): { start: number; end: number } {
  const characters = Array.from(text);
  if (!characters.length) return { start: offset, end: offset };
  const clamped = Math.min(offset, characters.length);
  let start = clamped, end = clamped;
  while (start > 0 && !sentenceTerminators.has(characters[start - 1])) start--;
  while (start < clamped && (characters[start] === ' ' || characters[start] === '\t')) start++;
  while (end < characters.length) { if (sentenceTerminators.has(characters[end++])) break; }
  return { start, end };
}
