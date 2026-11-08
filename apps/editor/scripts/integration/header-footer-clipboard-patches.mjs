import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const once=(source,before,after,label)=>{if(source.split(before).length!==2)throw new Error('Header/footer clipboard integration drift: '+label);return source.replace(before,after);};
export async function applyHeaderFooterClipboardPatches({root}){
 const keyboardPath=join(root,'src/engine/input-handler-keyboard.ts');let keyboard=(await readFile(keyboardPath,'utf8')).replace(/\r\n/g,'\n');if(keyboard.includes('handleHeaderFooterCopy'))throw new Error('Header/footer clipboard integration drift: already applied');
 keyboard="import {handleHeaderFooterCopy,handleHeaderFooterCut,handleHeaderFooterPaste} from '../jueony/adapters/rhwp/header-footer-clipboard-studio.ts';\n"+keyboard;
 keyboard=once(keyboard,'export function onCopy(this: any, e: ClipboardEvent): void {\n  if (!this.active) return;','export function onCopy(this: any, e: ClipboardEvent): void {\n  if (!this.active) return;\n  if (handleHeaderFooterCopy(this, e)) return;','copy hook');
 keyboard=once(keyboard,`export function onCut(this: any, e: ClipboardEvent): void {
  if (!this.active) return;
  if (this.isFormMode?.()) {
    e.preventDefault();
    return;
  }`,`export function onCut(this: any, e: ClipboardEvent): void {
  if (!this.active) return;
  if (this.isFormMode?.()) {
    e.preventDefault();
    return;
  }
  if (handleHeaderFooterCut(this, e)) return;`,'cut hook');
 keyboard=once(keyboard,`  e.preventDefault();
  if (this.isFormMode?.()) return;

  // 개체/표 선택 모드 해제 후 붙여넣기 진행`,`  e.preventDefault();
  if (this.isFormMode?.()) return;
  if (handleHeaderFooterPaste(this, e)) return;

  // 개체/표 선택 모드 해제 후 붙여넣기 진행`,'paste hook');
 await writeFile(keyboardPath,keyboard);
 const inputPath=join(root,'src/engine/input-handler.ts');let input=(await readFile(inputPath,'utf8')).replace(/\r\n/g,'\n');
 input=once(input,`      restoreSelectionOnUndo?: boolean;
      allowCollapsed?: boolean;
    },`,`      restoreSelectionOnUndo?: boolean;
      allowCollapsed?: boolean;
      jueonyPreflight?: () => void;
      jueonyVerify?: () => void;
    },`,'guard options');
 input=once(input,`    this.cursor.clearSelection();
    try {
      this.executeOperation({`,`    try {
      options.jueonyPreflight?.();
      this.cursor.clearSelection();
      this.executeOperation({`,'guard preflight');
 input=once(input,`          if (!result.ok) throw new Error('HF 범위 치환을 코어가 거부했습니다');
          succeeded = true;`,`          if (!result.ok) throw new Error('HF 범위 치환을 코어가 거부했습니다');
          options.jueonyVerify?.();
          succeeded = true;`,'guard verification');
 await writeFile(inputPath,input);
}
