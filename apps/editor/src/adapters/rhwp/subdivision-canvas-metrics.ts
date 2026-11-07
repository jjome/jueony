import type {EditOp,Snapshot} from '../../modules/document/public/index.ts';
import {cellParagraphPlan} from '../../modules/document/public/engine-integration.ts';

type Generation = {document:number;fonts:number};
type Publication = Generation & {json:string};
type CanvasDocument = {
  canvasMetricsActive():boolean;
  collectCanvasMetricRequests(document:number,fonts:number):string;
  registerCanvasMetricReplies(document:number,fonts:number,revision:number,replies:string):boolean;
  selectCanvasMetrics(enabled:boolean):boolean;
};

// Retain only the measurements the view successfully published. The existing
// Studio provider owns font substitution, async cancellation and measurement.
const publications = new WeakMap<CanvasDocument,Publication>();
export function recordPublishedCanvasMetrics(doc:CanvasDocument,generation:Generation,json:string):void {
  publications.set(doc,{...generation,json});
}

export function subdivisionCopyMetrics(wasm:any,base:Snapshot,operations:EditOp[]) {
  const op=operations[0];
  if(operations.length!==1)return;
  if(op.kind==='replace_cell_paragraph'){
    const cell=base.cellParagraphSources?.[op.target]?.cells?.find(c=>c.row===op.row && c.column===op.column);
    const paragraph=cell?.paragraphs.find(p=>p.index===op.paragraph && p.text===op.originalText);
    if(!paragraph?.pictureTextRanges?.length || op.text===op.originalText || !cellParagraphPlan(op,base).pictureEdit ||
        !wasm.borrowDocumentHandle().canvasMetricsActive())return;
  }else if(op.kind==='split_table_cell_into'){
    const table=base.structure?.tables.find(t=>t.id===op.target);
    const sourceCell=table?.cells.find(c=>c.row===op.row && c.column===op.column);
    const inline=Boolean(sourceCell?.axisFieldSignature && !sourceCell.properties.fieldName);
    const nested=table && sourceCell && base.structure?.nestedTables?.some(n=>n.section===table.section && n.paragraph===table.paragraph &&
      n.ancestors[0]?.controlIndex===table.control && n.ancestors[0].cellIndex===sourceCell.index);
    if(!inline && !nested && !base.tableSubdivisionSources?.[op.target]?.frames?.some(f=>f.cells.some(c=>c.lineSignature))) return;
  }else return;
  const live:CanvasDocument=wasm.borrowDocumentHandle();
  const active=live.canvasMetricsActive(), document=wasm.documentGeneration, fonts=wasm.canvasMetricFontGeneration;
  const publication=active?publications.get(live):undefined;
  function assertCurrent(){
    if(wasm.borrowDocumentHandle()!==live || wasm.documentGeneration!==document || wasm.canvasMetricFontGeneration!==fonts ||
        live.canvasMetricsActive()!==active || active && (!publication || publication.document!==document ||
        publication.fonts!==fonts || publications.get(live)?.json!==publication.json))
      throw Error('편집을 검사하는 동안 화면의 글꼴 측정 상태가 바뀌었습니다. 최신 상태로 다시 요청하세요.');
  }
  assertCurrent();
  return (copy:CanvasDocument)=>{
    assertCurrent();
    if(copy===live || copy.canvasMetricsActive()) throw Error('독립된 편집 검사용 사본을 확인하지 못했습니다.');
    if(!publication) return;
    // Rust validates this copy's pending revision, complete key set, font and
    // cluster against the replies before publishing a new metric snapshot.
    const batch=JSON.parse(copy.collectCanvasMetricRequests(document,fonts));
    copy.registerCanvasMetricReplies(document,fonts,batch.revision,publication.json);
    copy.selectCanvasMetrics(true);
    if(!copy.canvasMetricsActive()) throw Error('편집 사본에 화면의 글꼴 측정을 적용하지 못했습니다.');
  };
}
export type SubdivisionCopyMetrics = ReturnType<typeof subdivisionCopyMetrics>;
