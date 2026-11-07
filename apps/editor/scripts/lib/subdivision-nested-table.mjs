import {readOwnedZip,writeOwnedZip} from './owned-zip.mjs';

/** A fixed-size inline form fits the first of three new columns. HTML import
 * sizes an inner table to the page, so set its actual stored dimensions. */
export function subdivisionNestedTable(HwpDocument,width=5200) {
  const d=HwpDocument.createEmpty();
  try{
    d.createBlankDocument();d.insertText(0,0,0,'서식');d.splitParagraph(0,0,2);
    d.pasteHtml(0,1,0,'<table><tr><td colspan="2"><table><tr><td>X</td><td>Y</td></tr></table></td><td>옆</td></tr><tr><td>가</td><td>나</td><td>다</td></tr></table>');
    d.setTableProperties(0,1,0,'{"treatAsChar":false,"vertRelTo":"Para","horzRelTo":"Para"}');
    for(const [i,size] of [24000,12000,12000,12000,12000].entries())
      d.setCellProperties(0,1,0,i,JSON.stringify({width:size,height:6400,verticalAlign:0}));
    const parts=readOwnedZip(d.exportHwpx()),section=parts.find(([n])=>n==='Contents/section0.xml'),xml=section[1].toString('utf8');
    const start=xml.indexOf('<hp:tbl ',xml.indexOf('<hp:tbl ')+1),end=xml.indexOf('</hp:tbl>',start);
    if(start<0 || end<start)throw Error('Missing nested table fixture');
    const inner=xml.slice(start,end).replace(/<hp:sz width="\d+"/,'<hp:sz width="'+width+'"')
      .replace(/height="1000" heightRelTo/,'height="2100" heightRelTo')
      .replace(/<hp:cellSz width="\d+" height="\d+"/g,'<hp:cellSz width="'+width/2+'" height="2100"');
    section[1]=Buffer.from(xml.slice(0,start)+inner+xml.slice(end));
    return new HwpDocument(writeOwnedZip(parts));
  }finally{d.free();}
}
