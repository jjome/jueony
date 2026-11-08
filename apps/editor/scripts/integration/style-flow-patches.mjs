import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function applyStyleFlowPatches({root}){
 const edit=async(file,fn)=>{const p=join(root,'src',file);await writeFile(p,fn((await readFile(p,'utf8')).replace(/\r\n/g,'\n')));};
 const replace=(s,b,a)=>{if(s.split(b).length!==2)throw new Error('Style flow seam drift: '+b);return s.replace(b,a);};
 await edit('engine/input-handler.ts',s=>{
  s="import {storeCharacterStyleUiSelectionN012,consumeCharacterStyleUiSelectionN012} from '../jueony/adapters/rhwp/stored-character-style-ui-consumer-n012.ts';\nimport type {StoredCharacterStyleUiTokenN012} from '../jueony/adapters/rhwp/stored-character-style-ui-consumer-n012.ts';\n"+s;
  s=replace(s,'  applyStyle(styleId: number): void {\n    try {',`  applyStyle(styleId: number): void {
    const style=this.wasm.getStyleList().find(s=>s.id===styleId);
    if(style?.type===1){
      const stored=storeCharacterStyleUiSelectionN012(this.wasm,styleId);
      if(stored.status!=='stored')throw new Error('저장 글자 스타일을 최신 목록에서 다시 선택하세요.');
      if(this.applyStoredCharacterStyleUiSelectionN012(stored.token))return;
      this.applyCharFormat(this.wasm.getStyleDetail(styleId).charProps);return;
    }
    try {`);
  return replace(s,'  applyStyle(styleId: number): void {',`  private applyStoredCharacterStyleUiSelectionN012(token: StoredCharacterStyleUiTokenN012): boolean {
    const result=consumeCharacterStyleUiSelectionN012(this,this.wasm,token);
    if(result.status==='rejected')throw new Error('저장 글자 스타일을 최신 목록에서 다시 선택하세요.');
    return result.status==='applied';
  }

  applyStyle(styleId: number): void {`);
 });
 await edit('engine/command.ts',s=>{
  s="import {nextParagraphStyle} from '../jueony/adapters/rhwp/style-flow.ts';\n"+s;
  return replace(s,'    const result = JSON.parse(wasm.splitParagraph(sec, para, charOffset));\n    if (result.ok) {',`    const nextStyle=nextParagraphStyle(wasm,sec,para,charOffset);
    const result = JSON.parse(wasm.splitParagraph(sec, para, charOffset));
    if (result.ok) {
      if(nextStyle!==undefined && result.paraIdx===para+1){
        if(!wasm.applyStyle(sec,result.paraIdx,nextStyle).ok)throw new Error('다음 문단 스타일을 적용하지 못했습니다.');
      }`);
 });
 await edit('command/commands/format.ts',s=>replace(s,"    id: 'format:apply-style',\n    label: t('command.format.applyStyle.registryLabel'),\n    canExecute: (ctx) => ctx.hasDocument,", "    id: 'format:apply-style',\n    label: t('command.format.applyStyle.registryLabel'),\n    canExecute: (ctx) => ctx.hasDocument && ctx.isEditable && !ctx.isFormMode,"));
}
