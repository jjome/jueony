import type {Run} from '../mvp/model.ts';
import {describeSourceAddress,type SourceAddress} from '../modules/references/public/index.ts';
import type {Message} from '../modules/workspace/public/index.ts';
import {describeAgentChanges,showBodyChangeExcerpt} from './agent-changes.ts';
import {element as $} from './dom.ts';

const phaseLabels:Record<string,string>={
  generating:'초안 생성',reviewing:'계획 검토',validated:'명령 확인',ready:'적용 준비',
  applying:'문서 적용',completed:'완료',stopped:'중단',
};
export const runStatusLabels:Record<Run['status'],string>={
  preparing_context:'자료 읽는 중',generating:'모델 응답 대기',validating:'명령 검증 중',applying:'문서 적용 중',
  completed:'완료',cancelled:'취소됨',conflict:'문서 변경 충돌',failed_no_change:'실패 · 적용 없음',
  failed_rolled_back:'실패 · 변경 복원됨',failed_partial:'실패 · 부분 적용 확인 필요',interrupted:'이전 실행 중단됨',
};

type MessageActions={
  button(label:string,action:()=>unknown):HTMLButtonElement;
  openSource(run:Run,source:Run['sources'][number],address:SourceAddress):Promise<void>;
  undo(run:Run):Promise<void>;
  saveMacro(run:Run):Promise<void>;
};

function block(tag:'div'|'p'|'summary',text:string,className?:string){
  const element=document.createElement(tag);
  element.textContent=text;
  if(className)element.className=className;
  return element;
}

function sourceDetails(run:Run,actions:MessageActions){
  const detail=document.createElement('details');
  detail.append(block('summary','자료 범위와 출처'));
  for(const source of run.sources){
    const usage=run.usedSourceIds?.includes(source.id)?'모델이 참조 표시':'모델에 전달';
    detail.append(block('div',`${source.name} · ${source.characters}자 · ${usage}\n${source.limitation??'UTF-8 텍스트 전체'}`));
    if(!source.locations?.length)continue;
    const places=document.createElement('details');
    const list=document.createElement('ul');
    for(const {address} of source.locations){
      const item=document.createElement('li');
      item.append(actions.button(describeSourceAddress(address),()=>actions.openSource(run,source,address)));
      list.append(item);
    }
    const label=source.locations.some(({address})=>address.kind==='pdf')?'쪽 위치':'문단·셀 위치';
    places.append(block('summary',`${label} ${source.locations.length}개`),list);
    detail.append(places);
  }
  return detail;
}

function changeDetails(receipt:NonNullable<Run['receipt']>,structuralChanges:readonly string[]){
  const body=$<HTMLDetailsElement>('diff-body');
  const before=$('diff-before'),after=$('diff-after'),excerpt=$('diff-body-excerpt');
  const hasBodyChange=receipt.before!==receipt.after;
  const compact=hasBodyChange&&Math.max(receipt.before.length,receipt.after.length)>4000;
  before.replaceChildren();after.replaceChildren();excerpt.replaceChildren();
  body.ontoggle=null;
  body.hidden=!hasBodyChange;
  body.open=hasBodyChange&&!compact;
  excerpt.hidden=!compact;
  const populateBody=()=>{before.textContent=receipt.before;after.textContent=receipt.after;};
  if(compact){
    showBodyChangeExcerpt(excerpt,receipt);
    body.ontoggle=()=>{if(body.open&&!before.textContent&&!after.textContent)populateBody();};
  }else if(hasBodyChange)populateBody();
  const structuralDetails=$<HTMLDetailsElement>('structure-diff');
  structuralDetails.hidden=!receipt.formulaField&&!structuralChanges.length;
  structuralDetails.open=!structuralDetails.hidden;
  const structure=$('structure-diff-text');
  structure.textContent=structuralChanges.join('\n');
  if(receipt.formulaField){
    const primary=receipt.formulaField;
    const formulas=[primary,...(primary.dependents??[])].map((formula,index)=>{
      const label=index?'연관 계산식':'계산식';
      const before=`${formula.before.command??'일반 셀'} · 표시값 ${formula.before.value}`;
      const after=`${formula.after.command??'일반 셀'} · 표시값 ${formula.after.value}`;
      return `${label} · ${formula.row+1}행 ${formula.column+1}열\n변경 전 ${before}\n변경 후 ${after}\n\n`;
    });
    structure.prepend(document.createTextNode(formulas.join('')));
  }
  $<HTMLDialogElement>('change-dialog').showModal();
}

