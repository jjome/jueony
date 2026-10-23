import { commitFontSetChange, validateFontSet, FONT_SET_LANGUAGES } from '../../modules/preferences/public/index.ts';
import type { FontSetChange, FontSetDefinition } from '../../modules/preferences/public/index.ts';

export function showFontSetError(dialog: any, error: unknown): false {
  let label = dialog.dialog.querySelector('[data-font-set-error]');
  if (!label) { label = document.createElement('p'); label.dataset.fontSetError = 'true'; label.setAttribute('role', 'alert'); label.style.cssText = 'color:#b43b2e;white-space:normal;overflow-wrap:anywhere;'; dialog.dialog.querySelector('.dialog-body').append(label); }
  label.textContent = error instanceof Error ? error.message : '대표 글꼴을 저장하지 못했습니다. 입력값은 유지됩니다.';
  return false;
}
export function confirmFontSetEdit(dialog: any): boolean {
  try {
    const value = validateFontSet({ name: dialog.nameInput.value, ...Object.fromEntries(FONT_SET_LANGUAGES.map((key, index) => [key, dialog.langSelects[index].value])) });
    return dialog.onApply(value) !== false;
  } catch (error) { return showFontSetError(dialog, error); }
}
export function saveFontSetChange(settings: { updateFontSettings: (value: { fontSets: FontSetDefinition[] }) => void }, builtins: readonly FontSetDefinition[], change: FontSetChange): void {
  commitFontSetChange({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }, values => settings.updateFontSettings({ fontSets: values }), builtins, change);
}
/** Imported or currently undiscovered families stay exact; this does not claim installation. */
export function selectStoredFontFamily(select: HTMLSelectElement, value: string): void {
  if (value && ![...select.options].some(option => option.value === value)) {
    const group = document.createElement('optgroup'); group.label = '저장된 글꼴 이름';
    const option = document.createElement('option'); option.value = value; option.textContent = value; group.append(option); select.append(group);
  }
  select.value = value;
}
