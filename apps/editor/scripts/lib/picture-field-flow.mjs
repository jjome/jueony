import assert from 'node:assert/strict';

// This reader is also serialized into the real browser document context.
export function readPictureFieldFlow(d,args){
 if(Array.isArray(d)){args=d;d=window.__pageServices.wasm.borrowDocumentHandle();}
 const [section,parent,control,cell,paragraph]=args,path=[{controlIndex:control,cellIndex:cell,cellParaIndex:paragraph}];
 const owns=r=>r.secIdx===section&&r.parentParaIdx===parent&&r.cellIdx===cell&&JSON.stringify(r.cellPath)===JSON.stringify(path);
 const text=d.getTextInCell(...args,0,d.getCellParagraphLength(...args));
 const runs=Array.from({length:d.pageCount()},(_,page)=>JSON.parse(d.getPageTextLayout(page)).runs.filter(owns).map(r=>({...r,page}))).flat();
 const count=JSON.parse(d.getLineInfoInCell(...args,0)).lineCount;
 return {text,runs,rows:Array.from({length:count},(_,i)=>({
  start:JSON.parse(d.getCursorRectOnLine(section,paragraph,i,false,parent,control,cell,paragraph)),
  end:JSON.parse(d.getCursorRectOnLine(section,paragraph,i,true,parent,control,cell,paragraph))})),
  cursors:Array.from({length:Array.from(text).length+1},(_,i)=>JSON.parse(d.getCursorRectByPath(section,parent,JSON.stringify(path),i))),
  cell:JSON.parse(d.getCellProperties(section,parent,control,cell)),
  paragraph:JSON.parse(d.getCellParaPropertiesAt(...args)),
  fontSize:JSON.parse(d.getCellCharPropertiesAt(...args,0)).fontSize};
}
const near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=.2,`${label}: ${a} != ${b}`);
export function assertPictureFieldFlow(flow){
 const chars=Array.from(flow.text),coverage=Array(chars.length).fill(0);
 assert.equal(flow.fontSize,1000);
 assert.equal(flow.paragraph.alignment,'left');assert.equal(flow.paragraph.marginLeft,0);assert.equal(flow.paragraph.marginRight,0);assert.equal(flow.paragraph.indent,0);
 const bounds=flow.cursors[0]?.cellBounds;assert.ok(bounds);
 const lineX=bounds.x+flow.cell.paddingLeft/75;
 for(const run of flow.runs){
  const length=Array.from(run.text).length;
  assert.equal(chars.slice(run.charStart,run.charStart+length).join(''),run.text,'Every rendered run names its actual source slice');
  for(let i=run.charStart;i<run.charStart+length;i++)coverage[i]++;
 }
 assert.deepEqual(coverage,chars.map(()=>1),'Every visible source character paints exactly once');
 for(const [offset,cursor] of flow.cursors.entries()){
  // At an exact soft-wrap boundary both end-of-previous and start-of-next
  // affinity are valid. Interior offsets must identify their actual row.
  const candidates=flow.runs.filter(r=>r.charStart<=offset&&offset<=r.charStart+Array.from(r.text).length);
  assert.ok(candidates.some(r=>cursor.pageIndex===r.page&&Math.abs(cursor.y-r.y)<=.2&&Math.abs(cursor.height-r.h)<=.2),
   `Offset ${offset} caret must match a run containing that source boundary`);
 }
 assert.equal(new Set(flow.runs.map(r=>r.y)).size,flow.rows.length);
 for(const [i,row] of flow.rows.entries()){
  const runs=flow.runs.filter(r=>Math.abs(r.y-row.start.y)<=.2);
  assert.ok(runs.length);
  near(row.start.y,row.end.y,'Line '+i+' endpoints');
  near(row.start.x,lineX,'Line '+i+' independently derived start');
  near(row.start.x,Math.min(...runs.map(r=>r.x)),'Line '+i+' painted start');
  near(row.end.x,Math.max(...runs.map(r=>r.x+r.w)),'Line '+i+' end');
  near(row.start.height,1000/75,'10pt line height');
 }
 near(flow.cursors.at(-1).y,flow.rows.at(-1).end.y,'Final visible offset uses final line');
 near(flow.cursors.at(-1).x,flow.rows.at(-1).end.x,'Final offset and line end coincide');
 return flow;
}
export function assertCenteredPictureFlow(before,after){
 assert.deepEqual(after.cell,before.cell);assert.deepEqual(after.paragraph,before.paragraph);
 assert.equal(before.cell.verticalAlign,1);assert.equal(before.paragraph.lineSpacingType,'Percent');
 const height=1000/75,spacing=height*(before.paragraph.lineSpacing/100-1);
 for(const flow of [before,after])for(let i=1;i<flow.rows.length;i++)
  near(flow.rows[i].start.y-flow.rows[i-1].start.y,height+spacing,'Independent original line spacing');
 const block=f=>f.rows.at(-1).end.y+f.rows.at(-1).end.height-f.rows[0].start.y;
 const dy=(block(before)-block(after))/2;
 near(after.rows[0].start.y,before.rows[0].start.y+dy,'Center displacement from complete line blocks');
 return dy;
}