function renderRun(card:HTMLElement,run:Run,actions:MessageActions){
  const names=run.sources.map(source=>`${source.name} (${source.characters}자)`);
  const sources=names.length?'전달한 자료: '+names.join(', '):'참고 파일 없음';
  card.append(block('div',runStatusLabels[run.status]+' · '+sources,'run-meta'));
  if(run.sources.length)card.append(sourceDetails(run,actions));
  if(run.retrieval){
    const detail=document.createElement('details');
    const {hits,warnings,matchedChunkCount,sentCharacters}=run.retrieval;
    detail.append(block('summary',`자료 검색: ${matchedChunkCount}개 구간 · ${sentCharacters}자 전달`));
    for(const hit of hits)detail.append(block('div',`${hit.name} · 추출문 ${hit.startLine}–${hit.endLine}행`));
    for(const warning of warnings)detail.append(block('p',warning));
    card.append(detail);
  }
  if(run.events?.length){
    const events=run.events.map(event=>`${phaseLabels[event.phase]??event.phase} ${event.call}/${event.maxCalls}`);
    card.append(block('div','검토 기록: '+events.join(' → '),'run-meta'));
  }
  if(!run.receipt)return;
  const receipt=run.receipt;
  const preview=block('div','','run-meta');
  showBodyChangeExcerpt(preview,receipt);
  card.append(block('p',`${receipt.operationCount}개 변경${run.undoneAt?' · 되돌림 완료':''}`,'run-meta'),preview);
  const changes=describeAgentChanges(receipt);
  if(changes.length)card.append(block('p',changes.slice(0,2).join(' · '),'run-meta'));
  const buttons=document.createElement('div');
  buttons.className='message-actions';
  buttons.append(actions.button('변경 확인',()=>changeDetails(receipt,changes)));
  if(!run.undoneAt)buttons.append(actions.button('요청 되돌리기',()=>actions.undo(run)));
  if(run.macroTemplate)buttons.append(actions.button('반복 작업으로 저장',()=>actions.saveMacro(run)));
  card.append(buttons);
}

export function renderChatMessages(messages:readonly Message[],runs:readonly Run[],pending:Run|undefined,actions:MessageActions){
  const target=$('messages');
  const cards=document.createDocumentFragment();
  if(!messages.length)cards.append(block('div','자료를 연결하고 업무를 시작하세요.\nAI는 오른쪽의 열린 문서를 직접 편집합니다.','empty-chat'));
  const scopedRuns=new Map(runs.map(run=>[run.id,run]));
  for(const message of messages){
    const card=document.createElement('article');
    card.className='message '+message.role;
    card.append(block('div',message.role==='user'?'나':'Jueony','role'),block('div',message.text));
    const run=message.runId&&scopedRuns.get(message.runId);
    if(run&&message.role==='assistant')renderRun(card,run,actions);
    cards.append(card);
  }
  target.setAttribute('aria-busy',String(Boolean(pending)));
  if(pending){
    const card=document.createElement('article');
    card.className='message assistant pending';
    card.id='agent-progress';
    card.setAttribute('role','status');
    const progress=pending.events?.at(-1);
    card.textContent=`${pending.model?.modelId??'반복 작업'} · ${runStatusLabels[pending.status]}…${progress?` (${progress.call}/${progress.maxCalls}회)`:''}`;
    cards.append(card);
  }
  target.replaceChildren(cards);
  target.scrollTop=target.scrollHeight;
}
