import assert from 'node:assert/strict';
import {labeledSubdivisionNestedTable} from './subdivision-nested-table.mjs';
import {readOwnedZip,writeOwnedZip} from './owned-zip.mjs';

/** Two independent forms, with a top caption and a side caption. */
export function captionedSubdivisionNestedTable(HwpDocument,{sideWidth=4500,complex=false}={}){
  const source=labeledSubdivisionNestedTable(HwpDocument,'접수 제목',4400);
  const parts=readOwnedZip(source.exportHwpx());source.free();
  const section=parts.find(([name])=>name==='Contents/section0.xml');
  let xml=section[1].toString('utf8');
  const bold=xml.match(/<hp:run charPrIDRef="(\d+)"><hp:t>접수 제목<\/hp:t>/)?.[1];
  assert.ok(bold);
  let index=0;
  xml=xml.replace(/<hp:tbl\b[^>]*>[\s\S]*?<hp:inMargin/g,(prefix)=>{
    // The first match consumes the outer table header, then each inline form.
    if(index++===0)return prefix;
    const top=index===2,text=top?'접수':'결재';
    const paragraph='<hp:p id="'+(930+index)+'" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'+
      '<hp:run charPrIDRef="'+bold+'">'+(complex?'<hp:ctrl><hp:bookmark name="복합 캡션"/></hp:ctrl>':'')+
      '<hp:t>'+text+'</hp:t></hp:run><hp:run charPrIDRef="0"><hp:t> 설명</hp:t></hp:run>'+
      '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="5200" flags="393216"/></hp:linesegarray></hp:p>';
    const caption='<hp:caption side="'+(top?'TOP':'RIGHT')+'" fullSz="0" width="'+(top?5200:sideWidth)+'" gap="283" lastWidth="5200">'+
      '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'+paragraph+'</hp:subList></hp:caption>';
    return prefix.replace('<hp:inMargin',caption+'<hp:inMargin');
  });
  assert.equal(index,3);
  section[1]=Buffer.from(xml);
  const doc=new HwpDocument(writeOwnedZip(parts));
  for(let i=0;i<5;i++)doc.setCellProperties(0,1,0,i,'{"height":18000}');
  return doc;
}
