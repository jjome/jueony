import { InsertTextCommand } from '../../../engine/command';
import { CalendarStampDialog } from '../browser/calendar-stamp-dialog.ts';

/** Plain strings use the same open document/undo command path as manual text. */
export function installCalendarStamp(registry:any, input:()=>any, eventBus:any) {
  const can = (context:any) => {
    const ih = input(), cursor = ih?.cursor;
    return !!cursor && context.hasDocument && context.isEditable && !context.isFormMode
      && !context.inTable && !context.inCellSelectionMode && !context.inTableObjectSelection && !context.inPictureObjectSelection
      && !cursor.hasSelection() && !cursor.isInHeaderFooter() && !cursor.isInFootnote() && !cursor.isInTextBox() && !ih.isComposing;
  };
  registry.register({ id:'ext:jueony-calendar-stamp', label:'날짜/시간 문자열', opensDialog:true, canExecute:can,
    execute:()=>{
      const api=(window as any).jueonyEditor, ih=input(), revision=api.revision(), position=ih.getCursorPosition();
      const clock=()=>{const now=new Date();return {year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate(),hour:now.getHours(),minute:now.getMinutes(),second:now.getSeconds()};};
      new CalendarStampDialog(clock,text=>{
        if(api.revision()!==revision || api.busy() || !can((window as any).rhwpStudio.automation.getContext())
          || JSON.stringify(input().getCursorPosition())!==JSON.stringify(position)) throw new Error('문서나 커서가 바뀌었습니다. 취소한 뒤 다시 날짜/시간을 넣어 주세요.');
        input().executeOperation({kind:'command',command:new InsertTextCommand(position,text)});
        eventBus.emit('document-changed');
      }).show();
    },
  });
  const anchor=document.querySelector('.md-item[data-cmd="insert:bookmark"]');
  if(anchor){
    const item=document.createElement('div');item.className='md-item';item.dataset.cmd='ext:jueony-calendar-stamp';
    const icon=document.createElement('span');icon.className='md-icon';
    const label=document.createElement('span');label.className='md-label';label.textContent='날짜/시간 문자열';
    const key=document.createElement('span');key.className='md-shortcut';key.textContent='Ctrl+K,D';
    item.append(icon,label,key);anchor.after(item);
  }
}
