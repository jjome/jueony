type Target = { kind: 'table' | 'picture' | 'equation'; ref: any };
type Guard = (dialog: any, method: 'onConfirm' | 'handleOk') => void;
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

/** Resolve the selection's canonical address, never an unrelated cursor cell. */
export function selectedObjectPropertyTarget(input: any): Target {
  const table = input?.getSelectedTableRef?.();
  if (table) {
    if (table.cellPath?.length) throw new Error('중첩 표 개체 속성 고치기는 아직 지원하지 않습니다.');
    if (![table.sec, table.ppi, table.ci].every(integer)) throw new Error('선택한 표의 주소가 유효하지 않습니다.');
    return { kind: 'table', ref: structuredClone(table) };
  }
  if (input?.cursor?.isMultiPictureSelection?.()) throw new Error('개체를 하나만 선택한 뒤 고치기를 실행하세요.');
  const original = input?.getSelectedPictureRef?.();
  if (!original) throw new Error('고칠 표·그림·도형·선·그룹·수식을 먼저 선택하세요. 커서 앞 제어 자동 검색은 아직 지원하지 않습니다.');
  const ref = structuredClone(original);
  if (![ref.sec, ref.ppi, ref.ci].every(integer)) throw new Error('선택한 개체의 주소가 유효하지 않습니다.');
  if (ref.type === 'equation') {
    if (ref.headerFooter || (ref.cellPath?.length ?? 0) > 1 || (ref.cellPath?.length && (!integer(ref.cellIdx) || !integer(ref.cellParaIdx)))) throw new Error('머리말/꼬리말 또는 중첩 셀의 수식 속성은 아직 지원하지 않습니다.');
    return { kind: 'equation', ref };
  }
  if (!['image', 'shape', 'line', 'group'].includes(ref.type)) throw new Error('이 종류의 개체 고치기는 아직 지원하지 않습니다. OLE 원본 편집과 차트 데이터는 별도 기능입니다.');
  if (ref.noteRef) throw new Error('각주/미주 안 그림·도형 속성은 아직 지원하지 않습니다.');
  if (ref.headerFooter && ref.type !== 'image') throw new Error('머리말/꼬리말의 도형·선·그룹 속성은 아직 지원하지 않습니다.');
  if (ref.cellIdx !== undefined && !ref.cellPath?.length) {
    if (![ref.cellIdx, ref.cellParaIdx, ref.outerTableControlIdx].every(integer)) throw new Error('표 셀 안 개체의 전체 주소를 확인하지 못했습니다.');
    ref.cellPath = [{ controlIdx: ref.outerTableControlIdx, cellIdx: ref.cellIdx, cellParaIdx: ref.cellParaIdx }];
  }
  return { kind: 'picture', ref };
}

export function selectedObjectPropertiesAllowed(context: any, input: any): boolean {
  if (!context?.hasDocument || !context.isEditable || context.isFormMode || input?.isComposing || input?.wasm?.requiresPasswordForSave) return false;
  try { selectedObjectPropertyTarget(input); return true; } catch { return false; }
}

/** Small legacy-dialog seam: confirmation must still target the same live state. */
export function guardSelectedObjectConfirmation(dialog: any, method: 'onConfirm' | 'handleOk', assertCurrent: () => void, report: (dialog: any, message: string) => void): void {
  const original = dialog[method];
  if (typeof original !== 'function') throw new Error('개체 속성 대화상자의 확인 계약이 바뀌었습니다.');
  dialog[method] = function (...args: any[]) {
    try { assertCurrent(); } catch (error) { report(this, error instanceof Error ? error.message : String(error)); return false; }
    return original.apply(this, args);
  };
}

function reportDialogError(dialog: any, message: string): void {
  const root = dialog.overlay as HTMLElement | undefined;
  if (!root) throw new Error(message);
  let status = root.querySelector<HTMLElement>('[data-jueony-object-properties-error]');
  if (!status) { status = document.createElement('p'); status.dataset.jueonyObjectPropertiesError = 'true'; status.setAttribute('role', 'alert'); status.style.padding = '8px 16px'; (root.querySelector('.dialog-wrap') ?? root).append(status); }
  status.textContent = message;
}

/** All object kinds reuse their existing dialog and its history/save owner. */
export function installSelectedObjectProperties({ registry, input, openTable, openPicture, openEquation }: {
  registry: any; input: () => any;
  openTable: (services: any, target: any, guard: Guard) => void;
  openPicture: (services: any, target: any, guard: Guard) => void;
  openEquation: (services: any, target: any, guard: Guard) => void;
}): void {
  registry.register({ id: 'format:object-properties', label: '선택 개체 고치기', shortcutLabel: 'Ctrl+N,K', opensDialog: true,
    canExecute: (context: any) => selectedObjectPropertiesAllowed(context, input()),
    execute: (services: any) => {
      const target = selectedObjectPropertyTarget(input()), api = (window as any).jueonyEditor;
      if (!selectedObjectPropertiesAllowed(services.getContext(), input())) throw new Error('현재 문서 상태에서는 개체 속성을 고칠 수 없습니다.');
      const revision = api.revision();
      const assertCurrent = () => {
        if (api.busy() || api.revision() !== revision || !selectedObjectPropertiesAllowed(services.getContext(), input()) || JSON.stringify(selectedObjectPropertyTarget(input())) !== JSON.stringify(target)) throw new Error('문서나 선택 개체가 바뀌었습니다. 취소한 뒤 고치기를 다시 실행하세요.');
      };
      const guard: Guard = (dialog, method) => guardSelectedObjectConfirmation(dialog, method, assertCurrent, reportDialogError);
      if (target.kind === 'table') openTable(services, target.ref, guard);
      else if (target.kind === 'equation') openEquation(services, target.ref, guard);
      else openPicture(services, target.ref, guard);
    },
  });
  const anchor = document.querySelector('.md-item[data-cmd="edit:format-copy"]');
  if (anchor) { const item = document.createElement('div'); item.className = 'md-item'; item.dataset.cmd = 'format:object-properties'; const label = document.createElement('span'); label.className = 'md-label'; label.textContent = '선택 개체 고치기'; const shortcut = document.createElement('span'); shortcut.className = 'md-shortcut'; shortcut.textContent = 'Ctrl+N,K'; item.append(label, shortcut); anchor.after(item); }
}
