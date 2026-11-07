interface NamedFile {
  name: string;
  isSameEntry?(other: NamedFile): Promise<boolean>;
}

function sameName(a: string, b: string): boolean {
  return a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase();
}

export function directionCopyName(suggestedHwpx: string, originalName: string, handle: NamedFile | null): string {
  if (sameName(suggestedHwpx, originalName) || (handle && sameName(suggestedHwpx, handle.name))) {
    return suggestedHwpx.slice(0, -'.hwpx'.length) + ' (글 방향 보존).hwpx';
  }
  return suggestedHwpx;
}

/** Compare native entry identity when known. Files opened by drop may only have a name. */
export async function requireDistinctDirectionCopy(target: NamedFile, originalName: string, original: NamedFile | null) {
  if (original ? target === original || await target.isSameEntry?.(original) !== false : sameName(target.name, originalName)) {
    throw new Error('원본 파일과 다른 파일을 저장 대상으로 선택해 주세요.');
  }
}
