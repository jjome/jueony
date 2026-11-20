/**
 * B080 paragraph-band engine adapter.
 *
 * Hancom's paragraph band is a normal rectangle anchored to the paragraph:
 * 1.06 mm high, paragraph-width, black solid fill, no outline.  Keeping this
 * adapter on the existing shape model makes HWP/HWPX preservation observable
 * instead of inventing a second, non-portable document object.
 */

export const PARAGRAPH_BAND_HEIGHT_HWPUNIT_B080 = 300;

export type ParagraphBandTargetB080 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  charOffset: number;
  story: 'body';
  selectionCollapsed: true;
  editable: true;
  protected: false;
  revision: string;
}>;

export type ParagraphBandReceiptB080 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  controlIndex: number;
  instanceId: number;
  width: number;
  height: typeof PARAGRAPH_BAND_HEIGHT_HWPUNIT_B080;
  revision: string;
}>;

type JsonRecord = Record<string, unknown>;

type ParagraphBandDocumentB080 = Readonly<{
  getSectionCount(): number;
  getParagraphCount(sectionIndex: number): number;
  getParagraphLength(sectionIndex: number, paragraphIndex: number): number;
  getPageDef(sectionIndex: number): string;
  getColumnDef(sectionIndex: number): string;
  getParaPropertiesAt(sectionIndex: number, paragraphIndex: number): string;
  getControls(): string;
  getShapeProperties(sectionIndex: number, paragraphIndex: number, controlIndex: number): string;
  createShapeControl(json: string): string;
  setShapeProperties(sectionIndex: number, paragraphIndex: number, controlIndex: number, json: string): string;
  saveSnapshot(): number;
  restoreSnapshot(token: number): string;
  discardSnapshot(token: number): void;
  exportHwpx(): Uint8Array;
}>;

type ReceiptState = {
  document: ParagraphBandDocumentB080;
  beforeToken: number;
  afterToken: number;
  beforeBytes: Uint8Array;
  afterBytes: Uint8Array;
  active: boolean;
};

const receipts = new WeakMap<object, ReceiptState>();
const own = (value: unknown): value is JsonRecord => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parsed(value: unknown, label: string): JsonRecord {
  let candidate = value;
  if (typeof candidate === 'string' && candidate.length <= 4 * 1024 * 1024) {
    try { candidate = JSON.parse(candidate); } catch { throw new Error(`${label} 응답을 해석하지 못했습니다.`); }
  }
  if (!own(candidate)) throw new Error(`${label} 응답을 확인하지 못했습니다.`);
  return candidate;
}

function accepted(value: unknown): boolean {
  if (value === true) return true;
  try { return parsed(value, '문서 엔진').ok !== false; } catch { return false; }
}

function exactBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function bytes(document: ParagraphBandDocumentB080): Uint8Array {
  const value = document.exportHwpx();
  if (!(value instanceof Uint8Array) || value.byteLength === 0) throw new Error('문서 상태 지문을 만들지 못했습니다. 문단 띠를 넣지 않았습니다.');
  return value.slice();
}

function assertDocument(value: unknown): ParagraphBandDocumentB080 {
  if (!own(value)) throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  const required = [
    'getSectionCount', 'getParagraphCount', 'getParagraphLength', 'getPageDef', 'getColumnDef',
    'getParaPropertiesAt', 'getControls', 'getShapeProperties', 'createShapeControl', 'setShapeProperties',
    'saveSnapshot', 'restoreSnapshot', 'discardSnapshot', 'exportHwpx',
  ];
  if (required.some(name => typeof value[name] !== 'function')) {
    throw new Error('이 편집 엔진은 검증 가능한 문단 띠 생성·되돌리기를 지원하지 않습니다.');
  }
  return value as unknown as ParagraphBandDocumentB080;
}

function assertTarget(value: unknown): ParagraphBandTargetB080 {
  if (!own(value) || !integer(value.sectionIndex) || !integer(value.paragraphIndex) || !integer(value.charOffset)
    || value.story !== 'body' || value.selectionCollapsed !== true || value.editable !== true || value.protected !== false
    || typeof value.revision !== 'string' || value.revision.length < 1 || value.revision.length > 256) {
    throw new Error('편집 가능한 최상위 본문 캐럿과 문서 버전을 확인하지 못했습니다.');
  }
  return value as unknown as ParagraphBandTargetB080;
}

function globalParagraphIndex(document: ParagraphBandDocumentB080, target: ParagraphBandTargetB080): number {
  let result = target.paragraphIndex;
  for (let section = 0; section < target.sectionIndex; section += 1) result += document.getParagraphCount(section);
  return result;
}

