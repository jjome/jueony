import type {Snapshot,AgentTablePaginationOp,Table} from '../public/types.ts';
/** Metadata only. Alias/new-table coordinates need a fresh context before this command. */
export function validateAgentTablePagination(op:AgentTablePaginationOp,s:Snapshot):Table {
 const table=s.structure?.tables.find(t=>t.id===op.target),cap=s.tablePaginationSources?.[op.target];
 if(typeof op.target!=='string'||!/^s\d+p\d+t\d+$/u.test(op.target)||!table||cap?.editable!==true||!/^[a-f0-9]{64}$/u.test(cap.fingerprint??''))throw new Error('조회된 변경 가능한 본문의 단순 표가 필요합니다.');
 if(!['none','cell','row'].includes(op.mode)||!['none','cell','row'].includes(cap.mode??''))throw new Error('표 쪽 나눔은 none/cell/row 중 하나여야 합니다.');
 if(cap.mode===op.mode)throw new Error('현재 표 쪽 나눔 설정과 같습니다.');
 return table;
}
