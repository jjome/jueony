export type PageDefaults = {
  widthMm: number; heightMm: number; landscape: boolean;
  marginLeftMm: number; marginRightMm: number; marginTopMm: number; marginBottomMm: number;
  marginHeaderMm: number; marginFooterMm: number;
};
export type DocumentDefaults = { version: 1; enabled: boolean; page: PageDefaults; font: { family: string; sizePt: number } };

export type DocumentFitMode = 'none' | 'fitWidth' | 'fitPage';
export type BodyCaret = { section: number; paragraph: number; offset: number; paragraphLength: number; before: string; after: string };
export type DocumentViewState = { version: 1; zoom: number; fitMode: DocumentFitMode; scrollX: number; scrollY: number; caret?: BodyCaret };

export type PreferenceErrorCode = 'read' | 'write' | 'corrupt' | 'version';
export class PreferenceStorageError extends Error {
  readonly code: PreferenceErrorCode;
  constructor(code: PreferenceErrorCode) {
    const messages = {
      read: '환경 설정 저장소를 읽지 못했습니다. 기존 설정을 유지합니다.',
      write: '환경 설정을 저장하지 못했습니다. 저장 공간과 권한을 확인한 뒤 다시 시도해 주세요.',
      corrupt: '저장된 환경 설정이 손상되어 자동으로 덮어쓰지 않았습니다. 기존 설정 복구가 필요합니다.',
      version: '더 새로운 버전 또는 지원하지 않는 형식의 환경 설정입니다. 기존 설정을 보존했습니다.',
    };
    super(messages[code]);
    this.name = 'PreferenceStorageError';
    this.code = code;
  }
}

export interface PreferencesRefresh<T> { value: T; changedPaths: string[] }
export type ViewRestoreResult = 'applied' | 'deferred' | 'ignored' | 'invalid';
