type Position = {
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
  parentParaIndex?: number;
  controlIndex?: number;
  cellIndex?: number;
  cellParaIndex?: number;
  cellPath?: unknown;
};

export type ClearCharacterStyleRange = { start: Position; end: Position };

export type ClearCharacterStylePlan = {
  range: ClearCharacterStyleRange;
  paragraphLength: number;
  paragraphText: string;
  selectedText: string;
  styleId: number;
  styleDefinition: string;
  sourceCharShapeId: number;
  targetCharShapeId: number;
};

const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const parsed = (value: unknown): any => typeof value === 'string' ? JSON.parse(value) : value;
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const copyRange = (range: ClearCharacterStyleRange): ClearCharacterStyleRange => ({
  start: { ...range.start }, end: { ...range.end },
});

function bodyPosition(value: Position): boolean {
  return integer(value.sectionIndex) && integer(value.paragraphIndex) && integer(value.charOffset)
    && value.parentParaIndex === undefined && value.controlIndex === undefined
    && value.cellIndex === undefined && value.cellParaIndex === undefined && value.cellPath === undefined;
}

function checked(result: unknown): void {
  const value = parsed(result);
  if (!value || value.ok !== true) throw new Error('글자 스타일을 해제하지 못했습니다.');
}

function rangeRuns(document: any, plan: Pick<ClearCharacterStylePlan, 'range'>): any[] {
  const { start, end } = plan.range;
  const runs = parsed(document.getCharShapeRuns(
    start.sectionIndex, start.paragraphIndex, start.charOffset, end.charOffset,
  ));
  if (!Array.isArray(runs) || runs.length !== 1) {
    throw new Error('서로 다른 글자 서식이 섞인 선택은 글자 스타일을 안전하게 해제할 수 없습니다.');
  }
  const run = runs[0];
  if (!integer(run?.startOffset) || !integer(run?.endOffset) || !integer(run?.charShapeId)
      || run.startOffset !== start.charOffset || run.endOffset !== end.charOffset) {
    throw new Error('선택 범위의 글자 서식 경계를 확인하지 못했습니다.');
  }
  return runs;
}

/**
 * Reads the only range for which Ctrl+- can be mapped without guessing:
 * one non-empty root-body paragraph whose text and character-shape run are exact.
 * Cell/special-story and mixed-run selections stay fail-closed.
 */
export function readClearCharacterStylePlan(document: any, source: ClearCharacterStyleRange): ClearCharacterStylePlan {
  const range = copyRange(source), { start, end } = range;
  if (!bodyPosition(start) || !bodyPosition(end)
      || start.sectionIndex !== end.sectionIndex || start.paragraphIndex !== end.paragraphIndex
      || end.charOffset <= start.charOffset) {
    throw new Error('한 문단 안의 일반 본문 글자를 선택해 주세요.');
  }

  const paragraphLength = document.getParagraphLength(start.sectionIndex, start.paragraphIndex);
  if (!integer(paragraphLength) || end.charOffset > paragraphLength) {
    throw new Error('선택 범위가 현재 문단과 일치하지 않습니다.');
  }
  const paragraphText = document.getTextRange(start.sectionIndex, start.paragraphIndex, 0, paragraphLength);
  const selectedText = document.getTextRange(
    start.sectionIndex, start.paragraphIndex, start.charOffset, end.charOffset - start.charOffset,
  );
  if (typeof paragraphText !== 'string' || typeof selectedText !== 'string'
      || Array.from(paragraphText).length !== paragraphLength
      || Array.from(selectedText).length !== end.charOffset - start.charOffset) {
    throw new Error('선택 원문에 일반 글자가 아닌 컨트롤이 포함되어 있습니다.');
  }

  const runs = rangeRuns(document, { range });
  const currentStyle = parsed(document.getStyleAt(start.sectionIndex, start.paragraphIndex));
  const styles = parsed(document.getStyleList());
  if (!Array.isArray(styles) || styles.length < 1 || styles.length > 256 || !integer(currentStyle?.id)) {
    throw new Error('문단 스타일 정의를 확인하지 못했습니다.');
  }
  const style = styles.find((item: any) => item?.id === currentStyle.id);
  if (!style || style.type !== 0 || !integer(style.charShapeId)) {
    throw new Error('선택 문단의 기본 글자 모양을 확인하지 못했습니다.');
  }

  return {
    range, paragraphLength, paragraphText, selectedText,
    styleId: style.id, styleDefinition: JSON.stringify(style),
    sourceCharShapeId: runs[0].charShapeId, targetCharShapeId: style.charShapeId,
  };
}

