import type {AgentFileContext,AgentFileOp} from '../public/types.ts';
export const agentFileKinds=['list_document_tabs','new_document_tab','activate_document_tab','close_document_tab'] as const;
export function validateAgentFileOperation(raw:unknown,source:AgentFileContext|undefined):AgentFileOp{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('파일 명령 객체가 필요합니다.');
 const op=raw as Record<string,unknown>,target=op.kind==='activate_document_tab'||op.kind==='close_document_tab',keys=target?['kind','contextStamp','tabId']:['kind','contextStamp'];
 if(Object.keys(op).length!==keys.length||keys.some(k=>!Object.hasOwn(op,k))||!(agentFileKinds as readonly unknown[]).includes(op.kind))throw Error('지원하지 않는 파일 명령 필드입니다.');
 if(!source||!/^[a-f0-9]{64}$/.test(source.stamp)||op.contextStamp!==source.stamp||!Array.isArray(source.tabs)||source.tabs.length>30||new Set(source.tabs.map(t=>t.id)).size!==source.tabs.length||!source.tabs.some(t=>t.id===source.activeTabId))throw Error('현재 업무의 문서 탭 상태를 다시 조회하세요.');
 const capability=op.kind==='list_document_tabs'?'list':op.kind==='new_document_tab'?'new':op.kind==='activate_document_tab'?'activate':'closeClean';
 if(source.capabilities[capability]!==true)throw Error('현재 상태에서는 이 파일 명령을 실행할 수 없습니다.');
 if(target){const tab=source.tabs.find(t=>t.id===op.tabId);if(!tab||!/^[a-f0-9]{64}$/.test(tab.fingerprint))throw Error('현재 업무에서 조회한 문서 탭만 선택할 수 있습니다.');if(op.kind==='close_document_tab'&&tab.dirty)throw Error('수정한 문서는 사용자 확인으로 저장 또는 폐기한 뒤 닫아 주세요. Agent가 임의로 폐기하지 않습니다.');if(op.kind==='activate_document_tab'&&op.tabId===source.activeTabId)throw Error('이미 선택한 문서 탭입니다.');}
 return structuredClone(op) as AgentFileOp;
}
