import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareAgentContext} from '../src/composition/agent-context.ts';
import {buildContext} from '../src/modules/agent/public/index.ts';
import type {Snapshot} from '../src/modules/document/public/index.ts';

function fixture() {
  const snapshot:Snapshot={name:'문서.hwpx',revision:'fixture',limitations:[],
    nodes:[{id:'p0',section:0,paragraph:0,text:'기존 본문',editable:true}]};
  const state={activeWorkspaceId:'work',workspaces:[{id:'work',name:'업무',activeChatId:'chat'}],
    chats:[{id:'chat',workspaceId:'work',title:'채팅',messages:[]}]};
  const input:Parameters<typeof prepareAgentContext>[0]={
    agent:{context:buildContext,async contextWithRetrieval(){throw new Error('Unexpected retrieval');}},
    editor:{snapshot:()=>snapshot},filePort:{snapshot:()=>{throw new Error('Unexpected file access');}},
    state,run:{workspaceId:'work',chatId:'chat',sources:[]},request:'본문 검토',
    useTools:false,allowToolEdits:false,readReferences:async()=>[],retrievalMode:()=>undefined,signal:new AbortController().signal,
  };
  return {input,snapshot};
}

test('the long-document context keeps the full document out and grants window edits only when enabled',async()=>{
  const {input,snapshot}=fixture();
  input.useTools=true;
  input.editor={
    snapshot(){throw new Error('Full snapshot was read');},
    inspectDocumentToolOutline:()=>({revision:'outline-version',name:'장문.hwpx',sectionParagraphs:[5]}),
    readDocumentToolWindow(revision,section,paragraph,start,count,allowEdit){
      assert.deepEqual([revision,section,paragraph,start,count],['outline-version',0,4,10,25]);
      return {id:'p4',text:'선택 구간',editable:Boolean(allowEdit),length:35};
    },
    captureDocumentToolEditBase(revision,target){
      assert.deepEqual([revision,target],['outline-version','p4']);
      return snapshot;
    },
  };
  const readonly=await prepareAgentContext(input);
  assert.deepEqual(readonly.context.document.nodes,[]);
  assert.equal(readonly.context.document.revision,'outline-version');
  assert.equal((await readonly.longDocument?.read(0,4,10,25))?.editable,false);
  assert.equal(readonly.longDocument?.captureEditBase,undefined);

  const editable=await prepareAgentContext({...input,allowToolEdits:true});
  assert.equal((await editable.longDocument?.read(0,4,10,25))?.editable,true);
  assert.equal(await editable.longDocument?.captureEditBase?.('p4'),snapshot);
});

test('a recorded text macro validates its revision before preparing a masked provider plan and reads no attachments',async()=>{
  const {input,snapshot}=fixture();
  input.request='기록 실행\n완료 여부를 알려 주세요.';
  input.filePort={snapshot:()=>({stamp:'fixture',activeTabId:'active',tabs:[],
    capabilities:{list:false,new:false,activate:false,closeClean:false}})};
  input.readReferences=async()=>{throw new Error('Recorded macro read attachments');};
  input.retrievalMode=()=>{throw new Error('Recorded macro tried to select a retrieval mode');};
  const operation={kind:'replace_body_text' as const,target:snapshot.nodes[0].id,start:0,count:2,text:'업무 입력값'};
  input.alignment={revision:'stale',requestPrefix:'기록 실행',generation:{message:'기록',sourceIds:[],operations:[operation]}};
  await assert.rejects(prepareAgentContext(input),/문서가 바뀌었습니다/u);

  input.alignment.revision=snapshot.revision;
  const {alignmentPlan}=await prepareAgentContext(input);
  assert.deepEqual(alignmentPlan?.operations,[operation]);
  assert.deepEqual(alignmentPlan?.modelOperations,[{...operation,text:'[[RECORDED_TEXT_1]]'}]);
  assert.match(alignmentPlan?.modelInput.request??'',/완료 여부를 알려 주세요/u);
  assert.doesNotMatch(JSON.stringify(alignmentPlan?.modelInput),/업무 입력값|기존 본문/u);
});
