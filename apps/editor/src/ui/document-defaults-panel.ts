import { readDocumentDefaults, resetDocumentDefaults, saveDocumentDefaults } from '../modules/preferences/public/index.ts';
import type { PageDefaults } from '../modules/preferences/public/index.ts';
import { bindClick, element as $, selectOptions } from './dom.ts';

type PageNumberField = Exclude<keyof PageDefaults, 'landscape'>;
const defaultLabels: Record<PageNumberField, string> = {
  widthMm: '용지 너비 (mm)', heightMm: '용지 높이 (mm)',
  marginLeftMm: '왼쪽 여백 (mm)', marginRightMm: '오른쪽 여백 (mm)',
  marginTopMm: '위쪽 여백 (mm)', marginBottomMm: '아래쪽 여백 (mm)',
  marginHeaderMm: '머리말 (mm)', marginFooterMm: '꼬리말 (mm)',
};

export function installDocumentDefaultsPanel(deps: { status: (message: string) => void; error: (cause: unknown) => void }): void {
  const on = bindClick(deps.error);
  const showError = (cause: unknown) => { $('defaults-error').textContent = cause instanceof Error ? cause.message : String(cause); };

  function fillDefaults(): void {
    const settings = readDocumentDefaults(localStorage);
    $<HTMLInputElement>('defaults-enabled').checked = settings.enabled;
    $('defaults-fields').replaceChildren();
    $('defaults-error').textContent = '';
    for (const key of Object.keys(defaultLabels) as PageNumberField[]) {
      const label = document.createElement('label'); label.textContent = defaultLabels[key];
      const input = document.createElement('input');
      input.type = 'number'; input.step = '0.1'; input.required = true; input.min = '0'; input.max = '1000';
      input.dataset.defaultField = key; input.value = String(settings.page[key]);
      label.append(input); $('defaults-fields').append(label);
    }
    const direction = document.createElement('label'); direction.textContent = '용지 방향';
    const select = document.createElement('select'); select.id = 'defaults-landscape';
    selectOptions(select, [{ value: 'false', text: '세로' }, { value: 'true', text: '가로' }], String(settings.page.landscape));
    direction.append(select); $('defaults-fields').append(direction);
    for (const [key, text, value] of [['family', '기본 글꼴', settings.font.family], ['sizePt', '기본 크기 (pt)', String(settings.font.sizePt)]]) {
      const label = document.createElement('label'); label.textContent = text;
      const input = document.createElement('input');
      input.dataset.defaultFont = key; input.value = value; input.required = true;
      if (key === 'sizePt') { input.type = 'number'; input.min = '1'; input.max = '200'; input.step = '0.1'; }
      label.append(input); $('defaults-fields').append(label);
    }
  }

  on('document-defaults', () => {
    $<HTMLDialogElement>('defaults-dialog').showModal();
    try { fillDefaults(); } catch (cause) { showError(cause); }
  });
  on('close-defaults', () => $<HTMLDialogElement>('defaults-dialog').close());
  on('reset-defaults', () => {
    resetDocumentDefaults(localStorage);
    fillDefaults();
    deps.status('새 문서 기본값을 복원했습니다. 기존 문서는 유지됩니다.' + ($('app-shell').inert ? ' 창을 새로고침하여 편집기를 다시 시작하세요.' : ''));
  });
  $('defaults-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const settings = readDocumentDefaults(localStorage);
      settings.enabled = $<HTMLInputElement>('defaults-enabled').checked;
      for (const input of $('defaults-fields').querySelectorAll<HTMLInputElement>('[data-default-field]')) {
        const key = input.dataset.defaultField;
        if (key && Object.hasOwn(defaultLabels, key)) settings.page[key as PageNumberField] = Number(input.value);
      }
      settings.page.landscape = $<HTMLSelectElement>('defaults-landscape').value === 'true';
      for (const input of $('defaults-fields').querySelectorAll<HTMLInputElement>('[data-default-font]')) {
        if (input.dataset.defaultFont === 'sizePt') settings.font.sizePt = Number(input.value);
        else if (input.dataset.defaultFont === 'family') settings.font.family = input.value;
      }
      saveDocumentDefaults(localStorage, settings);
      $<HTMLDialogElement>('defaults-dialog').close();
      deps.status('새 문서 기본값을 저장했습니다. 다음 새 문서부터 적용합니다.');
    } catch (cause) { showError(cause); }
  });
}
