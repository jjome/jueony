/**
 * B053 is a user-interface preference.  It must never be copied into the
 * document model or an HWP/HWPX serializer payload.
 */
export type DocumentViewColorsB053 = Readonly<{
  workspace: string;
  paper: string;
}>;

export type StoredDocumentViewColorsB053 = Readonly<{
  version: 1;
  workspace: string;
  paper: string;
}>;

export interface DocumentViewColorStorageB053 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** A deliberately document-free rendering port for the two existing CSS tokens. */
export interface DocumentViewColorTargetB053 {
  apply(colors: DocumentViewColorsB053): void;
}

export interface CssPropertyTargetB053 {
  setProperty(name: string, value: string): void;
}

export const DOCUMENT_VIEW_COLORS_KEY_B053 = 'jueony.user.document-view-colors.v1';
export const DEFAULT_DOCUMENT_VIEW_COLORS_B053: DocumentViewColorsB053 = Object.freeze({
  workspace: '#e0e0e0',
  paper: '#ffffff',
});

const RGB_HEX = /^#[0-9a-f]{6}$/i;

export class DocumentViewColorErrorB053 extends Error {
  readonly code: 'invalid' | 'read' | 'write' | 'closed';

  constructor(code: 'invalid' | 'read' | 'write' | 'closed') {
    super({
      invalid: '문서 보기 색 설정이 올바르지 않습니다.',
      read: '문서 보기 색 설정을 읽지 못했습니다.',
      write: '문서 보기 색 설정을 저장하지 못했습니다.',
      closed: '이미 끝난 문서 보기 색 미리보기입니다.',
    }[code]);
    this.name = 'DocumentViewColorErrorB053';
    this.code = code;
  }
}

function color(value: unknown): string | undefined {
  return typeof value === 'string' && RGB_HEX.test(value) ? value.toLowerCase() : undefined;
}

export function validateDocumentViewColorsB053(value: unknown): DocumentViewColorsB053 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DocumentViewColorErrorB053('invalid');
  }
  const candidate = value as Record<string, unknown>;
  const workspace = color(candidate.workspace);
  const paper = color(candidate.paper);
  if (!workspace || !paper) throw new DocumentViewColorErrorB053('invalid');
  return Object.freeze({ workspace, paper });
}

export function parseStoredDocumentViewColorsB053(raw: string): DocumentViewColorsB053 {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new DocumentViewColorErrorB053('invalid'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (value as Record<string, unknown>).version !== 1) {
    throw new DocumentViewColorErrorB053('invalid');
  }
  return validateDocumentViewColorsB053(value);
}

function stored(value: DocumentViewColorsB053): StoredDocumentViewColorsB053 {
  return { version: 1, workspace: value.workspace, paper: value.paper };
}

/** Binds B053 to the actual Studio view tokens without touching document data. */
export function createCssDocumentViewColorTargetB053(style: CssPropertyTargetB053): DocumentViewColorTargetB053 {
  return {
    apply(value) {
      const colors = validateDocumentViewColorsB053(value);
      style.setProperty('--doc-workspace', colors.workspace);
      style.setProperty('--doc-paper', colors.paper);
    },
  };
}

export interface DocumentViewColorControllerOptionsB053 {
  storage: DocumentViewColorStorageB053;
  target: DocumentViewColorTargetB053;
  key?: string;
}

/**
 * One preference session with transactional preview/cancel semantics.
 *
 * Storage is the only persistence dependency.  The controller intentionally
 * has no HwpDocument, document session, or exporter dependency, making it
 * impossible for a color preview to dirty or serialize the active document.
 */
export function createDocumentViewColorControllerB053(options: DocumentViewColorControllerOptionsB053) {
  const key = options.key ?? DOCUMENT_VIEW_COLORS_KEY_B053;
  let committed: DocumentViewColorsB053;
  try {
    const raw = options.storage.getItem(key);
    committed = raw === null ? DEFAULT_DOCUMENT_VIEW_COLORS_B053 : parseStoredDocumentViewColorsB053(raw);
  } catch (error) {
    if (error instanceof DocumentViewColorErrorB053) throw error;
    throw new DocumentViewColorErrorB053('read');
  }
  let draft = committed;
  let closed = false;
  options.target.apply(committed);

  const assertOpen = () => {
    if (closed) throw new DocumentViewColorErrorB053('closed');
  };
  const copy = (value: DocumentViewColorsB053): DocumentViewColorsB053 => ({ ...value });

  return {
    snapshot: () => copy(committed),
    draft: () => copy(draft),
    preview(value: unknown) {
      assertOpen();
      draft = validateDocumentViewColorsB053(value);
      options.target.apply(draft);
      return copy(draft);
    },
    commit() {
      assertOpen();
      try { options.storage.setItem(key, JSON.stringify(stored(draft))); }
      catch {
        draft = committed;
        options.target.apply(committed);
        throw new DocumentViewColorErrorB053('write');
      }
      committed = draft;
      closed = true;
      return copy(committed);
    },
    cancel() {
      assertOpen();
      draft = committed;
      options.target.apply(committed);
      closed = true;
      return copy(committed);
    },
  };
}
