import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
/** Generated Studio seams only; policies and native mutation are owned by adapters. */
export async function applyStyleManagementPatches({root}) {
  const replace=(s,b,a,label)=>{if(s.split(b).length!==2)throw new Error('스타일 패치 기준 불일치: '+label);return s.replace(b,a);};
  const edit=async(file,transform)=>{const path=join(root,'src',file);await writeFile(path,transform((await readFile(path,'utf8')).replace(/\r\n/g,'\n')));};
  await edit('ui/style-edit-dialog.ts',s=>{
    s="import {assertStyleDialogCurrent, styleDraftPreview, applyStyleDefinition} from '../jueony/adapters/rhwp/style-management.ts';\nimport {validateStyleDefinition} from '../jueony/modules/document/public/index.ts';\n"+s;
    s=replace(s,"  private paraModsJson = '{}';","  private paraModsJson = '{}';\n  private jueonyRevision: string | undefined;\n  private jueonyError!: HTMLParagraphElement;",'edit state');
    s=replace(s,'    this.nameInput.maxLength = MAX_STYLE_NAME_LEN;',"    this.nameInput.maxLength = MAX_STYLE_NAME_LEN;\n    this.nameInput.setAttribute('aria-label','스타일 이름');",'name label');
    s=replace(s,'    this.enNameInput.maxLength = MAX_STYLE_NAME_LEN;',"    this.enNameInput.maxLength = MAX_STYLE_NAME_LEN;\n    this.enNameInput.setAttribute('aria-label','스타일 영문 이름');",'english label');
    s=replace(s,"    body.appendChild(note);","    body.appendChild(note);\n    this.jueonyError=document.createElement('p');this.jueonyError.setAttribute('role','alert');body.appendChild(this.jueonyError);",'edit errors');
    s=replace(s,"    btnPara.textContent = t('dialog.styleEdit.btnPara.text');","    btnPara.textContent = t('dialog.styleEdit.btnPara.text');\n    btnPara.disabled = this.styleInfo.type === 1;",'char para disabled');
    s=replace(s,"  private onTypeChange(): void {","  private onTypeChange(): void {\n    const button=this.dialog.querySelector<HTMLButtonElement>('.se-shape-btn');if(button)button.disabled=!!this.typeChar?.checked;",'type controls');
    const start=s.indexOf('  private openParaDialog(): void {'),end=s.indexOf('  protected onConfirm(): boolean {',start);
    if(start<0||end<0)throw new Error('스타일 서브 대화상자 없음');
    s=s.slice(0,start)+`  private openParaDialog(): void {
    if(this.typeChar?.checked || this.styleInfo.type === 1)return;
    const original=this.addMode ? this.baseInfo.paraProps ?? {} : this.wasm.getStyleDetail(this.styleInfo.id).paraProps;
    const dialog=new ParaShapeDialog(this.wasm,this.eventBus);
    dialog.onApply=mods=>{this.paraModsJson=JSON.stringify({...JSON.parse(this.paraModsJson),...mods});};
    dialog.show(styleDraftPreview(original,JSON.parse(this.paraModsJson),'para'));
  }
  private openCharDialog(): void {
    const original=this.addMode ? this.baseInfo.charProps ?? {} : this.wasm.getStyleDetail(this.styleInfo.id).charProps;
    const dialog=new CharShapeDialog(this.wasm,this.eventBus);
    dialog.onApply=mods=>{this.charModsJson=JSON.stringify({...JSON.parse(this.charModsJson),...mods});};
    dialog.show(styleDraftPreview(original,JSON.parse(this.charModsJson),'char'));
  }

`+s.slice(end);
    s=replace(s,'    const styleType = this.typePara?.checked ? 0 : (this.styleInfo.type ?? 0);','    const styleType = this.addMode ? (this.typeChar?.checked ? 1 : 0) : this.styleInfo.type;','char type');
    const applyStart=s.indexOf('    const apply = (wasm: WasmBridge): boolean => {'),applyEnd=s.indexOf('\n    try {\n      const ih = this.services?.getInputHandler();',applyStart);
    if(applyStart<0||applyEnd<0)throw new Error('스타일 저장 경계 없음');
    s=s.slice(0,applyStart)+`    try {
      assertStyleDialogCurrent(this.jueonyRevision,this.wasm,this.services);
      validateStyleDefinition(this.wasm.getStyleList() as any,{name,englishName,type:styleType as 0|1,nextStyleId},this.addMode?undefined:this.styleInfo.id);
    } catch(error) {this.jueonyError.textContent=error instanceof Error?error.message:String(error);return false;}
    const original=this.wasm.getStyleList().find(s=>s.id===this.styleInfo.id);
    if(!this.addMode && original?.name===name && original.englishName===englishName
      && original.nextStyleId===nextStyleId && this.charModsJson==='{}' && this.paraModsJson==='{}') {
      this.onSave?.();return true;
    }
    const apply = (wasm: WasmBridge): boolean => {
      applyStyleDefinition(wasm,this.addMode?'add':'edit',this.styleInfo.id,{name,englishName,type:styleType as 0|1,nextStyleId},
        {charShapeId:this.baseInfo.charProps?.charShapeId,paraShapeId:this.baseInfo.paraProps?.paraShapeId},JSON.parse(this.charModsJson),JSON.parse(this.paraModsJson));
      return true;
    };
`+s.slice(applyEnd);
    s=replace(s,"      console.warn('[StyleEditDialog] 저장 실패:', err);","      this.jueonyError.textContent=err instanceof Error?err.message:String(err);",'visible save error');
    return replace(s,'  override show(): void {\n    super.show();',"  override show(): void {\n    this.jueonyRevision=(window as any).jueonyEditor?.revision();\n    super.show();",'edit revision');
  });
  await edit('ui/style-dialog.ts',s=>{
    s="import {assertStyleDialogCurrent,cloneStyleDefinition} from '../jueony/adapters/rhwp/style-management.ts';\n"+s;
    s=replace(s,'  private styles: StyleEntry[] = [];','  private styles: StyleEntry[] = [];\n  private jueonyRevision: string | undefined;\n  private jueonyError!: HTMLParagraphElement;','manager state');
    s=replace(s,"    this.styleList.className = 'sd-style-list';","    this.styleList.className = 'sd-style-list';\n    this.styleList.setAttribute('role','listbox');this.styleList.setAttribute('aria-label','스타일 목록');",'listbox');
    s=replace(s,'    iconBar.appendChild(btnDelete);',`    iconBar.appendChild(btnDelete);
    const clone=this.createIconBtn('⧉','선택한 스타일 복제',()=>this.jueonyClone());clone.dataset.jueonyCloneStyle='true';iconBar.appendChild(clone);`,'clone button');
    s=replace(s,'    body.appendChild(this.infoPanel);',"    body.appendChild(this.infoPanel);\n    this.jueonyError=document.createElement('p');this.jueonyError.setAttribute('role','alert');leftCol.appendChild(this.jueonyError);",'manager error');
    s=replace(s,'      this.onAddRequest?.();','      this.jueonyRunChild(()=>this.onAddRequest?.());','add target guard');
    s=replace(s,'      this.onEditRequest?.(this.selectedId);','      this.jueonyRunChild(()=>this.onEditRequest?.(this.selectedId));','edit target guard');
    s=replace(s,'        this.onEditRequest?.(s.id);','        this.jueonyRunChild(()=>this.onEditRequest?.(s.id));','double-click target guard');
    s=replace(s,"      name.textContent = s.name;","      name.textContent = s.name;\n      item.tabIndex=0;item.setAttribute('role','option');item.setAttribute('aria-selected',String(s.id===this.selectedId));",'list accessibility');
    s=replace(s,'  private handleDelete(): void {',`  private jueonyRunChild(operation:()=>void): void {
    try{assertStyleDialogCurrent(this.jueonyRevision,this.wasm,this.services);operation();}
    catch(error){this.jueonyError.textContent=error instanceof Error?error.message:String(error);}
  }
  private jueonyClone(): void {
    try {
      assertStyleDialogCurrent(this.jueonyRevision,this.wasm,this.services);
      const ih=this.services!.getInputHandler()!,id=this.selectedId;let created=id;
      ih.executeOperation({kind:'snapshot',operationType:'cloneStyle',operation:wasm=>{created=cloneStyleDefinition(wasm,id);return ih.getPosition();}});
      this.selectedId=created;this.refresh();
    }catch(error){this.jueonyError.textContent=error instanceof Error?error.message:String(error);}
  }
  private handleDelete(): void {
    try{assertStyleDialogCurrent(this.jueonyRevision,this.wasm,this.services);}catch(error){this.jueonyError.textContent=error instanceof Error?error.message:String(error);return;}`, 'clone/delete guard');
    s=replace(s,'      this.selectedId = 0;\n      this.loadStyles();\n      this.updateInfo();','      this.selectedId = 0;\n      this.refresh();','deletion revision');
    s=replace(s,'      const ih = this.services?.getInputHandler();','      assertStyleDialogCurrent(this.jueonyRevision,this.wasm,this.services);\n      const ih = this.services?.getInputHandler();','post-confirm deletion guard');
    s=replace(s,"      console.warn('[StyleDialog] 삭제 실패:', err);","      this.jueonyError.textContent=err instanceof Error?err.message:String(err);",'delete error');
    s=replace(s,'  refresh(): void {','  refresh(): void {\n    this.jueonyRevision=(window as any).jueonyEditor?.revision();','manager own revision');
    s=replace(s,'  protected onConfirm(): void {\n    this.onApply?.(this.selectedId);\n  }',`  protected onConfirm(): boolean {
    try{assertStyleDialogCurrent(this.jueonyRevision,this.wasm,this.services);this.onApply?.(this.selectedId);return true;}
    catch(error){this.jueonyError.textContent=error instanceof Error?error.message:String(error);return false;}
  }`,'apply guard');
    return replace(s,'  override show(): void {\n    super.show();',"  override show(): void {\n    this.jueonyRevision=(window as any).jueonyEditor?.revision();\n    super.show();",'manager show revision');
  });
}
