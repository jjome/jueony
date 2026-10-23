import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
/** Reuse the visible native style-bar. No duplicate host formatting toolbar. */
export async function applyFormattingToolbarPatches({root}){
 const path=join(root,'src/ui/toolbar.ts');let source=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
 const replace=(before,after,label)=>{if(source.split(before).length!==2)throw new Error('Formatting toolbar seam drift: '+label);source=source.replace(before,after);};
 source="import {commitToolbarFont,commitToolbarSize,installNativeFormattingBoundary} from '../jueony/adapters/rhwp/formatting-toolbar.ts';\n"+source;
 source="import {recentFontMenuEntries} from '../jueony/adapters/browser/recent-fonts.ts';\n"+source;
 replace("type FontMenuCategory = 'all' | 'current' | 'document' | 'fontSets' | 'system';", "type FontMenuCategory = 'all' | 'current' | 'document' | 'fontSets' | 'system' | 'recent';", 'recent font category type');
 replace("  { id: 'all', label: t('dialog.toolbar.label') },", "  { id: 'recent', label: '최근 사용 글꼴' },\n  { id: 'all', label: t('dialog.toolbar.label') },", 'recent font category label');
 replace('    for (const category of FONT_MENU_CATEGORIES) {', `    const showRecent = userSettings.getFontSettings().showRecentFonts;
    if (this.fontMenuCategory === 'recent' && !showRecent) this.fontMenuCategory = 'current';
    for (const category of FONT_MENU_CATEGORIES) {
      if (category.id === 'recent' && !showRecent) continue;`, 'recent font category visibility');
 replace("    switch (category) {\n      case 'current':", "    switch (category) {\n      case 'recent':\n        return recentFontMenuEntries(userSettings.getFontSettings());\n      case 'current':", 'recent font entries');
 replace('    this.setupFormatButtons();','    installNativeFormattingBoundary(this);\n    this.setupFormatButtons();','guard setup');
 replace('    menu.style.top = `${Math.min(rect.bottom + 2, window.innerHeight - 360)}px`;',
  '    menu.style.top = `${Math.max(4, Math.min(rect.bottom + 2, window.innerHeight - Math.min(350, window.innerHeight - 8) - 4))}px`;','font popup viewport clamp');
 const start=source.indexOf("    this.fontName.addEventListener('change', () => {"),end=source.indexOf('    // 언어 선택 변경 시',start);
 if(start<0||end<0)throw new Error('Formatting font change seam drift');source=source.slice(0,start)+"    this.fontName.addEventListener('change', () => { commitToolbarFont(this,this.fontName.value); });\n\n"+source.slice(end);
 const sizeStart=source.indexOf('    // 크기 입력 (Enter 키로 확정)'),sizeEnd=source.indexOf('  /** 글자색 피커 이벤트 */',sizeStart);
 if(sizeStart<0||sizeEnd<0)throw new Error('Formatting size controls seam drift');source=source.slice(0,sizeStart)+`    this.fontSize.addEventListener('keydown',(event)=>{
      if(event.key==='Enter'){event.preventDefault();commitToolbarSize(this,this.fontSize.value);}
      else if(event.key==='Escape'){event.preventDefault();this.fontSize.value=String((this as any).jueonyFormattingExpected?.sizePt??10);}
    });
    for(const [button,delta]of[[this.btnSizeUp,1],[this.btnSizeDown,-1]] as const){
      const apply=()=>commitToolbarSize(this,Math.min(4096,Math.max(1,(Number(this.fontSize.value)||10)+delta)));
      button.addEventListener('mousedown',event=>{event.preventDefault();apply();});
      button.addEventListener('click',event=>{if(event.detail===0)apply();});
    }
  }

`+source.slice(sizeEnd);
 await writeFile(path,source);
 const commandPath=join(root,'src/command/commands/format.ts');let commands=(await readFile(commandPath,'utf8')).replace(/\r\n/g,'\n');
 const seam='export const formatCommands: CommandDef[] = [';if(commands.split(seam).length!==2)throw new Error('Formatting command registry seam drift');
 commands="import {formattingToolbarCommands} from '../../jueony/adapters/rhwp/formatting-toolbar.ts';\n"+commands.replace(seam,seam+'\n  ...formattingToolbarCommands,');await writeFile(commandPath,commands);
}
