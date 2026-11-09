export type ParagraphDropCapStyleB183 = 'none' | 'double-line' | 'triple-line' | 'margin';

export type ParagraphDropCapStoryB183 =
  | 'body'
  | 'table-cell'
  | 'header-footer'
  | 'footnote'
  | 'endnote'
  | 'textbox';

export type ParagraphDropCapContextB183 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  story: ParagraphDropCapStoryB183;
  editable: boolean;
  documentProtected: boolean;
  selectionCollapsed: boolean;
}>;

export type ParagraphDropCapTargetB183 = Readonly<{
  sectionIndex: number;
  paragraphIndex: number;
  flatParagraphIndex: number;
  controlIndex: number;
  controlPosition: number;
  style: Exclude<ParagraphDropCapStyleB183, 'none'>;
}>;

export type ParagraphDropCapBlockReasonB183 =
  | 'native-api-missing'
  | 'unsupported-format'
  | 'unsupported-story'
  | 'unsupported-selection'
  | 'invalid-location'
  | 'malformed-native-response'
  | 'native-contract-missing'
  | 'ambiguous-drop-cap'
  | 'protected';

export type ParagraphDropCapReadResultB183 =
  | Readonly<{status: 'available'; target: ParagraphDropCapTargetB183 | null}>
  | Readonly<{status: 'blocked'; reason: ParagraphDropCapBlockReasonB183}>;

export type ParagraphDropCapPlanB183 = Readonly<{
  schemaVersion: 1;
  revision: string;
  target: ParagraphDropCapTargetB183;
  evidenceStamp: string;
}>;

export type ParagraphDropCapCaptureResultB183 =
  | Readonly<{status: 'ready'; plan: ParagraphDropCapPlanB183}>
  | Readonly<{status: 'blocked'; reason: ParagraphDropCapBlockReasonB183 | 'read-only' | 'no-existing-drop-cap'}>;

type NativeDropCapStyleB183 = 'None' | 'DoubleLine' | 'TripleLine' | 'Margin';

type NativeParagraphDropCapPortB183 = Readonly<{
  getSourceFormat?: () => unknown;
  getSectionCount?: () => unknown;
  getParagraphCount?: (sectionIndex: number) => unknown;
  getControls?: () => unknown;
  getPictureProperties?: (sectionIndex: number, paragraphIndex: number, controlIndex: number) => unknown;
  setPictureProperties?: (sectionIndex: number, paragraphIndex: number, controlIndex: number, properties: string) => unknown;
  saveSnapshot?: () => unknown;
  restoreSnapshot?: (token: number) => unknown;
  discardSnapshot?: (token: number) => unknown;
}>;

export type ParagraphDropCapSessionB183 = Readonly<{
  document: NativeParagraphDropCapPortB183;
  context: () => ParagraphDropCapContextB183;
  revision: () => string;
}>;

export type ParagraphDropCapReceiptB183 = Readonly<{
  before: ParagraphDropCapTargetB183;
  after: ParagraphDropCapTargetB183;
  undo: () => boolean;
  commit: () => void;
}>;

const nativeToPublic: Readonly<Record<NativeDropCapStyleB183, ParagraphDropCapStyleB183>> = Object.freeze({
  None: 'none',
  DoubleLine: 'double-line',
  TripleLine: 'triple-line',
  Margin: 'margin',
});

const publicToNative: Readonly<Record<ParagraphDropCapStyleB183, NativeDropCapStyleB183>> = Object.freeze({
  none: 'None',
  'double-line': 'DoubleLine',
  'triple-line': 'TripleLine',
  margin: 'Margin',
});

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > 2 * 1024 * 1024) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

