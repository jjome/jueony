import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Keep the real settings dialogs; route their mutations through checked definitions. */
export async function applyFontSetPreferencesPatches({ root }) {
  const setPath = join(root, 'src/ui/font-set-dialog.ts'), editPath = join(root, 'src/ui/font-set-edit-dialog.ts');
  let source = (await readFile(setPath, 'utf8')).replace(/\r\n/g, '\n');
  const replace = (before, after, label) => { if (source.split(before).length !== 2) throw new Error('Font set seam drift: ' + label); source = source.replace(before, after); };
  source = "import {saveFontSetChange,showFontSetError} from '../jueony/adapters/browser/font-set-dialog.ts';\n" + source;
  replace('  private selectedIndex = -1;', '  private jueonySelectedFontSet: FontSet | null = null;\n  private selectedIndex = -1;', 'selection snapshot field');
  replace('    this.listEl.replaceChildren();', "    this.dialog?.querySelector('[data-font-set-error]')?.remove();\n    this.listEl.replaceChildren();", 'clear error after successful list update');
  replace('    this.selectedIndex = -1;\n    this.updateButtons();', '    this.selectedIndex = -1;\n    this.jueonySelectedFontSet = null;\n    this.updateButtons();', 'clear selected snapshot');
  replace('      this.selectedIndex = index;\n      this.updateButtons();', '      this.selectedIndex = index;\n      this.jueonySelectedFontSet = { ...fs };\n      this.updateButtons();', 'capture selected definition');
  const start = source.indexOf('  private onAdd(): void {'), end = source.indexOf('  protected onConfirm(): void {', start);
  if (start < 0 || end < 0) throw new Error('Font set mutation seams drift');
  source = source.slice(0, start) + `  private onAdd(): void {
    new FontSetEditDialog(null, value => {
      saveFontSetChange(userSettings, BUILTIN_FONT_SETS, {kind:'add', value});
      this.refreshList(); return true;
    }).show();
  }

  private onEdit(): void {
    if(this.selectedIndex < 0 || !this.jueonySelectedFontSet) return;
    const expected = {...this.jueonySelectedFontSet};
    new FontSetEditDialog(expected, value => {
      saveFontSetChange(userSettings, BUILTIN_FONT_SETS, {kind:'edit', expected, value});
      this.refreshList(); return true;
    }).show();
  }

  private onDelete(): void {
    if(this.selectedIndex < 0 || !this.jueonySelectedFontSet) return;
    const expected = {...this.jueonySelectedFontSet};
    if(!confirm(t('dialog.fontSet.onDelete.message', {p1:expected.name}))) return;
    try { saveFontSetChange(userSettings, BUILTIN_FONT_SETS, {kind:'delete', expected}); this.refreshList(); }
    catch(error) { showFontSetError(this,error); }
  }

` + source.slice(end);
  await writeFile(setPath, source);
  source = (await readFile(editPath, 'utf8')).replace(/\r\n/g, '\n');
  source = "import {confirmFontSetEdit,selectStoredFontFamily} from '../jueony/adapters/browser/font-set-dialog.ts';\n" + source;
  replace('  private onApply: (fs: FontSet) => void;', '  private onApply: (fs: FontSet) => void | boolean;', 'callback result type');
  replace('  constructor(editTarget: FontSet | null, onApply: (fs: FontSet) => void) {', '  constructor(editTarget: FontSet | null, onApply: (fs: FontSet) => void | boolean) {', 'constructor callback result type');
  replace('        select.value = this.editTarget[langKeys[i]];', '        selectStoredFontFamily(select, this.editTarget[langKeys[i]]);', 'preserve stored family');
  const confirm = source.indexOf('  protected onConfirm(): void {');
  if (confirm < 0 || source.slice(confirm).split('  protected onConfirm(): void {').length !== 2) throw new Error('Font set edit confirm seam drift');
  source = source.slice(0, confirm) + '  protected onConfirm(): boolean { return confirmFontSetEdit(this); }\n}\n';
  await writeFile(editPath, source);
}
