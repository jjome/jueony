/** Only body section edges reach this adapter; ordinary deletes keep Studio's commands. */
export function mergeBodySectionBoundary(input: any, rightSection: number): void {
  const doc = input.wasm.borrowDocumentHandle();
  if (typeof doc?.mergeSectionBoundary !== 'function') return;
  if (input.isFormMode?.() || input.cursor.hasSelection?.()
    || input.cursor.isInHeaderFooter?.() || input.cursor.isInFootnote?.()
    || input.cursor.isInTextBox?.()) return;
  input.flushDeferredPaginationIfNeeded('section-boundary-merge');
  try {
    input.executeOperation({
      kind: 'snapshot', operationType: 'jueonySectionMerge',
      operation: (wasm: any) => {
        const value = wasm.borrowDocumentHandle().mergeSectionBoundary(rightSection);
        const result = typeof value === 'string' ? JSON.parse(value) : value;
        if (result?.ok !== true || !Number.isInteger(result.sectionIdx)
          || !Number.isInteger(result.paraIdx) || !Number.isInteger(result.charOffset))
          throw new Error('구역 경계 합치기 결과가 올바르지 않습니다.');
        return { sectionIndex: result.sectionIdx, paragraphIndex: result.paraIdx, charOffset: result.charOffset };
      },
      meta: { domain: 'page', refresh: 'full', dirtyScope: 'document' },
    });
  } catch (error) {
    // The native operation validates/stages before committing. Failed edges do not
    // enter history and retain the original cursor/document rather than hiding loss.
    const status = document.getElementById('sb-message');
    if (status) {
      status.textContent = `구역을 합치지 못했습니다: ${error instanceof Error ? error.message : String(error)}`;
      status.setAttribute('role', 'status');
    }
  }
}
