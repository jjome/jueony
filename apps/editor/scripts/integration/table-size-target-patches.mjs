import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Table/cell property forms belong to the document and selection that opened them. */
export async function applyTableSizeTargetPatches({root}){
 const path=join(root,'src/ui/table-cell-props-dialog.ts');
 let source=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
 const once=(before,after,label)=>{if(source.split(before).length!==2)throw Error('Table size target seam drift: '+label);source=source.replace(before,after);};
 source="import {captureFormatDialogTarget,showFormatDialogError} from '../jueony/adapters/browser/format-dialog-target.ts';\n"+source;
 once('  private cellProps!: CellProperties;','  private jueonyTableTarget!: ReturnType<typeof captureFormatDialogTarget>;\n  private cellProps!: CellProperties;','target field');
 once('  show(): void {\n    super.show();','  show(): void {\n    this.jueonyTableTarget = captureFormatDialogTarget({wasm:this.wasm,getInputHandler:()=>this.services?.getInputHandler()});\n    super.show();','capture target');
 once('  protected onConfirm(): void {\n    const { sec, ppi, ci } = this.tableCtx;','  protected onConfirm(): void | boolean {\n    try { this.jueonyTableTarget.assertCurrent(); } catch(error) { showFormatDialogError(this,error); return false; }\n    const { sec, ppi, ci } = this.tableCtx;','reject stale target before collecting or writing');
 await writeFile(path,source);
}