function paragraphWidth(document: ParagraphBandDocumentB080, target: ParagraphBandTargetB080): number {
  const sections = document.getSectionCount();
  if (!integer(sections) || target.sectionIndex >= sections) throw new Error('문단 띠를 넣을 구역이 문서 범위를 벗어났습니다.');
  const paragraphs = document.getParagraphCount(target.sectionIndex);
  if (!integer(paragraphs) || target.paragraphIndex >= paragraphs) throw new Error('문단 띠를 넣을 문단이 문서 범위를 벗어났습니다.');
  const length = document.getParagraphLength(target.sectionIndex, target.paragraphIndex);
  if (!integer(length) || target.charOffset > length) throw new Error('문단 띠를 넣을 글자 위치가 문단 범위를 벗어났습니다.');

  const column = parsed(document.getColumnDef(target.sectionIndex), '단 설정');
  if (column.columnCount !== 1) throw new Error('여러 단 문서의 문단 띠 너비는 아직 정확히 계산할 수 없습니다. 문서를 바꾸지 않았습니다.');
  const page = parsed(document.getPageDef(target.sectionIndex), '쪽 설정');
  const para = parsed(document.getParaPropertiesAt(target.sectionIndex, target.paragraphIndex), '문단 모양');
  for (const [label, value] of [
    ['용지 너비', page.width], ['왼쪽 여백', page.marginLeft], ['오른쪽 여백', page.marginRight],
    ['제본 여백', page.marginGutter], ['문단 왼쪽 여백', para.marginLeft], ['문단 오른쪽 여백', para.marginRight],
  ] as const) if (!finite(value)) throw new Error(`${label}을 정확히 확인하지 못했습니다. 문단 띠를 넣지 않았습니다.`);
  const width = Math.round((page.width as number) - (page.marginLeft as number) - (page.marginRight as number)
    - (page.marginGutter as number) - (para.marginLeft as number) - (para.marginRight as number));
  if (!Number.isSafeInteger(width) || width < 1 || width > (page.width as number) * 2) {
    throw new Error('문단 띠 너비가 안전한 범위를 벗어났습니다. 문서를 바꾸지 않았습니다.');
  }
  return width;
}

function shapeProperties(document: ParagraphBandDocumentB080, target: ParagraphBandTargetB080, controlIndex: number): JsonRecord {
  return parsed(document.getShapeProperties(target.sectionIndex, target.paragraphIndex, controlIndex), '문단 띠 속성');
}

function isExactBand(props: JsonRecord, width: number): boolean {
  return props.width === width && props.height === PARAGRAPH_BAND_HEIGHT_HWPUNIT_B080
    && props.treatAsChar === false && props.vertRelTo === 'Para' && props.vertAlign === 'Top'
    && props.horzRelTo === 'Para' && props.horzAlign === 'Left'
    && props.vertOffset === 0 && props.horzOffset === 0 && props.textWrap === 'TopAndBottom'
    && props.lineType === 0 && props.fillType === 'solid' && props.fillBgColor === 0
    && props.fillPatColor === 0 && props.fillPatType === -1 && props.fillAlpha === 0;
}

function verifyControl(document: ParagraphBandDocumentB080, target: ParagraphBandTargetB080, controlIndex: number, width: number): JsonRecord {
  let controls: unknown;
  try { controls = JSON.parse(document.getControls()); } catch { throw new Error('문단 띠 컨트롤을 확인하지 못했습니다.'); }
  if (!Array.isArray(controls)) throw new Error('문단 띠 컨트롤을 확인하지 못했습니다.');
  const flat = globalParagraphIndex(document, target);
  const control = controls.find(item => own(item) && item.ctrlId === 'gso' && item.userDesc === '사각형'
    && item.list === 0 && item.para === flat && item.controlIndex === controlIndex);
  if (!control) throw new Error('만든 문단 띠가 대상 문단의 사각형 컨트롤로 확인되지 않았습니다.');
  const props = shapeProperties(document, target, controlIndex);
  if (!isExactBand(props, width) || !integer(props.instanceId)) throw new Error('만든 문단 띠 속성이 한글 문단 띠 규격과 다릅니다.');
  return props;
}

