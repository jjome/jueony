import type {Snapshot,AgentTableHeaderOp,Table} from '../public/types.ts';
export function validateAgentTableHeader(op:AgentTableHeaderOp,s:Snapshot):Table {
 const table=s.structure?.tables.find(t=>t.id===op.target),cap=s.tableHeaderSources?.[op.target];
 if(typeof op.target!=='string'||!/^s\d+p\d+t\d+$/u.test(op.target)||!table||!Number.isInteger(table.rows)||table.rows<1||table.rows>200||cap?.editable!==true||!/^[a-f0-9]{64}$/u.test(cap.fingerprint??'')||!Number.isInteger(cap.headerRows)||(cap.headerRows as number)<0||(cap.headerRows as number)>table.rows||typeof cap.repeatHeader!=='boolean'||!['none','cell','row'].includes(cap.mode??''))throw new Error('조회된 제목 행 편집 가능 본문 단순 표가 필요합니다.');
 if(!Number.isInteger(op.headerRows)||op.headerRows<0||op.headerRows>table.rows||op.headerRows>200||typeof op.repeatHeader!=='boolean'||!['none','cell','row'].includes(op.paginationMode))throw new Error('제목 행 수는 0부터 표의 전체 행 수까지의 정수이고 반복/쪽 나눔 값을 명시해야 합니다.');
 if(op.repeatHeader&&(op.headerRows<1||op.paginationMode!=='row'||op.headerRows>=table.rows))throw new Error('반복은 맨 위의 연속 제목 행과 행 단위 쪽 나눔, 별도 본문 행이 있는 표에서만 설정하세요.');
 if(cap.headerRows===op.headerRows&&cap.repeatHeader===op.repeatHeader&&cap.mode===op.paginationMode)throw new Error('현재 제목 행·반복·쪽 나눔 설정과 같습니다.');
 return table;
}
