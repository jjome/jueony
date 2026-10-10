import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import init,{HwpDocument} from '@rhwp/core';
import {readStructure} from '../src/document-control/structure.ts';
import {validateGeneration} from '../src/mvp/edit-schema.ts';
import {executeDocumentOperations} from '../src/document-control/execute.ts';
const root=fileURLToPath(new URL('../../../',import.meta.url)),directory=join(root,'.tools/public-documents'),out=join(directory,'results');
await mkdir(out,{recursive:true});
await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const text=doc=>JSON.parse(doc.getTextFileUnicode());
const body=doc=>Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>({id:`s${s}p${p}`,section:s,paragraph:p,text:doc.getTextRange(s,p,0,doc.getParagraphLength(s,p)),editable:false}))).flat();
const tableContent=s=>s.tables.map(t=>({rows:t.rows,columns:t.columns,cells:t.cells.map(c=>({row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,text:c.text}))}));
const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')),reports=[];
for(const source of manifest.filter(s=>s.status==='downloaded')) {
 let doc;const report={id:source.id,source:source.page,sha256:source.sha256,exports:[]};
 try{
  const bytes=await readFile(join(directory,source.file));if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw new Error('Original hash mismatch');
  doc=new HwpDocument(bytes);const beforeText=text(doc),beforeBody=body(doc),structure=readStructure(doc),beforeTables=tableContent(structure);
  report.open=true;report.pages=doc.pageCount();report.sections=doc.getSectionCount();report.paragraphs=beforeBody.length;report.tables=structure.tables.length;report.unsupportedControls=structure.unsupportedControls;
  report.textHash=hash(beforeText);report.tableContentHash=hash(beforeTables);
  const first=doc.renderPageSvg(0);report.firstPageSVG=first.includes('<svg');await writeFile(join(out,source.id+'-page1.svg'),first);
  for(const format of ['hwp','hwpx']){
   let reopened,artifact;
   try{artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();const loss=JSON.parse(artifact.contentLoss()),exported=artifact.takeBytes();await writeFile(join(out,source.id+'-roundtrip.'+format),exported);reopened=new HwpDocument(exported);
    const afterText=text(reopened),afterBody=body(reopened);
    report.exports.push({format,size:exported.length,reopened:true,textEqual:hash(afterText)===report.textHash,bodyEqual:hash(afterBody.map(n=>n.text))===hash(beforeBody.map(n=>n.text)),bodyParagraphsBefore:beforeBody.length,bodyParagraphsAfter:afterBody.length,textDifference:afterText===beforeText?'none':afterText===beforeText+'\r\n'?'one extra terminal CRLF':'other',tableContentEqual:hash(tableContent(readStructure(reopened)))===report.tableContentHash,pages:reopened.pageCount(),contentLoss:loss});
   }catch(e){report.exports.push({format,error:String(e)});}finally{reopened?.free();artifact?.free();}
  }
  // Edit a plain existing cell only if the production structural validator accepts it.
  const table=structure.tables.find(t=>t.cells.some(c=>c.editable&&c.rowSpan===1&&c.columnSpan===1)),cell=table?.cells.find(c=>c.editable&&c.rowSpan===1&&c.columnSpan===1);
  if(table&&cell){const saved=doc.saveSnapshot(),snapshot={revision:'corpus',name:source.file,nodes:beforeBody,structure,limitations:[]};
   const generation=validateGeneration({message:'호환성 검사',sourceIds:[],operations:[{kind:'set_table_cell',target:table.id,row:cell.row,column:cell.column,originalText:cell.text,text:'호환성 검사 셀'}]},snapshot,[]);
   executeDocumentOperations(doc,snapshot,generation.operations);const changed=readStructure(doc).tables.find(t=>t.id===table.id).cells.find(c=>c.row===cell.row&&c.column===cell.column);report.cellEdit=changed.text==='호환성 검사 셀';
   for(const format of ['hwp','hwpx'])await writeFile(join(out,source.id+'-edited.'+format),format==='hwp'?doc.exportHwp():doc.exportHwpx());
   doc.restoreSnapshot(saved);report.undo=hash(text(doc))===report.textHash&&hash(tableContent(readStructure(doc)))===report.tableContentHash;
  }else report.cellEdit='not applicable: no supported simple cell';
  report.status=report.exports.length===2&&report.exports.every(r=>r.reopened&&r.textEqual&&r.tableContentEqual)&&report.undo!==false?'PASS_CONTENT':'REVIEW_REQUIRED';
 }catch(error){report.status='FAIL';report.error=String(error);}finally{doc?.free();}
 reports.push(report);console.log(JSON.stringify({id:report.id,status:report.status,pages:report.pages,tables:report.tables,error:report.error}));
}
await writeFile(join(out,'report.json'),JSON.stringify({engine:'@rhwp/core 0.8.7',scope:'Content/structure round trip using same engine, not independent Hancom/layout validation',reports},null,2));
