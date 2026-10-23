import { validateDocumentDefaults } from './document-defaults.ts';
import type { DocumentDefaults } from '../public/contracts.ts';
import { validateEditorChromePreferences } from './editor-chrome.ts';
import type { EditorChromePreferences } from './editor-chrome.ts';
export type SettingsBackup = { format: 'jueony-editor-preferences'; version: 1; settings: Record<string, any>; documentDefaults: DocumentDefaults; editorChrome?: EditorChromePreferences };
const object = (value: unknown): Record<string, any> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('환경 파일의 항목 형식이 올바르지 않습니다.'); return value as Record<string, any>; };
const bool = (value: unknown) => { if (typeof value !== 'boolean') throw new Error('환경 파일의 켜짐/꺼짐 값을 확인하세요.'); return value; };
const number = (value: unknown, min: number, max: number) => { if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error('환경 파일의 숫자가 허용 범위를 벗어났습니다.'); return value as number; };
const choice = (value: unknown, values: string[]) => { if (typeof value !== 'string' || !values.includes(value)) throw new Error('지원하지 않는 환경 설정 값입니다.'); return value; };
const name = (value: unknown) => { if (typeof value !== 'string' || !value.trim() || value.length > 100 || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error('대표 글꼴의 이름을 확인하세요.'); return value; };

/** Explicit projection: credentials, conversations and document content cannot enter a backup. */
export function projectEditorSettings(value: unknown): Record<string, any> {
  const source = object(value); if (source.version !== 1) throw new Error('지원하지 않는 환경 설정 버전입니다.');
  const font = object(source.font), theme = object(source.theme), dialog = object(source.dialog), view = object(source.view), autosave = object(source.autosave);
  if (!Array.isArray(font.fontSets) || font.fontSets.length > 100) throw new Error('대표 글꼴 세트는 100개 이하여야 합니다.');
  const names = new Set<string>();
  const fontSets = font.fontSets.map(value => {
    const set = object(value), result: Record<string, string> = {};
    for (const field of ['name', 'korean', 'english', 'chinese', 'japanese', 'other', 'symbol', 'user']) result[field] = name(set[field]);
    if (names.has(result.name.normalize('NFC'))) throw new Error('대표 글꼴 세트의 이름이 중복됩니다.'); names.add(result.name.normalize('NFC')); return result;
  });
  const arrangement = object(view.pageArrangement), kind = choice(arrangement.kind, ['auto', 'single', 'double', 'facing', 'multiple']);
  const pageArrangement = kind === 'multiple' ? { kind, columns: number(arrangement.columns, 1, 8), rows: number(arrangement.rows, 1, 8) } : { kind };
  const movement = object(view.pageMovement);
  return {
    version: 1,
    font: { fontSets, showRecentFonts: bool(font.showRecentFonts), recentFontCount: number(font.recentFontCount, 1, 5) },
    theme: { mode: choice(theme.mode, ['system', 'light', 'dark']), skin: choice(theme.skin, ['default', 'flat', 'oldschool']), skinChosen: bool(theme.skinChosen) },
    dialog: { picturePropsKeepRatio: bool(dialog.picturePropsKeepRatio), showPdfPrintGuidance: bool(dialog.showPdfPrintGuidance) },
    view: { ...Object.fromEntries(['showParagraphMarks', 'showControlCodes', 'clipView', 'toolbarBasic', 'toolbarFormat'].map(key => [key, bool(view[key])])), pageArrangement,
      pageMovement: { direction: choice(movement.direction, ['vertical', 'horizontal']), wheelHorizontal: bool(movement.wheelHorizontal) }, zoomFitMode: choice(view.zoomFitMode, ['none', 'fitWidth', 'fitPage']) },
    autosave: { recoveryEnabled: bool(autosave.recoveryEnabled), recoveryIntervalMinutes: number(autosave.recoveryIntervalMinutes, 1, 120), idleSaveEnabled: bool(autosave.idleSaveEnabled), idleDelaySeconds: number(autosave.idleDelaySeconds, 5, 600) },
  };
}
export function createSettingsBackup(settings: unknown, documentDefaults: unknown, editorChrome?: unknown): SettingsBackup {
  return { format: 'jueony-editor-preferences', version: 1, settings: projectEditorSettings(settings), documentDefaults: validateDocumentDefaults(documentDefaults),
    ...(editorChrome === undefined ? {} : { editorChrome: validateEditorChromePreferences(editorChrome) }) };
}
export function parseSettingsBackup(text: string): SettingsBackup {
  if (text.length > 256_000) throw new Error('환경 파일은 256KB 이하여야 합니다.');
  let value: Record<string, any>; try { value = object(JSON.parse(text)); } catch { throw new Error('환경 파일의 JSON 형식을 확인하세요.'); }
  if (value.format !== 'jueony-editor-preferences' || value.version !== 1) throw new Error('지원하지 않는 환경 파일 또는 버전입니다.');
  return createSettingsBackup(value.settings, value.documentDefaults, value.editorChrome);
}