function index(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function accepted(value: unknown): boolean {
  const parsed = parse(value);
  return parsed === undefined || parsed === true || (record(parsed) && parsed.ok === true);
}

function sameLocation(left: ParagraphDropCapContextB183, right: ParagraphDropCapContextB183): boolean {
  return left.story === 'body' && right.story === 'body'
    && left.sectionIndex === right.sectionIndex
    && left.paragraphIndex === right.paragraphIndex;
}

function contextBlock(context: ParagraphDropCapContextB183): ParagraphDropCapReadResultB183 | undefined {
  if (context.story !== 'body') return {status: 'blocked', reason: 'unsupported-story'};
  if (!context.selectionCollapsed) return {status: 'blocked', reason: 'unsupported-selection'};
  if (!index(context.sectionIndex) || !index(context.paragraphIndex)) return {status: 'blocked', reason: 'invalid-location'};
  return undefined;
}

function flatParagraphIndex(document: NativeParagraphDropCapPortB183, context: ParagraphDropCapContextB183): number | undefined {
  if (typeof document.getSectionCount !== 'function' || typeof document.getParagraphCount !== 'function') return undefined;
  const count = document.getSectionCount();
  if (!index(count) || context.sectionIndex >= count) return undefined;
  let flat = 0;
  for (let section = 0; section < count; section += 1) {
    const paragraphs = document.getParagraphCount(section);
    if (!index(paragraphs)) return undefined;
    if (section === context.sectionIndex) return context.paragraphIndex < paragraphs ? flat + context.paragraphIndex : undefined;
    flat += paragraphs;
  }
  return undefined;
}

function controlLocked(control: Record<string, unknown>): boolean | undefined {
  if (!record(control.props)) return undefined;
  const lock = control.props.Lock;
  return lock === true || lock === 1 ? true : lock === false || lock === 0 ? false : undefined;
}

/**
 * Reads only the HWPX picture-backed drop-cap representation that rhwp actually
 * preserves. It never guesses that an ordinary first character or picture is a
 * drop cap, and it deliberately excludes nested/special stories.
 */
export function readParagraphDropCapB183(
  document: NativeParagraphDropCapPortB183 | undefined,
  context: ParagraphDropCapContextB183,
): ParagraphDropCapReadResultB183 {
  const blocked = contextBlock(context);
  if (blocked) return blocked;
  if (!document || typeof document.getSourceFormat !== 'function'
    || typeof document.getControls !== 'function'
    || typeof document.getPictureProperties !== 'function'
    || typeof document.getSectionCount !== 'function'
    || typeof document.getParagraphCount !== 'function') return {status: 'blocked', reason: 'native-api-missing'};
  let source: unknown;
  try { source = document.getSourceFormat(); } catch { return {status: 'blocked', reason: 'malformed-native-response'}; }
  if (source !== 'hwpx') return {status: 'blocked', reason: 'unsupported-format'};
  const flat = flatParagraphIndex(document, context);
  if (flat === undefined) return {status: 'blocked', reason: 'invalid-location'};

  let controlsWire: unknown;
  try { controlsWire = parse(document.getControls()); } catch { return {status: 'blocked', reason: 'malformed-native-response'}; }
  if (!Array.isArray(controlsWire) || controlsWire.length > 100_000 || controlsWire.some(value => !record(value))) {
    return {status: 'blocked', reason: 'malformed-native-response'};
  }
  const pictures = (controlsWire as Record<string, unknown>[]).filter(control =>
    control.ctrlId === 'gso' && control.userDesc === '그림' && control.list === 0 && control.para === flat);
  const found: ParagraphDropCapTargetB183[] = [];
  for (const picture of pictures) {
    if (!index(picture.controlIndex) || !index(picture.pos)) return {status: 'blocked', reason: 'malformed-native-response'};
    const locked = controlLocked(picture);
    if (locked === undefined) return {status: 'blocked', reason: 'malformed-native-response'};
    let properties: unknown;
    try {
      properties = parse(document.getPictureProperties(context.sectionIndex, context.paragraphIndex, picture.controlIndex));
    } catch { return {status: 'blocked', reason: 'malformed-native-response'}; }
    if (!record(properties) || !(String(properties.dropCapStyle) in nativeToPublic)) {
      return {status: 'blocked', reason: 'native-contract-missing'};
    }
    const style = nativeToPublic[String(properties.dropCapStyle) as NativeDropCapStyleB183];
    if (style === 'none') continue;
    if (locked) return {status: 'blocked', reason: 'protected'};
    found.push(Object.freeze({
      sectionIndex: context.sectionIndex,
      paragraphIndex: context.paragraphIndex,
      flatParagraphIndex: flat,
      controlIndex: picture.controlIndex,
      controlPosition: picture.pos,
      style,
    }));
  }
  if (found.length > 1) return {status: 'blocked', reason: 'ambiguous-drop-cap'};
  return {status: 'available', target: found[0] ?? null};
}

export function captureParagraphDropCapB183(session: ParagraphDropCapSessionB183): ParagraphDropCapCaptureResultB183 {
  const context = session.context();
  if (!context.editable || context.documentProtected) return {status: 'blocked', reason: 'read-only'};
  const read = readParagraphDropCapB183(session.document, context);
  if (read.status === 'blocked') return read;
  if (!read.target) return {status: 'blocked', reason: 'no-existing-drop-cap'};
  const revision = session.revision();
  const evidenceStamp = JSON.stringify({revision, target: read.target});
  return {status: 'ready', plan: Object.freeze({schemaVersion: 1, revision, target: read.target, evidenceStamp})};
}

function exactTarget(left: ParagraphDropCapTargetB183, right: ParagraphDropCapTargetB183): boolean {
  return left.sectionIndex === right.sectionIndex
    && left.paragraphIndex === right.paragraphIndex
    && left.flatParagraphIndex === right.flatParagraphIndex
    && left.controlIndex === right.controlIndex
    && left.controlPosition === right.controlPosition
    && left.style === right.style;
}

function currentTarget(session: ParagraphDropCapSessionB183, expected: ParagraphDropCapTargetB183): ParagraphDropCapTargetB183 | undefined {
  const read = readParagraphDropCapB183(session.document, session.context());
  return read.status === 'available' && read.target && exactTarget(read.target, expected) ? read.target : undefined;
}

/**
 * Changes the mode of one already-existing HWPX picture-backed drop cap. This
 * does not create a drop cap from an ordinary first character or picture.
 */
export function applyExistingParagraphDropCapB183(
  session: ParagraphDropCapSessionB183,
  plan: ParagraphDropCapPlanB183,
  requested: Exclude<ParagraphDropCapStyleB183, 'none'>,
): ParagraphDropCapReceiptB183 {
  const context = session.context();
  if (!sameLocation(context, {
    ...context,
    story: 'body',
    sectionIndex: plan.target.sectionIndex,
    paragraphIndex: plan.target.paragraphIndex,
  }) || !context.editable || context.documentProtected || !context.selectionCollapsed) throw new Error('B183 문단 위치 또는 편집 상태가 바뀌었습니다.');
  if (!['double-line', 'triple-line', 'margin'].includes(requested)) throw new Error('지원하지 않는 B183 첫 글자 장식 형식입니다.');
  if (requested === plan.target.style) throw new Error('B183 첫 글자 장식 형식이 이미 같습니다.');
  if (session.revision() !== plan.revision || plan.evidenceStamp !== JSON.stringify({revision: plan.revision, target: plan.target})
    || !currentTarget(session, plan.target)) throw new Error('B183 문서가 계획 이후 변경되었습니다.');
  const document = session.document;
  if (typeof document.setPictureProperties !== 'function' || typeof document.saveSnapshot !== 'function'
    || typeof document.restoreSnapshot !== 'function' || typeof document.discardSnapshot !== 'function') {
    throw new Error('B183 변경 또는 되돌리기 API가 없습니다.');
  }
  const token = document.saveSnapshot();
  if (!index(token)) throw new Error('B183 되돌리기 지점을 만들지 못했습니다.');
  let active = true;
  const rollback = (): void => {
    try { document.restoreSnapshot!(token); } finally { document.discardSnapshot!(token); active = false; }
  };
  try {
    const result = document.setPictureProperties(
      plan.target.sectionIndex,
      plan.target.paragraphIndex,
      plan.target.controlIndex,
      JSON.stringify({dropCapStyle: publicToNative[requested]}),
    );
    if (!accepted(result)) throw new Error('B183 그림 속성 변경이 거부되었습니다.');
    const afterRead = readParagraphDropCapB183(document, context);
    if (afterRead.status !== 'available' || !afterRead.target
      || afterRead.target.controlIndex !== plan.target.controlIndex || afterRead.target.style !== requested) {
      throw new Error('B183 변경 결과를 확인하지 못했습니다.');
    }
    const after = afterRead.target;
    const afterRevision = session.revision();
    return Object.freeze({
      before: plan.target,
      after,
      undo(): boolean {
        if (!active || session.revision() !== afterRevision || !currentTarget(session, after)) return false;
        try {
          if (!accepted(document.restoreSnapshot!(token))) return false;
          const restored = readParagraphDropCapB183(document, session.context());
          if (restored.status !== 'available' || !restored.target || !exactTarget(restored.target, plan.target)) return false;
          document.discardSnapshot!(token);
          active = false;
          return true;
        } catch { return false; }
      },
      commit(): void {
        if (!active) return;
        document.discardSnapshot!(token);
        active = false;
      },
    });
  } catch (error) {
    rollback();
    throw error;
  }
}
