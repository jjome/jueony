import {nestedCaptionFixture} from './nested-caption-fixture.mjs';
import {readOwnedZip,writeOwnedZip} from './owned-zip.mjs';

export function nestedCaptionCursorFixture(HwpDocument,deep=false){
 const source=nestedCaptionFixture(HwpDocument,{direction:'BOTTOM',extraParagraph:true,emptyParagraphs:1,multiline:true,compact:true,siblingCaption:true});
 const parts=readOwnedZip(source.exportHwpx());source.free();
 const section=parts.find(([n])=>n==='Contents/section0.xml');let xml=section[1].toString();
 // Keep both sibling captions inside their respective parent columns.
 const left=xml.indexOf('<hp:tbl ',xml.indexOf('<hp:t>왼부모</hp:t>')),leftEnd=xml.indexOf('</hp:tbl>',left)+9;
 if(left<0||leftEnd<left)throw Error('Missing sibling cursor fixture owner');
 xml=xml.slice(0,left)+xml.slice(left,leftEnd).replace('<hp:sz width="42520"','<hp:sz width="9600"')
  .replaceAll('<hp:cellSz width="42520"','<hp:cellSz width="9600"')+xml.slice(leftEnd);
 if(!deep){section[1]=Buffer.from(xml);return new HwpDocument(writeOwnedZip(parts));}
 const cell=xml.indexOf('<hp:t>가</hp:t>'),start=xml.lastIndexOf('<hp:tbl ',cell),end=xml.indexOf('</hp:tbl>',cell)+9;
 if(cell<0||start<0||end<cell)throw Error('Missing nested cursor fixture owner');
 const child=xml.slice(start,end).replace('<hp:sz width="9600"','<hp:sz width="4800"')
  .replaceAll('<hp:cellSz width="4800"','<hp:cellSz width="2400"')
  .replace(/(<hp:(?:p|tbl) id=")(\d+)"/g,(_,tag,id)=>tag+(1000+Number(id))+'"');
 const parent=xml.slice(start,end).replace('<hp:t>가</hp:t>',child)
  .replace('<hp:cellSz width="4800" height="1000"','<hp:cellSz width="4800" height="14000"');
 section[1]=Buffer.from(xml.slice(0,start)+parent+xml.slice(end));
 return new HwpDocument(writeOwnedZip(parts));
}

// Self-contained so the exact same query checks run in Node and real Edge.
export function probeNestedCaptionCursors(doc,owners){
 const read=x=>JSON.parse(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const check=(ok,message)=>{if(!ok)throw Error(message);},near=(a,b)=>Math.abs(a-b)<=.21;
 const all=Array.from({length:doc.pageCount()},(_,page)=>read(doc.getPageTextLayout(page)).runs
  .filter(r=>r.cellPath?.at(-1)?.cellIndex===65534).map(r=>({...r,page}))).flat();
 const frames=Array.from({length:doc.pageCount()},(_,page)=>read(doc.getPageControlLayout(page)).controls.map(c=>({...c,page}))).flat();
 const results=[];
 for(const owner of owners){
  const leaf={controlIndex:owner.control,cellIndex:0,cellParaIndex:0};
  const evidence=read(doc.getTableAxisCaptionEvidenceByPath(owner.section,owner.paragraph,JSON.stringify([...owner.ancestors,leaf])));
  if(!evidence)continue;
  const paragraphs=evidence.kind==='plain'?[evidence]:evidence.paragraphs;
  check(Array.isArray(paragraphs),'Unsupported fixture caption evidence');
  const tablePath=[...owner.ancestors,leaf];
  const key=[owner.section,owner.ancestors.at(-1).cellParaIndex,...tablePath.flatMap(p=>[p.controlIndex,p.cellIndex,p.cellParaIndex]),owner.control];
  const matched=frames.filter(f=>f.type==='table'&&same(f.stableIndex,key));
  check(matched.length===1,'Expected a unique rendered caption table');
  const boxes=read(doc.getTableCellBboxesByPath(owner.section,owner.paragraph,JSON.stringify(tablePath)));
  const physical=c=>[c.cellIdx,c.row,c.col,c.rowSpan,c.colSpan,c.x,c.y,c.w,c.h];
  check(boxes.length===owner.cells.length&&boxes.every(b=>b.pageIndex===matched[0].page)&&
   same(boxes.map(physical),matched[0].cells.map(physical)),'Caption run selected an ancestor table for cell bounds');
  for(const [ordinal,paragraph] of paragraphs.entries()){
   const path=[...owner.ancestors,{...leaf,cellIndex:65534,cellParaIndex:ordinal}],serialized=JSON.stringify(path);
   const runs=all.filter(r=>r.secIdx===owner.section&&r.parentParaIdx===owner.paragraph&&same(r.cellPath,path));
   check(runs.length>0&&runs.map(r=>r.text).join('')===paragraph.text,'Caption owner text/path mismatch');
   check(runs.every(r=>r.controlIdx===path[0].controlIndex&&r.cellIdx===path[0].cellIndex&&r.cellParaIdx===path[0].cellParaIndex),'Legacy outer address mismatch');
   const positions=[];
   for(let offset=0;offset<=Array.from(paragraph.text).length;offset++){
    const rect=read(doc.getCursorRectByPath(owner.section,owner.paragraph,serialized,offset));
    const choices=runs.flatMap(r=>r.charX.map((x,i)=>({offset:r.charStart+i,pageIndex:r.page,x:r.x+x,y:r.y,height:r.h})));
    check(choices.some(c=>c.offset===offset&&c.pageIndex===rect.pageIndex&&near(c.x,rect.x)&&near(c.y,rect.y)&&near(c.height,rect.height)),
     'Cursor does not match its caption glyph '+owner.id+'/'+ordinal+'/'+offset+' '+JSON.stringify(rect));
    const run=runs.find(r=>r.page===rect.pageIndex&&near(r.y,rect.y)&&offset>=r.charStart&&offset<=r.charStart+Array.from(r.text).length&&
     near(r.x+r.charX[offset-r.charStart],rect.x));
    // Published caret coordinates are rounded to 0.1px. Probe just inside the
    // selected run, avoiding a click outside its unrounded edge.
    const edge=run.text!==''&&offset===run.charStart+Array.from(run.text).length?-.06:.06;
    const hit=read(doc.hitTest(rect.pageIndex,rect.x+edge,rect.y+rect.height/2));
    check(hit.sectionIndex===owner.section&&hit.parentParaIndex===owner.paragraph&&same(hit.cellPath,path)&&hit.charOffset===offset,
     'Caption hit/cursor path did not roundtrip '+owner.id+'/'+ordinal+'/'+offset+' '+JSON.stringify(hit));
    const hinted=read(doc.getCursorRectByPathNear(owner.section,owner.paragraph,serialized,offset,rect.pageIndex));
    check(same(rect,hinted),'Hinted caption cursor differs');
    positions.push({offset,page:rect.pageIndex,x:rect.x,y:rect.y,height:rect.height});
   }
   results.push({owner:owner.id,path,text:paragraph.text,positions});
  }
 }
 check(results.length>=6,'Expected separate sibling captions');
 check(results.some(r=>r.text==='')&&results.some(r=>r.text.includes('😀')),'Expected empty and emoji caption paragraphs');
 return results;
}
