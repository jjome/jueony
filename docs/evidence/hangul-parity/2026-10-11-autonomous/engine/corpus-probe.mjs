import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join,dirname,resolve} from 'node:path';
const evidence=dirname(fileURLToPath(import.meta.url)), root=resolve(evidence,'../../../../..');
const out=join(evidence,'generated');await mkdir(out,{recursive:true});
const {default:init,HwpDocument}=await import(pathToFileURL(join(root,'apps/editor/node_modules/@rhwp/core/rhwp.js')));
const {readStructure}=await import(pathToFileURL(join(root,'apps/editor/src/document-control/structure.ts')));
const {validateGeneration}=await import(pathToFileURL(join(root,'apps/editor/src/mvp/edit-schema.ts')));
const {executeDocumentOperations}=await import(pathToFileURL(join(root,'apps/editor/src/document-control/execute.ts')));
await init({module_or_path:await readFile(join(root,'apps/editor/node_modules/@rhwp/core/rhwp_bg.wasm'))});
const hash=v=>createHash('sha256').update(typeof v==='string'||v instanceof Uint8Array?v:JSON.stringify(v)).digest('hex');
const body=doc=>Array.from({length:doc.getSectionCount()},(_,section)=>Array.from({length:doc.getParagraphCount(section)},(_,paragraph)=>({id:`s${section}p${paragraph}`,section,paragraph,text:doc.getTextRange(section,paragraph,0,doc.getParagraphLength(section,paragraph)),editable:false}))).flat();
const view=doc=>{const structure=readStructure(doc);return {text:JSON.parse(doc.getTextFileUnicode()),body:body(doc).map(n=>n.text),controls:JSON.parse(doc.getControls()).map(c=>c.ctrlId),tables:structure.tables.map(t=>({rows:t.rows,columns:t.columns,cells:t.cells.map(c=>({row:c.row,column:c.column,rowSpan:c.rowSpan,columnSpan:c.columnSpan,text:c.text}))})),pages:doc.pageCount()};};
const manifest=JSON.parse(await readFile(join(root,'.tools/public-documents/manifest.json'),'utf8')), reports=[];
for(const source of manifest.filter(s=>s.status==='downloaded')){
 const report={id:source.id,source:source.page,sourceSha256:source.sha256,engine:'@rhwp/core@0.8.7',independentHancom:'BLOCKED_REFERENCE',exports:[],editedExports:[]};let doc;
 try{
  const bytes=await readFile(join(root,'.tools/public-documents',source.file));if(hash(bytes)!==source.sha256)throw new Error('source hash mismatch');
  doc=new HwpDocument(bytes);const before=view(doc),structure=readStructure(doc);report.before={pages:before.pages,paragraphs:before.body.length,tables:before.tables.length,controlKinds:[...new Set(before.controls)]};
  for(const format of ['hwp','hwpx']){
   let artifact, reopened;try{
    artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();const contentLoss=JSON.parse(artifact.contentLoss()),data=artifact.takeBytes();reopened=new HwpDocument(data);const after=view(reopened);
    const file=`${source.id}-roundtrip.${format}`;await writeFile(join(out,file),data);
    report.exports.push({format,file:`generated/${file}`,sha256:hash(data),size:data.length,reopened:true,textEqual:hash(before.text)===hash(after.text),bodyEqual:hash(before.body)===hash(after.body),tableContentEqual:hash(before.tables)===hash(after.tables),controlKindsEqual:hash(before.controls)===hash(after.controls),pages:after.pages,paragraphs:after.body.length,contentLoss});
   }catch(e){report.exports.push({format,error:String(e)});}finally{artifact?.free();reopened?.free();}
  }
  const table=structure.tables.find(t=>t.cells.every(c=>c.rowSpan===1&&c.columnSpan===1)&&t.cells.some(c=>c.editable)),cell=table?.cells.find(c=>c.editable);
  if(table&&cell){
   const token=doc.saveSnapshot(),snapshot={revision:'probe',name:source.file,nodes:body(doc),structure,limitations:[]},marker='원본 연결·복구 호환성 검사';
   const generation=validateGeneration({message:'검사',sourceIds:[],operations:[{kind:'set_table_cell',target:table.id,row:cell.row,column:cell.column,originalText:cell.text,text:marker}]},snapshot,[]);
   executeDocumentOperations(doc,snapshot,generation.operations);
   for(const format of ['hwp','hwpx']){let artifact,reopened;try{
    artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();const contentLoss=JSON.parse(artifact.contentLoss()),data=artifact.takeBytes();reopened=new HwpDocument(data);
    const found=readStructure(reopened).tables.find(t=>t.id===table.id)?.cells.find(c=>c.row===cell.row&&c.column===cell.column);
    const file=`${source.id}-edited.${format}`;await writeFile(join(out,file),data);
    report.editedExports.push({format,file:`generated/${file}`,sha256:hash(data),selectedCellTextEqual:found?.text===marker,contentLoss});
   }catch(e){report.editedExports.push({format,error:String(e)});}finally{artifact?.free();reopened?.free();}}
   doc.restoreSnapshot(token);report.undoContentEqual=hash(view(doc))===hash(before);
  }else report.cellEdit='NOT_APPLICABLE: no wholly unmerged table with an editable simple cell';
  report.status=report.exports.length===2&&report.exports.every(e=>e.reopened&&e.bodyEqual&&e.textEqual&&e.tableContentEqual&&e.controlKindsEqual&&e.contentLoss.count===0)&&report.editedExports.every(e=>e.selectedCellTextEqual&&e.contentLoss.count===0)&&report.undoContentEqual!==false?'PASS_CONTENT_ONLY':'REVIEW_REQUIRED';
 }catch(e){report.status='FAIL';report.error=String(e);}finally{doc?.free();}
 reports.push(report);console.log(JSON.stringify({id:report.id,status:report.status,losses:report.exports.map(e=>({format:e.format,count:e.contentLoss?.count})),edited:report.editedExports.length,undo:report.undoContentEqual,error:report.error}));
}
await writeFile(join(evidence,'public-corpus-report.json'),JSON.stringify({run:'2026-10-11-autonomous',engineWasmSha256:hash(await readFile(join(root,'apps/editor/node_modules/@rhwp/core/rhwp_bg.wasm'))),scope:'Same-engine content/structure round trip; not an independent Hangul layout/render/compatibility verdict. Public source files and generated derivatives excluded from Git.',reports},null,2));