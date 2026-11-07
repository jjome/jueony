import type {Table} from '../../modules/document/public/index.ts';
import {readAgentTablePaginationSources} from './agent-table-pagination.ts';
import {verifyPreservedExport} from './preservation.ts';
import {parsed} from './structure.ts';
import {readMergedSplitGrid} from './table-split.ts';

/** Require the native HWP5 serializer, its loss report and a full independent reopen.
 * Some HWP5 sources change table anchors or raw line ownership when serialized. */
export function verifiedSubdivisionHwp(d:any):Uint8Array {
  const artifact=d.exportHwpWithReport();
  try {
    const bytes=artifact.takeBytes();
    const signature=[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1];
    if (!signature.every((v,i)=>bytes[i]===v)) throw new Error('HWP5 복합 파일 서명을 확인하지 못했습니다.');
    const report=verifyPreservedExport(d,bytes,'hwp',artifact.contentLoss(),bytes=>new d.constructor(bytes));
    if (!['summary-metadata','stored-date-information','cells','whole-document-published-layout'].every(key=>report.checked.includes(key)))
      throw new Error('HWP 원본 문서 정보·날짜·셀·전체 배치의 저장 재열기를 확인하지 못했습니다.');
    return bytes;
  } finally { artifact.free(); }
}

export function hwpSubdivisionSource(d:any,t:Table,tables:Table[]) {
  const info=parsed(d.getDocumentInfo()), p=parsed(d.getTableProperties(t.section,t.paragraph,t.control));
  if (d.getSourceFormat()!=='hwp' || !/^5\./u.test(info.version) || info.hwp3Variant!==false || info.encrypted!==false
      || d.getSectionCount()!==1 || d.pageCount()!==1 || tables.length!==1 || t.section!==0 || !t.editable
      || t.rows*t.columns>200 || parsed(d.getColumnDef(0)).columnCount!==1
      || p.cellZoneCount!==0 || p.cellSpacing!==0 || p.hasCaption || p.treatAsChar || p.allowOverlap
      || p.textWrap!=='TopAndBottom' || p.vertRelTo!=='Para' || p.vertAlign!=='Top'
      || !['Para','Column'].includes(p.horzRelTo) || p.horzAlign!=='Left'
      || parsed(d.getFieldList()).length || parsed(d.getBookmarks()).length
      || parsed(d.getControls()).some((c:any)=>c.list!==0 || !['tbl','secd','cold'].includes(c.ctrlId))
      || parsed(d.getCursorModel()).lists.some((l:any)=>!l.isCell || l.hostListId!==0))
    throw new Error('HWP5 한 쪽·한 단의 보호되지 않은 본문 표 한 개가 필요합니다.');
  const merged=t.cells.some(c=>c.rowSpan>1||c.columnSpan>1);
  const source=merged ? readMergedSplitGrid(d,t) : readAgentTablePaginationSources(d,[t])?.[t.id];
  if (source?.editable!==true) throw new Error('HWP 표의 원래 격자·내용·보호 상태를 확인하지 못했습니다.');
  verifiedSubdivisionHwp(d);
  return source;
}
