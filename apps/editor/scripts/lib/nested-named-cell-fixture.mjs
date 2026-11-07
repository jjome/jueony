import assert from 'node:assert/strict';
import {readOwnedZip,writeOwnedZip} from './owned-zip.mjs';
import {readStructure} from '../../src/adapters/rhwp/structure.ts';

export function nestedNamedCellFixture(HwpDocument){
 const d=HwpDocument.createEmpty();d.createBlankDocument();
 try{
  d.insertText(0,0,0,'작성자 자리');d.splitParagraph(0,0,6);
  assert.equal(JSON.parse(d.insertClickHereField(0,0,1,'작성자','','본문',true)).fieldId,1);
  const inner=value=>'<table><tr><td>A</td><td rowspan="2">'+value+'</td></tr><tr><td>C</td></tr><tr><td>E</td><td>F</td></tr></table>';
  d.pasteHtml(0,1,0,'<table><tr><td>왼쪽'+inner('Alpha')+'</td><td>오른쪽'+inner('Beta')+'</td></tr></table>');
  const right=readStructure(d).nestedTables[1],path=p=>JSON.stringify([...right.ancestors,{controlIndex:right.control,cellIndex:1,cellParaIndex:p}]);
  d.splitParagraphInCellByPath(0,1,path(0),4);d.insertTextInCellByPath(0,1,path(1),0,'둘째😀');d.applyCharFormatInCellByPath(0,1,path(1),0,2,'{"bold":true}');
  const parts=readOwnedZip(d.exportHwpx()),section=parts.find(([name])=>name==='Contents/section0.xml');
  let xml=section[1].toString('utf8');
  for(const value of ['Alpha','Beta']){
   const text=xml.indexOf('<hp:t>'+value+'</hp:t>'),start=xml.lastIndexOf('<hp:tc ',text),end=xml.indexOf('>',start);
   assert.ok(text>end&&end>start&&start>=0);
   const tag=xml.slice(start,end);assert.ok(tag.includes('name=""'));
   xml=xml.slice(0,start)+tag.replace('name=""','name="공통 이름"')+xml.slice(end);
  }
  section[1]=Buffer.from(xml);
  return new HwpDocument(writeOwnedZip(parts));
 }finally{d.free();}
}
