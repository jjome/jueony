import { validateStyleDefinition } from '../../modules/document/public/index.ts';
import type { StyleDefinition } from '../../modules/document/public/index.ts';

export function assertStyleDialogCurrent(revision: string | undefined, wasm: any, services: any) {
  const api = (window as any).jueonyEditor, context = (window as any).rhwpStudio?.automation.getContext();
  if (!services?.getInputHandler() || api?.busy() || api?.revision() !== revision || wasm.requiresPasswordForSave
    || !context?.isEditable || context.isFormMode) throw new Error('문서 상태가 바뀌었거나 편집할 수 없습니다. 창을 닫고 다시 스타일을 편집하세요.');
}

/** Nested shape dialogs only update this detached draft, including font names. */
export function styleDraftPreview(original: any, mods: Record<string, any>, kind: 'char' | 'para') {
  const result = structuredClone(original);
  for (const [key, value] of Object.entries(mods)) {
    if (kind === 'char' && key === 'fontName') { result.fontFamily = value; result.fontFamilies = Array(7).fill(value); }
    else if (kind === 'para' && ['marginLeft','marginRight','indent'].includes(key)) result[key] = value / 150;
    else if (kind === 'para' && ['spacingBefore','spacingAfter'].includes(key)) result[key] = value / 75;
    else if (kind === 'para' && key === 'lineSpacing') result[key] = (mods.lineSpacingType ?? original.lineSpacingType ?? 'Percent') === 'Percent' ? value : value / 75;
    else result[key] = structuredClone(value);
  }
  return result;
}

export function normalizeStyleCharMods(wasm: any, draft: Record<string, any>) {
  const mods = structuredClone(draft);
  if (mods.fontName) {
    mods.fontIds = Array.from({length:7}, (_, language) => wasm.findOrCreateFontIdForLang(language, mods.fontName));
    if (mods.fontIds.some((id: number) => !Number.isInteger(id) || id < 0 || id > 65535)) throw new Error('글꼴을 스타일에 등록하지 못했습니다.');
    delete mods.fontName;
  }
  return mods;
}

/** Current shape propagation is implemented for body and flat table cells only. */
export function assertStyleShapeScope(wasm: any) {
  const doc=wasm.borrowDocumentHandle();
  if(typeof doc.styleShapeStoriesEnabled==='function'&&doc.styleShapeStoriesEnabled())return;
  const model = JSON.parse(doc.getCursorModel());
  if (model.lists.some((list: any) => !list.isCell || list.hostListId !== 0)) throw new Error('중첩 표·머리말·각주·글상자 등이 있는 문서의 스타일 모양 변경은 아직 지원하지 않습니다.');
}

export function applyStyleDefinition(wasm: any, mode: 'add' | 'edit', id: number, definition: StyleDefinition,
  base: {charShapeId?: number; paraShapeId?: number}, charDraft: Record<string, any>, paraDraft: Record<string, any>) {
  const value = validateStyleDefinition(wasm.getStyleList(), definition, mode === 'edit' ? id : undefined);
  const changingShapes = Object.keys(charDraft).length > 0 || value.type === 0 && Object.keys(paraDraft).length > 0;
  if (mode === 'edit' && changingShapes) assertStyleShapeScope(wasm);
  const charMods = normalizeStyleCharMods(wasm, charDraft), paraMods = value.type === 0 ? paraDraft : {};
  const target = mode === 'add' ? wasm.createStyle(JSON.stringify({...value,
    ...(base.charShapeId === undefined ? {} : {baseCharShapeId:base.charShapeId}),
    ...(base.paraShapeId === undefined ? {} : {baseParaShapeId:base.paraShapeId}),
  })) : id;
  if (!Number.isInteger(target) || target < 0 || target > 255) throw new Error('스타일 생성에 실패했습니다.');
  if (mode === 'edit' && !wasm.updateStyle(id, JSON.stringify(value))) throw new Error('스타일 변경에 실패했습니다.');
  if (changingShapes && !wasm.updateStyleShapes(target, JSON.stringify(charMods), JSON.stringify(paraMods))) throw new Error('스타일 모양 적용에 실패했습니다.');
  return target;
}

export function cloneStyleDefinition(wasm: any, id: number) {
  const styles = wasm.getStyleList(), source = styles.find((s: any) => s.id === id);
  if (!source) throw new Error('복제할 스타일이 없습니다.');
  let name = source.name.slice(0, 235) + ' 복사', suffix = 2;
  while (styles.some((s: any) => s.name.normalize('NFC') === name.normalize('NFC'))) name = source.name.slice(0, 235) + ' 복사 ' + suffix++;
  const value = validateStyleDefinition(styles, {...source, name, englishName: ''});
  const newId = wasm.createStyle(JSON.stringify({...value,baseCharShapeId:source.charShapeId,baseParaShapeId:source.paraShapeId}));
  if (newId < 0 || newId > 255) throw new Error('스타일 복제에 실패했습니다.');
  if (source.type === 0 && source.nextStyleId === source.id && !wasm.updateStyle(newId,JSON.stringify({nextStyleId:newId}))) throw new Error('복제한 다음 스타일 연결에 실패했습니다.');
  return newId;
}

export function moveStyleDefinition(wasm:any,id:number,direction:-1|1):number {
  const styles=wasm.getStyleList(),destination=id+direction;
  if(!Number.isInteger(id)||id<1||!styles.some((s:any)=>s.id===id)||destination<1||destination>=styles.length)throw new Error('바탕글은 이동할 수 없으며 목록 끝을 넘길 수 없습니다.');
  if(!wasm.moveStyle(id,destination))throw new Error('스타일 순서를 변경하지 못했습니다.');
  return destination;
}
