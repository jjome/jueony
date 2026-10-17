import {readFile,writeFile}from'node:fs/promises';
import {loadReviewEngine,snapshot,hash}from'../../apps/editor/scripts/lib/hancom-review.mjs';
const root='C:/Users/jjome/Documents/work/jueony',out=root+'/build/table-origin-closure77';
const e=await loadReviewEngine(root+'/build/rhwp-engine/source-de849bf3aacef6f1/pkg');
let d=e.HwpDocument.createEmpty(),r;try{
 d.createBlankDocument();d.insertText(0,0,0,'분할 표의 앞 문단');d.splitParagraph(0,0,d.getParagraphLength(0,0));const t=JSON.parse(d.createTable(0,1,0,90,2));
 for(let cell=0;cell<180;cell++)d.insertTextInCell(0,1,t.controlIdx,cell,0,0,'내용 '+cell);
 d.setTableProperties(0,1,t.controlIdx,'{"pageBreak":1,"repeatHeader":true}');
 d.splitParagraph(0,1,d.getParagraphLength(0,1));d.createTable(0,2,0,2,2);
 const b=d.exportHwp();r=new e.HwpDocument(b);const s=snapshot(r);
 await writeFile(out+'/partial-negative.hwp',b);
 await writeFile(out+'/partial-negative-baseline77.json',JSON.stringify({engine:e.metadata,sourceSHA256:hash(b),pages:s.pages,layout:s.layout,scope:'Exact generated 90x2 CellBreak table; same owner on multiple pages with distinct cell subsets proves actual physical fragments, not only a guessed size.'},null,2));
 console.log('PAGES',s.pages,s.layout.map(p=>p.controls.controls.filter(c=>c.paraIdx===1).map(c=>({paraIdx:c.paraIdx,cells:c.cells?.length}))));
}finally{r?.free();d.free();}
