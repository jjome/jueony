/** Studio-only manual commands. All document mutations use its snapshot router. */
export const captionPlacements = {
  top: ['Top', 'Top'], lt: ['Left', 'Top'], lm: ['Left', 'Center'], lb: ['Left', 'Bottom'],
  rt: ['Right', 'Top'], rm: ['Right', 'Center'], rb: ['Right', 'Bottom'], bottom: ['Bottom', 'Top'],
} as const;
export type CaptionPlacement = keyof typeof captionPlacements | 'none';
type Props = Record<string, unknown>;

export function isBodyCaptionTarget(ref: any): boolean {
  return Boolean(ref && ['image', 'shape'].includes(ref.type) && !ref.cellPath?.length && ref.cellIdx === undefined && !ref.headerFooter && !ref.noteRef);
}

export function captionPatch(current: Props, placement: CaptionPlacement, table = false): Props | null {
  if (placement === 'none') return current.hasCaption ? { hasCaption: false } : null;
  const [direction, align] = captionPlacements[placement];
  const patch: Props = {
    hasCaption: true,
    captionDirection: table ? ['Left', 'Right', 'Top', 'Bottom'].indexOf(direction) : direction,
    captionVertAlign: table ? ['Top', 'Center', 'Bottom'].indexOf(align) : align,
    ...(!current.hasCaption ? { captionWidth: Math.round(30 * 7200 / 25.4), captionSpacing: Math.round(3 * 7200 / 25.4), ...(!table ? { captionIncludeMargin: false } : {}) } : {}),
  };
  return Object.entries(patch).every(([key, value]) => current[key] === value) ? null : patch;
}

/** Does not emit dirty/history separately; the router owns commit, rollback and refresh. */
export function applyCaptionSnapshot(input: any, target: any, patch: Props | null, apply: (wasm: any, target: any, patch: Props) => unknown): boolean {
  if (!patch) return false;
  let changed = false;
  input.executeOperation({
    kind: 'snapshot', operationType: 'jueonyCaption',
    operation: (wasm: any) => {
      const result = apply(wasm, target, patch) as { ok?: boolean } | undefined;
      if (result?.ok === false) throw new Error('캡션 변경이 적용되지 않았습니다.');
      changed = true;
      return { sectionIndex: target.sec, paragraphIndex: target.ppi, charOffset: 0 };
    },
  });
  return changed;
}

export function installCaptionCommands({ registry, input, getObjectProps, setObjectProps }: {
  registry: any; input: () => any;
  getObjectProps: (wasm: any, ref: any) => Props;
  setObjectProps: (wasm: any, ref: any, props: Props) => unknown;
}): void {
  const target = (ih: any) => {
    // Nested/HF shapes require a different text-entry and history-context contract.
    const picture = ih?.getSelectedPictureRef?.();
    if (picture) return isBodyCaptionTarget(picture) && !ih?.cursor?.isMultiPictureSelection?.() ? { ...picture, table: false } : null;
    const table = ih?.getSelectedTableRef?.();
    if (table) return !table.cellPath?.length ? { ...table, table: true } : null;
    return null;
  };
  const read = (wasm: any, ref: any): Props => ref.table ? wasm.getTableProperties(ref.sec, ref.ppi, ref.ci) : getObjectProps(wasm, ref);
  const write = (wasm: any, ref: any, props: Props) => ref.table ? wasm.setTableProperties(ref.sec, ref.ppi, ref.ci, props) : setObjectProps(wasm, ref, props);
  const labels: Record<CaptionPlacement, string> = { top: '위 캡션', lt: '왼쪽 위 캡션', lm: '왼쪽 가운데 캡션', lb: '왼쪽 아래 캡션', rt: '오른쪽 위 캡션', rm: '오른쪽 가운데 캡션', rb: '오른쪽 아래 캡션', bottom: '아래 캡션', none: '캡션 없음' };
  for (const placement of [...Object.keys(captionPlacements), 'none'] as CaptionPlacement[]) {
    registry.register({
      id: 'insert:caption-' + placement, label: labels[placement],
      canExecute: (ctx: any) => ctx.hasDocument && ctx.isEditable && !ctx.isFormMode && Boolean(target(input())),
      execute: (services: any) => {
        const ih = input(), ref = target(ih);
        if (!ref) throw new Error('본문의 그림·도형 또는 표 개체를 먼저 선택하세요.');
        applyCaptionSnapshot(ih, ref, captionPatch(read(services.wasm, ref), placement, ref.table), write);
        ih.focus();
      },
    });
  }
}
