/** Durable page commands. Every mutation uses Studio's snapshot/dirty/history owner. */
import {installMasterPageControls} from './master-pages.ts';
import {installLineNumberControls} from './line-numbers.ts';
import {installPageBodyDeletion} from './page-body-deletion.ts';
import {installPageBodyClipboard} from './page-body-clipboard.ts';
import {installEmptySectionRemoval} from './empty-section-removal.ts';
export const hideFields = [
  ['hideHeader','머리말'],['hideFooter','꼬리말'],['hideMasterPage','바탕쪽'],
  ['hideBorder','쪽 테두리'],['hideFill','쪽 배경'],['hidePageNum','쪽 번호'],
] as const;
export type PageHide = Record<typeof hideFields[number][0],boolean>;
export function pageHideFlags(value:unknown):PageHide {
  const row=value as Record<string,unknown>|null;
  if(!row||row.ok!==true)throw new Error('쪽 감추기 설정을 읽지 못했습니다.');
  return Object.fromEntries(hideFields.map(([key])=>[key,row[key]===true])) as PageHide;
}
function json(value:any){return typeof value==='string'?JSON.parse(value):value;}
export function findPageHideTarget(doc:any,page:number,fallback:{sectionIndex:number;paragraphIndex:number}) {
  const matches:{sectionIndex:number;paragraphIndex:number}[]=[];
  for(let sectionIndex=0;sectionIndex<doc.getSectionCount();sectionIndex++)for(let paragraphIndex=0;paragraphIndex<doc.getParagraphCount(sectionIndex);paragraphIndex++){
    const hide=json(doc.getPageHide(sectionIndex,paragraphIndex));
    if(hide.exists&&json(doc.getPageOfPosition(sectionIndex,paragraphIndex)).page===page)matches.push({sectionIndex,paragraphIndex});
  }
  if(matches.length>1)throw new Error('이 쪽에 여러 감추기 조판 부호가 있습니다. 각 부호를 확인한 뒤 편집해 주세요.');
  if(matches.length)return matches[0];
  if(json(doc.getPageOfPosition(fallback.sectionIndex,fallback.paragraphIndex)).page!==page)
    throw new Error('여러 쪽에 걸친 문단입니다. 이 쪽에서 시작하는 본문 문단에 커서를 놓고 실행해 주세요.');
  return fallback;
}
export function writePageHide(doc:any,target:{sectionIndex:number;paragraphIndex:number},flags:PageHide){
  const result=json(doc.setPageHide(target.sectionIndex,target.paragraphIndex,...hideFields.map(([key])=>flags[key])));
  if(result?.ok!==true)throw new Error('쪽 감추기를 적용하지 못했습니다.');
}
export function installPageControls(registry:any,input:()=>any){
  installMasterPageControls(registry,input);
  installLineNumberControls(registry,input);
  installPageBodyDeletion(registry,input);
  installPageBodyClipboard(registry,input);
  installEmptySectionRemoval(registry,input);
  const body=(ctx:any)=>ctx.hasDocument&&ctx.isEditable&&!ctx.isFormMode&&!ctx.inTable&&!ctx.inCellSelectionMode&&!ctx.inPictureObjectSelection&&!ctx.inTableObjectSelection&&!input()?.cursor?.isInHeaderFooter?.()&&!input()?.cursor?.isInFootnote?.()&&!input()?.cursor?.isInTextBox?.();
  registry.register({id:'page:section-break',label:'구역 나누기',shortcutLabel:'Alt+Shift+Enter',
    canExecute:(ctx:any)=>body(ctx)&&!input()?.cursor?.hasSelection?.()&&typeof input()?.wasm?.borrowDocumentHandle?.()?.insertSectionBreak==='function',
    execute(){
      const ih=input();ih.flushDeferredPaginationIfNeeded('section-break');
      const pos=ih.getPosition();
      ih.executeOperation({kind:'snapshot',operationType:'jueonySectionBreak',operation:(wasm:any)=>{
        const result=json(wasm.borrowDocumentHandle().insertSectionBreak(pos.sectionIndex,pos.paragraphIndex,pos.charOffset));
        if(result?.ok!==true||!Number.isInteger(result.sectionIdx)||!Number.isInteger(result.paraIdx))throw new Error('구역 나누기가 적용되지 않았습니다.');
        return {sectionIndex:result.sectionIdx,paragraphIndex:result.paraIdx,charOffset:result.charOffset??0};
      },meta:{actionId:'page:section-break',domain:'page',refresh:'full',dirtyScope:'document'}});
      ih.focus();
    },
  });
  const show=(id:string,title:string,build:(form:HTMLFormElement)=>()=>void)=>{
    if(document.querySelector('dialog[open],.modal-overlay'))return;
    const dialog=document.createElement('dialog');dialog.id=id;dialog.className='jueony-page-dialog';
    const form=document.createElement('form'),heading=document.createElement('h2'),error=document.createElement('p'),actions=document.createElement('div');
    heading.textContent=title;error.setAttribute('role','alert');error.style.color='#b42318';actions.className='dialog-actions';form.append(heading);
    const apply=build(form),cancel=document.createElement('button'),submit=document.createElement('button');
    cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>dialog.close();submit.type='submit';submit.textContent='설정';
    actions.append(cancel,submit);form.append(error,actions);dialog.append(form);document.body.append(dialog);
    dialog.addEventListener('close',()=>{dialog.remove();input()?.focus();},{once:true});
    const api=(window as any).jueonyEditor,revision=api.revision();
    form.onsubmit=e=>{e.preventDefault();try{if(api.revision()!==revision)throw new Error('문서가 변경되었습니다. 대화상자를 닫고 다시 실행해 주세요.');apply();dialog.close();}catch(e){error.textContent=e instanceof Error?e.message:String(e);}};
    dialog.showModal();
  };
  registry.register({id:'page:hide',label:'감추기',shortcutLabel:'Ctrl+N,S',opensDialog:true,canExecute:body,execute(services:any){
    const ih=input(),pos=ih.getPosition(),doc=services.wasm.borrowDocumentHandle(),page=ih.cursor.rect?.pageIndex??0;
    const target=findPageHideTarget(doc,page,pos),flags=pageHideFlags(json(doc.getPageHide(target.sectionIndex,target.paragraphIndex)));
    show('jueony-page-hide','감추기',form=>{
      const note=document.createElement('p');note.textContent='현재 쪽에서 감출 항목을 선택하세요. 모두 해제하면 감추기 조판 부호를 제거합니다.';form.append(note);
      const checks=hideFields.map(([key,label])=>{const row=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.name=key;check.checked=flags[key];row.append(check,document.createTextNode(label));row.style.display='block';row.style.margin='10px 0';form.append(row);return check;});
      return ()=>{const next=Object.fromEntries(hideFields.map(([key],i)=>[key,checks[i].checked])) as PageHide;if(JSON.stringify(next)===JSON.stringify(flags))return;
        ih.executeOperation({kind:'snapshot',operationType:'jueonyPageHide',operation:(wasm:any)=>{writePageHide(wasm.borrowDocumentHandle(),target,next);return pos;},meta:{actionId:'page:hide',domain:'page',refresh:'full',dirtyScope:'document'}});
      };
    });
  }});
  // Old shortcuts only changed renderer session flags and could not survive saving.
  registry.register({...registry.get('page:hide'),id:'page:hide-current',label:'현재 쪽 감추기'});
  registry.register({id:'page:hide-headerfooter',label:'현재 머리말/꼬리말 감추기',canExecute:(ctx:any)=>ctx.hasDocument&&ctx.isEditable&&!ctx.isFormMode&&input()?.cursor?.isInHeaderFooter?.(),execute(services:any){
    const ih=input(),cursor=ih.cursor,doc=services.wasm.borrowDocumentHandle(),page=cursor.rect?.pageIndex??0,start=json(doc.getPositionOfPage(page));
    if(!start.ok)throw new Error('본문 위치를 찾지 못했습니다.');
    const target=findPageHideTarget(doc,page,{sectionIndex:start.sec,paragraphIndex:start.para}),flags=pageHideFlags(json(doc.getPageHide(target.sectionIndex,target.paragraphIndex)));
    const key=cursor.headerFooterMode==='header'?'hideHeader':'hideFooter';flags[key]=!flags[key];
    ih.executeOperation({kind:'snapshot',operationType:'jueonyHideHeaderFooter',operation:(wasm:any)=>{writePageHide(wasm.borrowDocumentHandle(),target,flags);return {...target,charOffset:0};},meta:{actionId:'page:hide-headerfooter',domain:'page',refresh:'full',dirtyScope:'document'}});
  }});
  registry.register({id:'page:header-footer-dialog',label:'머리말/꼬리말',shortcutLabel:'Ctrl+N,H',opensDialog:true,canExecute:body,execute(services:any){
    const ih=input(),pos=ih.getPosition(),page=ih.cursor.rect?.pageIndex??0;
    show('jueony-header-footer','머리말/꼬리말',form=>{
      const select=(name:string,label:string,options:[string,string][])=>{const row=document.createElement('label'),s=document.createElement('select');s.name=name;row.textContent=label;for(const [value,text] of options){const o=document.createElement('option');o.value=value;o.textContent=text;s.append(o);}row.append(s);row.style.display='block';row.style.margin='12px 0';form.append(row);return s;};
      const kind=select('kind','종류 ',[['header','머리말'],['footer','꼬리말']]);
      const pages=select('pages','적용 쪽 ',[['0','양쪽'],['2','홀수 쪽'],['1','짝수 쪽']]);
      const note=document.createElement('p');note.textContent='현재 구역에 넣습니다. 선택한 종류가 이미 있으면 내용을 유지하고 편집합니다.';form.append(note);
      return ()=>{
        const isHeader=kind.value==='header',applyTo=Number(pages.value),sectionIndex=pos.sectionIndex;
        if(!json(services.wasm.getHeaderFooter(sectionIndex,isHeader,applyTo)).exists)
          ih.executeOperation({kind:'snapshot',operationType:'jueonyHeaderFooter',operation:(wasm:any)=>{const result=json(wasm.createHeaderFooter(sectionIndex,isHeader,applyTo));if(result?.ok!==true)throw new Error('머리말/꼬리말을 만들지 못했습니다.');return pos;},meta:{actionId:'page:header-footer-dialog',domain:'page',refresh:'full',dirtyScope:'document'}});
        ih.cursor.enterHeaderFooterMode(isHeader,sectionIndex,applyTo,page);
        services.eventBus.emit('headerFooterModeChanged',{mode:isHeader?'header':'footer',sectionIdx:sectionIndex,applyTo,previewPage:page});ih.updateCaret();
      };
    });
  }});
}
