import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function applyStyleFlowPatches({root}){
 const edit=async(file,fn)=>{const p=join(root,'src',file);await writeFile(p,fn((await readFile(p,'utf8')).replace(/\r\n/g,'\n')));};
 const replace=(s,b,a)=>{if(s.split(b).length!==2)throw new Error('Style flow seam drift: '+b);return s.replace(b,a);};
 await edit('engine/input-handler.ts',s=>{
  s="import {applySelectedCharacterStyle} from '../jueony/adapters/rhwp/style-flow.ts';\n"+s;
  return replace(s,'  applyStyle(styleId: number): void {\n    try {',`  applyStyle(styleId: number): void {
    const style=this.wasm.getStyleList().find(s=>s.id===styleId);
    if(style?.type===1){
      if(applySelectedCharacterStyle(this,this.wasm,styleId))return;
      this.applyCharFormat(this.wasm.getStyleDetail(styleId).charProps);return;
    }
    try {`);
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