function assertPlanCurrent(document: any, expected: ClearCharacterStylePlan, shape: number): void {
  const current = readClearCharacterStylePlan(document, expected.range);
  const stable = {
    ...current,
    sourceCharShapeId: expected.sourceCharShapeId,
    targetCharShapeId: expected.targetCharShapeId,
  };
  if (!same(stable, expected) || current.sourceCharShapeId !== shape) {
    throw new Error('문서 원문, 선택 범위 또는 문단 스타일이 바뀌었습니다. 다시 선택하세요.');
  }
}

function writeShape(document: any, plan: ClearCharacterStylePlan, shape: number): void {
  const { start, end } = plan.range;
  checked(document.setCharShapeId(
    start.sectionIndex, start.paragraphIndex, start.charOffset, end.charOffset, shape,
  ));
}

/** Undoable command that resets an exact body selection to its paragraph style's char shape. */
export class ClearCharacterStyleCommand {
  readonly type = 'applyCharFormat';
  readonly timestamp = Date.now();
  private noOp = false;
  private recoveryNeeded = false;
  private readonly plan: ClearCharacterStylePlan;

  constructor(plan: ClearCharacterStylePlan) { this.plan = plan; }

  execute(document: any): Position {
    this.noOp = this.plan.sourceCharShapeId === this.plan.targetCharShapeId;
    assertPlanCurrent(document, this.plan, this.plan.sourceCharShapeId);
    if (this.noOp) return { ...this.plan.range.start };
    try {
      writeShape(document, this.plan, this.plan.targetCharShapeId);
      assertPlanCurrent(document, this.plan, this.plan.targetCharShapeId);
      this.recoveryNeeded = false;
    } catch (error) {
      try {
        writeShape(document, this.plan, this.plan.sourceCharShapeId);
        assertPlanCurrent(document, this.plan, this.plan.sourceCharShapeId);
        this.recoveryNeeded = false;
      } catch {
        this.recoveryNeeded = true;
      }
      throw error;
    }
    return { ...this.plan.range.start };
  }

  undo(document: any): Position {
    assertPlanCurrent(document, this.plan, this.plan.targetCharShapeId);
    try {
      writeShape(document, this.plan, this.plan.sourceCharShapeId);
      assertPlanCurrent(document, this.plan, this.plan.sourceCharShapeId);
      this.recoveryNeeded = false;
    } catch (error) {
      this.recoveryNeeded = true;
      throw error;
    }
    return { ...this.plan.range.start };
  }

  isNoOp(): boolean { return this.noOp; }
  retainOnFailure(): boolean { return this.recoveryNeeded; }
  mergeWith(): null { return null; }
  selectionBefore() { return { ...copyRange(this.plan.range), blockPhase: null }; }
  selectionAfter() { return { ...copyRange(this.plan.range), blockPhase: null }; }
}

export function installClearCharacterStyle(registry: any, input: () => any, eventBus: any): void {
  const safe = (context: any): boolean => {
    const ih = input(), cursor = ih?.cursor;
    return Boolean(cursor && context?.hasDocument && context.isEditable && !context.isFormMode && !context.inField
      && !context.inTable && !context.inCellSelectionMode
      && !context.inTableObjectSelection && !context.inPictureObjectSelection
      && !ih.isComposing && !ih.wasm.requiresPasswordForSave
      && !cursor.isInHeaderFooter() && !cursor.isInFootnote() && !cursor.isInTextBox()
      && cursor.hasSelection());
  };
  registry.register({
    id: 'ext:jueony-clear-char-style', label: '글자 스타일 해제',
    canExecute: safe,
    execute: () => {
      const ih = input(), api = (window as any).jueonyEditor;
      const automation = (window as any).rhwpStudio?.automation;
      const selection = ih?.getSelection?.();
      if (!ih || !api || !automation || !selection || !safe(automation.getContext()) || api.busy()) {
        throw new Error('한 문단 안의 일반 본문 글자를 선택해 주세요.');
      }
      if (typeof api.revision !== 'function') throw new Error('문서 revision을 확인하지 못했습니다.');
      const revision = api.revision(), identity = api.documentIdentity?.();
      if (typeof revision !== 'string' && typeof revision !== 'number') {
        throw new Error('문서 revision을 확인하지 못했습니다.');
      }
      const token = JSON.stringify(selection), plan = readClearCharacterStylePlan(ih.wasm, selection);
      if (input() !== ih || api.busy() || api.revision() !== revision
          || api.documentIdentity?.() !== identity || !safe(automation.getContext())
          || JSON.stringify(ih.getSelection()) !== token) {
        throw new Error('문서나 선택이 바뀌었습니다. 다시 선택하세요.');
      }
      ih.executeOperation({ kind: 'command', command: new ClearCharacterStyleCommand(plan) });
      eventBus.emit('command-state-changed');
    },
  });
}
