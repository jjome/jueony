import {readOwnedZip,writeOwnedZip} from './owned-zip.mjs';

/** A fixed-size inline form fits the first of three new columns. HTML import
 * sizes an inner table to the page, so set its actual stored dimensions. */
export function subdivisionNestedTable(HwpDocument,width=5200,labels,secondWidth) {
  const d=HwpDocument.createEmpty();
  try{
    d.createBlankDocument();d.insertText(0,0,0,'서식');d.splitParagraph(0,0,2);
    d.pasteHtml(0,1,0,'<table><tr><td colspan="2"><table><tr><td>X</td><td>Y</td></tr></table></td><td>옆</td></tr><tr><td>가</td><td>나</td><td>다</td></tr></table>');
    d.setTableProperties(0,1,0,'{"treatAsChar":false,"vertRelTo":"Para","horzRelTo":"Para"}');
    for(const [i,size] of [24000,12000,12000,12000,12000].entries())
      d.setCellProperties(0,1,0,i,JSON.stringify({width:size,height:secondWidth?12000:6400,verticalAlign:0}));
    const parts=readOwnedZip(d.exportHwpx()),section=parts.find(([n])=>n==='Contents/section0.xml'),xml=section[1].toString('utf8');
    const start=xml.indexOf('<hp:tbl ',xml.indexOf('<hp:tbl ')+1),end=xml.indexOf('</hp:tbl>',start);
    if(start<0 || end<start)throw Error('Missing nested table fixture');
    const inner=xml.slice(start,end).replace(/<hp:sz width="\d+"/,'<hp:sz width="'+width+'"')
      .replace(/height="1000" heightRelTo/,'height="2100" heightRelTo')
      .replace(/<hp:cellSz width="\d+" height="\d+"/g,'<hp:cellSz width="'+width/2+'" height="2100"');
    let composed=xml.slice(0,start)+inner+xml.slice(end);
    if(labels){
      // Reuse a normal paragraph produced by the importer, including its measured line.
      const sample=composed.match(/<hp:p [^>]*><hp:run [^>]*><hp:t>옆<\/hp:t><\/hp:run>[\s\S]*?<\/hp:p>/)?.[0];
      if(!sample)throw Error('Missing ordinary cell paragraph fixture');
      const paragraph=(id,text)=>sample.replace(/id="\d+"/,'id="'+id+'"').replace('>옆<',()=>'>'+
        text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'<');
      const anchorStart=composed.lastIndexOf('<hp:p ',start),anchorEnd=composed.indexOf('</hp:p>',start+inner.length)+7;
      const anchor=composed.slice(anchorStart,anchorEnd);
      const second=secondWidth?paragraph(303,'결재')+anchor.replace(/(<hp:(?:p|tbl) id=")(\d+)"/g,(_,tag,id)=>tag+(400+Number(id))+'"')
        .replace(/<hp:sz width="\d+"/,'<hp:sz width="'+secondWidth+'"')
        .replace(/<hp:cellSz width="\d+"/g,'<hp:cellSz width="'+secondWidth/2+'"')
        .replace('>X<','>A<').replace('>Y<','>B<'):'';
      composed=composed.slice(0,anchorStart)+paragraph(301,labels[0])+anchor+second+
        paragraph(302,labels[1])+composed.slice(anchorEnd);
    }
    section[1]=Buffer.from(composed);
    return new HwpDocument(writeOwnedZip(parts));
  }finally{d.free();}
}

export function labeledSubdivisionNestedTable(HwpDocument,title='접수 제목',secondWidth) {
  const doc=subdivisionNestedTable(HwpDocument,5200,[title,'설명'],secondWidth);
  doc.applyCharFormatInCell(0,1,0,0,0,0,Array.from(title).length,'{"bold":true}');
  doc.applyCharFormatInCell(0,1,0,0,secondWidth?4:2,0,2,'{"italic":true}');
  if(secondWidth)doc.applyCharFormatInCellByPath(0,1,JSON.stringify([
    {controlIndex:0,cellIndex:0,cellParaIndex:3},{controlIndex:0,cellIndex:0,cellParaIndex:0},
  ]),0,1,'{"bold":true}');
  return doc;
}

export function emphasizedSubdivisionNestedTable(HwpDocument) {
  const doc=labeledSubdivisionNestedTable(HwpDocument);
  doc.applyCharFormatInCell(0,1,0,0,0,3,5,'{"bold":false,"textColor":"#dc2626"}');
  doc.applyCharFormatInCell(0,1,0,0,2,0,1,'{"italic":false}');
  return doc;
}
