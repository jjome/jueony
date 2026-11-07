import assert from 'node:assert/strict';
import {readOwnedZip,writeOwnedZip} from './owned-zip.mjs';

export function nestedCaptionFixture(HwpDocument,{direction='BOTTOM',extraParagraph=false,siblingCaption=false}={}){
 const seed=HwpDocument.createEmpty();seed.createBlankDocument();
 try{
  const left='<table><tr><td><strong>좌강조</strong></td></tr>'+('<tr><td>왼쪽 이웃</td></tr>'.repeat(7))+'</table>';
  const right='<table><tr><td>가</td><td>나</td></tr><tr><td>다</td><td>라</td></tr></table>';
  seed.pasteHtml(0,0,0,'<table><tr><td valign="top">왼부모'+left+'</td><td valign="top">오른부모'+right+'</td></tr></table>');
  const parts=readOwnedZip(seed.exportHwpx()),section=parts.find(([n])=>n==='Contents/section0.xml'),xml=section[1].toString();
  const boldId=xml.match(/<hp:run charPrIDRef="(\d+)"><hp:t>좌강조<\/hp:t>/)?.[1];
  assert.ok(boldId&&boldId!=='0');
  const parent=xml.indexOf('<hp:t>오른부모</hp:t>'),start=xml.indexOf('<hp:tbl ',parent),at=xml.indexOf('<hp:inMargin',start);
  assert.ok(at>start&&start>parent&&parent>=0);
  const line='<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>';
  const para='<hp:p id="193" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>캡션 </hp:t></hp:run><hp:run charPrIDRef="'+boldId+'"><hp:t>제목</hp:t></hp:run>'+line+'</hp:p>';
  const cap='<hp:caption side="'+direction+'" fullSz="0" width="8504" gap="283" lastWidth="42520"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'+para+(extraParagraph?para:'')+'</hp:subList></hp:caption>';
  let result=xml.slice(0,at)+cap+xml.slice(at);
  if(siblingCaption){
   const leftTable=xml.indexOf('<hp:tbl ',xml.indexOf('<hp:t>왼부모</hp:t>')),leftMargin=xml.indexOf('<hp:inMargin',leftTable);
   assert.ok(leftTable>=0&&leftMargin<at);
   result=result.slice(0,leftMargin)+cap+result.slice(leftMargin);
  }
  section[1]=Buffer.from(result);return new HwpDocument(writeOwnedZip(parts));
 }finally{seed.free();}
}
