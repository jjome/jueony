import assert from 'node:assert/strict';
import {readOwnedZip,writeOwnedZip} from './owned-zip.mjs';

export function nestedCaptionFixture(HwpDocument,{direction='BOTTOM',extraParagraph=false,siblingCaption=false,multiline=false,align='TOP',complex,compact=false,tall=false}={}){
 const seed=HwpDocument.createEmpty();seed.createBlankDocument();
 try{
  const left='<table><tr><td><strong>좌강조</strong></td></tr>'+('<tr><td>왼쪽 이웃</td></tr>'.repeat(tall||multiline?13:7))+'</table>';
  const right='<table><tr><td>가</td><td>나</td></tr><tr><td>다</td><td>라</td></tr>'+(tall?'<tr><td>마</td><td>바</td></tr>'.repeat(4):'')+'</table>';
  seed.pasteHtml(0,0,0,'<table><tr><td valign="top">왼부모'+left+'</td><td valign="top">오른부모'+right+'</td></tr></table>');
  const parts=readOwnedZip(seed.exportHwpx()),section=parts.find(([n])=>n==='Contents/section0.xml'),xml=section[1].toString();
  const boldId=xml.match(/<hp:run charPrIDRef="(\d+)"><hp:t>좌강조<\/hp:t>/)?.[1];
  assert.ok(boldId&&boldId!=='0');
  const parent=xml.indexOf('<hp:t>오른부모</hp:t>'),start=xml.indexOf('<hp:tbl ',parent),at=xml.indexOf('<hp:inMargin',start);
  assert.ok(at>start&&start>parent&&parent>=0);
  const line='<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>';
  const para='<hp:p id="193" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>캡션 </hp:t></hp:run><hp:run charPrIDRef="'+boldId+'"><hp:t>제목</hp:t></hp:run>'+line+'</hp:p>';
  const first=multiline?para.replace('>제목<','>제목😀뒤<').replace('</hp:linesegarray>',line.match(/<hp:lineseg [^>]+\/>/)[0]
    .replace('textpos="0" vertpos="0"','textpos="7" vertpos="1600"')+'</hp:linesegarray>'):para;
  const second=para.replace('id="193"','id="194"').replace('>캡션 <','>둘째 <').replace('>제목<','>설명<');
  let body=first+(extraParagraph?second:'');
  if(complex==='bookmark')body=body.replace('<hp:t>캡션 ', '<hp:ctrl><hp:bookmark name="캡션 안"/></hp:ctrl><hp:t>캡션 ');
  if(complex==='empty')body+=para.replace(/<hp:t>[^<]*<\/hp:t>/g,'<hp:t/>');
  const cap='<hp:caption side="'+direction+'" fullSz="0" width="8504" gap="283" lastWidth="42520"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="'+align+'" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'+body+'</hp:subList></hp:caption>';
  let suffix=xml.slice(at);
  let tableStart=xml.slice(start,at);
  if(compact){
   const end=suffix.indexOf('</hp:tbl>');
   tableStart=tableStart.replace('width="42520"','width="9600"');
   suffix=suffix.slice(0,end).replaceAll('width="21260"','width="4800"').replaceAll('horzsize="20978"','horzsize="4518"')+suffix.slice(end);
  }
  let result=xml.slice(0,start)+tableStart+cap+suffix;
  if(siblingCaption){
   const leftTable=xml.indexOf('<hp:tbl ',xml.indexOf('<hp:t>왼부모</hp:t>')),leftMargin=xml.indexOf('<hp:inMargin',leftTable);
   assert.ok(leftTable>=0&&leftMargin<at);
   result=result.slice(0,leftMargin)+cap+result.slice(leftMargin);
  }
  section[1]=Buffer.from(result);return new HwpDocument(writeOwnedZip(parts));
 }finally{seed.free();}
}
