import {sha256} from '@noble/hashes/sha2.js';
import type {AgentFilePort} from '../../modules/agent/public/index.ts';
import {validateAgentFileOperation} from '../../modules/document/public/index.ts';
import type {AgentFileContext,AgentFileOp,AgentFileReceipt} from '../../modules/document/public/index.ts';
export type AgentFileTab={id:string;workspaceId:string;name:string;dirty:boolean;revision:string;instance:string;busy:boolean;initialized:boolean};
export type AgentFileHostState={workspaceId:string;activeTabId:string;tabs:AgentFileTab[];blocked:boolean};
export type AgentFileHooks={read():AgentFileHostState;freeze():()=>void;newTab():Promise<void>;activate(id:string):Promise<void>;closeClean(id:string):Promise<void>};
const digest=(value:unknown)=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))),v=>v.toString(16).padStart(2,'0')).join('');
const version=(tab:AgentFileTab)=>digest([tab.id,tab.workspaceId,tab.name,tab.dirty,tab.revision,tab.instance]);
/** Current-window/current-workspace only. No file handles, paths, picker, save, discard or exit capability. */
export function createAgentFilePort(hooks:AgentFileHooks):AgentFilePort{
 const used=new Set<string>();let executing=false;
 function observe(){const raw=structuredClone(hooks.read());if(!raw||!raw.workspaceId||!Array.isArray(raw.tabs)||raw.tabs.length>30||new Set(raw.tabs.map(t=>t.id)).size!==raw.tabs.length)throw Error('문서 탭 소유 정보를 읽지 못했습니다.');const tabs=raw.tabs.filter(t=>t.workspaceId===raw.workspaceId);if(!tabs.some(t=>t.id===raw.activeTabId))throw Error('현재 업무의 활성 문서가 없습니다.');const blocked=raw.blocked||raw.tabs.some(t=>t.busy||!t.initialized),stamp=digest([raw.workspaceId,raw.activeTabId,raw.tabs.map(t=>[t.id,version(t)])]);const context:AgentFileContext={stamp,activeTabId:raw.activeTabId,tabs:tabs.map(t=>({id:t.id,name:t.name,dirty:t.dirty,fingerprint:version(t)})),capabilities:{list:!blocked,new:!blocked&&raw.tabs.length<30,activate:!blocked,closeClean:!blocked}};return{raw,context};}
 return{snapshot:()=>observe().context,async execute(runId,operation,expected,signal){
  if(executing||used.has(runId))throw Error('이미 실행했거나 진행 중인 파일 명령입니다.');signal.throwIfAborted();const before=observe(),op=validateAgentFileOperation(operation,expected);if(before.context.stamp!==expected.stamp||before.raw.blocked||Object.values(before.context.capabilities).every(v=>!v))throw Error('요청 후 업무 또는 문서 탭이 바뀌었습니다.');validateAgentFileOperation(op,before.context);
  executing=true;let resume:(()=>void)|undefined,attempted=false;
  try{resume=hooks.freeze();if(observe().context.stamp!==before.context.stamp)throw Error('파일 명령 준비 중 업무가 바뀌었습니다.');signal.throwIfAborted();
   if(op.kind!=='list_document_tabs'){attempted=true;used.add(runId);if(op.kind==='new_document_tab')await hooks.newTab();else if(op.kind==='activate_document_tab')await hooks.activate(op.tabId);else await hooks.closeClean(op.tabId);}
   const after=observe();if(after.raw.workspaceId!==before.raw.workspaceId)throw Error('명령 실행 중 업무가 바뀌었습니다.');const removed=op.kind==='close_document_tab'?op.tabId:null;
   for(const tab of before.raw.tabs.filter(t=>t.id!==removed)){const actual=after.raw.tabs.find(t=>t.id===tab.id);if(!actual||version(actual)!==version(tab))throw Error('요청하지 않은 문서 탭 내용이나 연결이 바뀌었습니다.');}
   const added=after.raw.tabs.filter(t=>!before.raw.tabs.some(b=>b.id===t.id));
   if(op.kind==='new_document_tab'?(added.length!==1||added[0].dirty||added[0].workspaceId!==before.raw.workspaceId||after.raw.activeTabId!==added[0].id):op.kind==='close_document_tab'?(after.raw.tabs.some(t=>t.id===op.tabId)||added.length>(before.context.tabs.length===1?1:0)||added.some(t=>t.dirty||t.workspaceId!==before.raw.workspaceId)):added.length!==0)throw Error('문서 탭 생성·닫기 결과를 확인하지 못했습니다.');
   if(op.kind==='activate_document_tab'&&after.raw.activeTabId!==op.tabId||op.kind==='list_document_tabs'&&after.context.stamp!==before.context.stamp)throw Error('문서 탭 조회·선택 결과가 일치하지 않습니다.');
   used.add(runId);const message=op.kind==='list_document_tabs'?`현재 업무의 문서 탭 ${after.context.tabs.length}개를 조회했습니다.`:op.kind==='new_document_tab'?'새 문서 탭을 만들었습니다. 파일에는 저장하지 않았습니다.':op.kind==='activate_document_tab'?'조회한 문서 탭으로 전환했습니다.':'수정되지 않은 문서 탭을 닫았습니다. 원본 파일은 지우지 않았습니다.';
   return{runId,kind:op.kind,status:'completed',beforeStamp:before.context.stamp,after:after.context,operationCount:1,documentMutations:0,message};
  }catch(error){if(attempted){const e=Error('문서 탭 명령 중 오류가 발생했습니다. 현재 탭 상태를 확인하세요. '+String(error));e.name='PartialApplyError';throw e;}throw error;}finally{executing=false;resume?.();}
 }};
}
