import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const once=(source,before,after,label)=>{if(source.split(before).length!==2)throw Error('Format dialog target seam drift: '+label);return source.replace(before,after);};

/** Patch the pinned command source. The nested seam exists only with tab-feature patches. */
export function patchFormatDialogCommands(source){
 source=source.replace(/\r\n/g,'\n');
 source="import {captureFormatDialogTarget,showFormatDialogError} from '../../jueony/adapters/browser/format-dialog-target.ts';\n"+source;
 for(const kind of ['Char','Para'])source=once(source,`      const dialog = new ${kind}ShapeDialog(services.wasm, services.eventBus);`,`      const dialog = new ${kind}ShapeDialog(services.wasm, services.eventBus);\n      const dialogTarget = captureFormatDialogTarget(services);`,kind+' capture');
 source=once(source,'      dialog.onApply = (mods) => {\n        // fontName', '      dialog.onApply = (mods) => {\n        dialogTarget.assertCurrent();\n        // fontName','char guard');
 source=once(source,'      dialog.onApply = (mods) => {\n        ih.applyParaPropsToRange','      dialog.onApply = (mods) => {\n        dialogTarget.assertCurrent();\n        ih.applyParaPropsToRange','para guard');
 const nestedImport="import { DefaultTabSpacingDialog } from '@/ui/default-tab-spacing-dialog';";
 const nestedBefore='        const defaultTabs = new DefaultTabSpacingDialog(services, curPos.sectionIndex, applied);';
 if(source.includes(nestedImport))source=once(source,nestedBefore,`        try { dialogTarget.assertCurrent(); } catch(error) { showFormatDialogError(dialog,error); return; }
        const defaultTabs = new DefaultTabSpacingDialog(services, curPos.sectionIndex, raw => { dialogTarget.acceptOwnChange(); applied(raw); });`,'nested owned edit');
 else if(source.includes(nestedBefore))throw Error('Format dialog target seam drift: nested dialog import');
 return source;
}

/** Apply after tab-feature patches; only the two ordinary format commands capture a target. */
export async function applyFormatDialogTargetPatches({root}){
 const edit=async(file,transform)=>{const path=join(root,'src',file);await writeFile(path,transform((await readFile(path,'utf8')).replace(/\r\n/g,'\n')));};
 await edit('command/commands/format.ts',patchFormatDialogCommands);
 for(const file of ['ui/char-shape-dialog.ts','ui/para-shape-dialog.ts'])await edit(file,source=>{
  source="import {showFormatDialogError} from '../jueony/adapters/browser/format-dialog-target.ts';\n"+source;
  return once(source,'    if (this.onApply) this.onApply(mods);\n    this.hide();','    try { if (this.onApply) this.onApply(mods); }\n    catch(error) { showFormatDialogError(this,error); return; }\n    this.hide();',file+' guarded confirm');
 });
}
