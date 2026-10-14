import type {Snapshot,AgentTableHeaderOp,Table} from '../public/types.ts';
export function validateAgentTableHeader(op:AgentTableHeaderOp,s:Snapshot):Table {
 const table=s.structure?.tables.find(t=>t.id===op.target),cap=s.tableHeaderSources?.[op.target];
 if(typeof op.target!=='string'||!/^s\d+p\d+t\d+$/u.test(op.target)||!table||cap?.editable!==true||!/^[a-f0-9]{64}$/u.test(cap.fingerprint??'')||![0,1].includes(cap.headerRows as number)||typeof cap.repeatHeader!=='boolean'||!['none','cell','row'].includes(cap.mode??''))throw new Error('조회된 제목 행 편집 가능 본문 단순 표가 필요합니다.');
 if(![0,1].includes(op.headerRows)||!Number.isInteger(op.headerRows)||typeof op.repeatHeader!=='boolean'||!['none','cell','row'].includes(op.paginationMode))throw new Error('제목 행은 0 또는 1이고 반복/쪽 나눔 값을 명시해야 합니다.');
 if(op.repeatHeader&&(op.headerRows!==1||op.paginationMode!=='row'||table.rows<2))throw new Error('반복은 첫 제목 행과 행 단위 쪽 나눔, 본문 행이 있는 표에서만 설정하세요.');
 if(cap.headerRows===op.headerRows&&cap.repeatHeader===op.repeatHeader&&cap.mode===op.paginationMode)throw new Error('현재 제목 행·반복·쪽 나눔 설정과 같습니다.');
 return table;
}
