import type {AgentPageBorderFlags,AgentPageBorderInclusionOp,Snapshot} from '../public/types.ts';

export function validateAgentPageBorderFlags(value:unknown):AgentPageBorderFlags{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('머리말·꼬리말의 포함 설정이 필요합니다.');
  const entries=Object.entries(value);
  if(!entries.length||entries.some(([key,flag])=>!['headerInside','footerInside'].includes(key)||typeof flag!=='boolean')){
    throw new Error('머리말·꼬리말 포함 중 하나 이상을 지정하세요.');
  }
  return Object.fromEntries(entries);
}

export function agentPageBorderSections(operation:AgentPageBorderInclusionOp,snapshot:Snapshot):number[]{
  const {kind,sections,...flags}=operation;
  if(!Array.isArray(sections)||sections.length<1||sections.length>100||new Set(sections).size!==sections.length||
    sections.some(index=>!Number.isSafeInteger(index)||index<0)){
    throw new Error('겹치지 않는 구역 번호를 지정하세요.');
  }
  validateAgentPageBorderFlags(flags);
  const current=new Map(snapshot.structure?.sections.map(section=>[section.index,section.pageBorderInclusion]));
  if(sections.some(index=>!current.get(index)?.editable)){
    throw new Error('모든 대상 구역에 쪽 기준이며 보존을 확인할 수 있는 테두리가 필요합니다.');
  }
  return sections;
}
