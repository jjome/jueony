/** The three-state shortcut changes baseline position only, preserving font/color/effects. */
export function nextScriptProperties(current: { superscript?: boolean; subscript?: boolean }): { superscript: boolean; subscript: boolean } {
  if (typeof current.superscript !== 'boolean' || typeof current.subscript !== 'boolean' || current.superscript && current.subscript) throw new Error('현재 위·아래 첨자 상태를 확인하지 못했습니다.');
  if (current.superscript) return { superscript: false, subscript: true };
  if (current.subscript) return { superscript: false, subscript: false };
  return { superscript: true, subscript: false };
}

/** Follow the actual local toolbar font order, not a second hardcoded font catalog. */
export function adjacentToolbarFont(fonts: readonly string[], current: string, direction: unknown): string {
  if (direction !== -1 && direction !== 1) throw new Error('글꼴 이동 방향을 확인하세요.');
  const entries = [...new Set(fonts.filter(font => typeof font === 'string' && font.trim() && !font.startsWith('__fontset__')))];
  const index = entries.indexOf(current);
  if (index < 0) throw new Error('현재 글꼴을 목록에서 찾지 못했습니다. 도구 상자에서 글꼴을 먼저 선택하세요.');
  return entries[(index + direction + entries.length) % entries.length];
}

export function canCycleCharacter(context: any, input: any, state: any, busy: boolean): boolean {
  return Boolean(input && input.active !== false && !input.isComposing && !input.isFormMode?.()
    && !input.wasm?.requiresPasswordForSave && context.hasDocument && context.isEditable && !context.isFormMode
    && !context.inPictureObjectSelection && !context.inTableObjectSelection && !context.inCellSelectionMode
    && !busy && state?.fontEnabled);
}

export function installCharacterCycles(registry: any, input: () => any, eventBus: any, automation: any): void {
  const api = () => (window as any).jueonyEditor;
  const canExecute = (context: any) => canCycleCharacter(context, input(), api()?.formattingState?.(), Boolean(api()?.busy?.()));
  const requireCurrent = () => {
    if (!canExecute(automation.getContext())) throw new Error('현재 문맥에서는 글자 서식을 순환할 수 없습니다.');
    return input();
  };
  registry.register({ id: 'ext:jueony-cycle-script', label: '위 첨자·아래 첨자·보통', canExecute,
    execute: () => { const ih = requireCurrent(); eventBus.emit('format-char', nextScriptProperties(ih.getCharProperties())); },
  });
  registry.register({ id: 'ext:jueony-cycle-font', label: '이전·다음 글꼴', canExecute,
    execute: (_services: any, params: any) => {
      requireCurrent();
      const state = api().formattingState(), name = adjacentToolbarFont(state.fonts, state.fontFamily, params?.direction);
      if (name === state.fontFamily) return;
      const result = automation.execute('format:set-font-family', { name, language: state.language, expected: state });
      if (!result.ok) throw new Error(result.message ?? '현재 위치에서 글꼴을 변경할 수 없습니다.');
    },
  });
}