/** Creates one exact paragraph-band object and retains a guarded native undo receipt. */
export function insertParagraphBandB080(documentValue: unknown, targetValue: unknown): ParagraphBandReceiptB080 {
  const document = assertDocument(documentValue), target = assertTarget(targetValue), width = paragraphWidth(document, target);
  const beforeBytes = bytes(document), beforeToken = document.saveSnapshot();
  if (!integer(beforeToken)) throw new Error('문단 띠를 되돌릴 문서 스냅샷을 만들지 못했습니다.');
  let afterToken: number | undefined;
  try {
    const created = parsed(document.createShapeControl(JSON.stringify({
      sectionIdx: target.sectionIndex, paraIdx: target.paragraphIndex, charOffset: target.charOffset,
      width, height: PARAGRAPH_BAND_HEIGHT_HWPUNIT_B080, shapeType: 'rectangle', treatAsChar: false,
      textWrap: 'TopAndBottom',
    })), '문단 띠 생성');
    if (created.ok !== true || !integer(created.paraIdx) || !integer(created.controlIdx)
      || created.paraIdx !== target.paragraphIndex) throw new Error('문서 엔진이 문단 띠를 만들지 못했습니다.');
    const controlIndex = created.controlIdx;
    const changed = document.setShapeProperties(target.sectionIndex, target.paragraphIndex, controlIndex, JSON.stringify({
      width, height: PARAGRAPH_BAND_HEIGHT_HWPUNIT_B080, treatAsChar: false,
      vertRelTo: 'Para', vertAlign: 'Top', horzRelTo: 'Para', horzAlign: 'Left',
      vertOffset: 0, horzOffset: 0, textWrap: 'TopAndBottom',
      lineType: 0, borderColor: 0,
      fillType: 'solid', fillBgColor: 0, fillPatColor: 0, fillPatType: -1, fillAlpha: 0,
    }));
    if (!accepted(changed)) throw new Error('문서 엔진이 문단 띠 속성을 적용하지 못했습니다.');
    const props = verifyControl(document, target, controlIndex, width);
    const afterBytes = bytes(document);
    if (exactBytes(beforeBytes, afterBytes)) throw new Error('문단 띠 생성 뒤 문서가 바뀌지 않았습니다.');
    afterToken = document.saveSnapshot();
    if (!integer(afterToken)) throw new Error('문단 띠 적용 상태를 검증할 스냅샷을 만들지 못했습니다.');
    const receipt = Object.freeze({
      sectionIndex: target.sectionIndex, paragraphIndex: target.paragraphIndex, controlIndex,
      instanceId: props.instanceId as number, width, height: PARAGRAPH_BAND_HEIGHT_HWPUNIT_B080,
      revision: target.revision,
    });
    receipts.set(receipt, {document, beforeToken, afterToken, beforeBytes, afterBytes, active: true});
    return receipt;
  } catch (error) {
    if (afterToken !== undefined) try { document.discardSnapshot(afterToken); } catch { /* release only */ }
    let restored = false;
    try { restored = accepted(document.restoreSnapshot(beforeToken)) && exactBytes(bytes(document), beforeBytes); } catch { restored = false; }
    try { document.discardSnapshot(beforeToken); } catch { /* release only */ }
    if (!restored) throw new Error('문단 띠 생성 실패 뒤 원문 복원까지 확인하지 못했습니다.', {cause: error});
    throw error;
  }
}

/** Restores only when the entire current document is still the exact post-insert state. */
export function undoParagraphBandB080(receipt: ParagraphBandReceiptB080): boolean {
  const state = receipts.get(receipt);
  if (!state || !state.active) return false;
  if (!exactBytes(bytes(state.document), state.afterBytes)) throw new Error('문단 띠를 넣은 뒤 문서가 바뀌어 자동으로 되돌릴 수 없습니다.');
  let restored = false;
  try {
    restored = accepted(state.document.restoreSnapshot(state.beforeToken)) && exactBytes(bytes(state.document), state.beforeBytes);
    if (!restored) {
      state.document.restoreSnapshot(state.afterToken);
      throw new Error('문단 띠 이전 상태를 정확히 복원하지 못했습니다.');
    }
    state.active = false;
    return true;
  } finally {
    if (restored) {
      try { state.document.discardSnapshot(state.afterToken); } catch { /* release only */ }
      try { state.document.discardSnapshot(state.beforeToken); } catch { /* release only */ }
    }
    // Keep both checkpoints after an uncertain restore so the caller can stop editing and recover explicitly.
  }
}

/** Releases a receipt when native history has adopted the operation. */
export function discardParagraphBandUndoB080(receipt: ParagraphBandReceiptB080): boolean {
  const state = receipts.get(receipt);
  if (!state || !state.active) return false;
  state.active = false;
  try { state.document.discardSnapshot(state.afterToken); } finally { state.document.discardSnapshot(state.beforeToken); }
  return true;
}

