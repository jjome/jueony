import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Generated Studio integration only. The fixed reference repository stays read-only. */
export async function applyDocumentTabCyclePatches({root}){
 const replace=(source,before,after)=>{if(source.split(before).length!==2)throw new Error('Document tab cycle seam drift: '+before);return source.replace(before,after);};
 const installPath=join(root,'src/jueony/shortcuts/install.ts'),mapPath=join(root,'src/jueony/shortcuts/keymap.ts');
 let install=(await readFile(installPath,'utf8')).replace(/\r\n/g,'\n'),map=(await readFile(mapPath,'utf8')).replace(/\r\n/g,'\n');
 if(install.includes('ext:jueony-literal-table-tab')||map.includes('ext:jueony-literal-table-tab'))throw new Error('Document tab cycle patch is already applied');
 install="import {InsertTabCommand} from '../../engine/command';\n"+install;
 install=replace(install,"  register('ext:jueony-normal', '보통 모양',",`  const canInsertTableTab=(c:any)=>{
    const ih=input();return Boolean(ih)&&ih.active!==false&&!ih.isComposing&&!ih.isFormMode?.()&&!ih.wasm?.requiresPasswordForSave
      &&c.hasDocument&&c.isEditable&&!c.isFormMode&&c.inTable&&!c.inCellSelectionMode&&!c.inPictureObjectSelection&&!c.inTableObjectSelection
      &&!ih.cursor.hasSelection()&&!ih.cursor.isInHeaderFooter()&&!ih.cursor.isInFootnote()&&!ih.cursor.isInTextBox();
  };
  registry.register({id:'ext:jueony-literal-table-tab',label:'표 안에 탭 삽입',
    canExecute:canInsertTableTab,
    execute:()=>{if(!canInsertTableTab(automation.getContext()))throw new Error('현재 문맥에서는 표 안에 탭을 삽입할 수 없습니다.');const ih=input();ih.executeOperation({kind:'command',command:new InsertTabCommand(ih.getCursorPosition())});},
  });
  register('ext:jueony-normal', '보통 모양',`);
 const contextAnchor='    const c = automation.getContext();';
 install=replace(install,contextAnchor,contextAnchor+`
    // The host owns body document tabs. Do not swallow the table-only
    // Ctrl+Shift+Tab binding as an unavailable body command before the host
    // capture listener can process it. All table and special-story paths stay local.
    if(window.parent!==window&&event.isTrusted&&event.ctrlKey&&!event.altKey&&!event.metaKey&&(event.key==='Tab'||event.code==='Tab')
      &&!event.isComposing&&!ih?.isComposing&&event.keyCode!==229&&c.hasDocument&&!c.isFormMode
      &&!c.inTable&&!c.inCellSelectionMode&&!c.inPictureObjectSelection&&!c.inTableObjectSelection
      &&!ih?.cursor?.isInHeaderFooter()&&!ih?.cursor?.isInFootnote()&&!ih?.cursor?.isInTextBox()){
      resolver.reset();return;
    }`);
 map=replace(map,"  binding('Ctrl+Shift+Tab', 'ext:jueony-hanging-indent', '빠른 내어쓰기', 'table'),",
   "  binding('Ctrl+Shift+Tab', 'ext:jueony-hanging-indent', '빠른 내어쓰기', 'table'),\n  {...binding('Ctrl+Tab', 'ext:jueony-literal-table-tab', '표 안에 탭 삽입', 'table'),repeatable:true},");
 await writeFile(installPath,install);await writeFile(mapPath,map);
}
