import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import init,{HwpDocument} from '@rhwp/core';
import {readStructure} from '../src/document-control/structure.ts';
import {executeDocumentOperations} from '../src/document-control/execute.ts';
const root=resolve('../..'),out=resolve(root,'docs/evidence/continuation-2026-10-11/agent/preflight'),origin='http://127.0.0.1:4208';
await mkdir(out,{recursive:true});
if(await fetch(origin).then(()=>true,()=>false))throw new Error('Test port 4208 occupied; existing process kept');
await init({module_or_path:await readFile('node_modules/@rhwp/core/rhwp_bg.wasm')});
const body=doc=>Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>doc.getTextRange(s,p,0,doc.getParagraphLength(s,p)))).flat();
const snap=doc=>({revision:'fixture',name:'fixture.hwpx',limitations:[],structure:readStructure(doc),nodes:Array.from({length:doc.getSectionCount()},(_,s)=>Array.from({length:doc.getParagraphCount(s)},(_,p)=>({id:`s${s}p${p}`,section:s,paragraph:p,text:doc.getTextRange(s,p,0,doc.getParagraphLength(s,p)),editable:true}))).flat()});
const fixture=()=>{const doc=HwpDocument.createEmpty();doc.createBlankDocument();for(const [i,text] of ['업무 계획','추진 일정','후속 조치'].entries()){if(i)doc.splitParagraph(0,i-1,doc.getParagraphLength(0,i-1));doc.insertText(0,i,0,text);}return doc;};
const differ=(a,b,path='',out=[])=>{if(out.length>=40)return out;if(JSON.stringify(a)===JSON.stringify(b))return out;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differ(a[k],b[k],path+'/'+k,out);}else out.push({path,before:a,after:b});return out;};
const cases=[
 {id:'create-empty-document',empty:true,ops:[{kind:'create_document',paragraphs:['새 초안','본문']}],check:s=>{assert.deepEqual(s.nodes.map(n=>n.text),['새 초안','본문']);}},
 {id:'character-format',ops:[{kind:'format_characters',target:'s0p0',properties:{bold:true,italic:true,fontSizePt:16,fontFamily:'맑은 고딕',color:'#336699',ratioPercent:90,spacingPercent:-3}}],check:s=>{assert.equal(s.structure.paragraphs[0].characters.bold,true);assert.equal(s.structure.paragraphs[0].characters.fontSize,1600);}},
 {id:'paragraph-format',ops:[{kind:'format_paragraph',target:'s0p1',properties:{alignment:'center',beforeMm:2,afterMm:3,lineSpacingPercent:180,keepWithNext:true}}],check:s=>{assert.equal(s.structure.paragraphs[1].paragraph.alignment,'center');}},
 {id:'table-cell-style',ops:[{kind:'create_table',after:'s0p1',resultId:'t',rows:[['항목','일정'],['준비','1월']]},{kind:'format_table_cells',target:'@t',startRow:0,rowCount:1,startColumn:0,columnCount:2,properties:{bold:true,background:'#eeeeee'}},{kind:'set_table_cell',target:'@t',row:1,column:1,originalText:'1월',text:'2월'}],check:s=>{assert.deepEqual(s.structure.tables[0].cells.map(c=>c.text),['항목','일정','준비','2월']);assert.equal(s.structure.tables[0].cells[0].characters.bold,true);}},
 {id:'table-axis-batch',ops:[{kind:'create_table',after:'s0p0',resultId:'t',rows:[['A','B'],['C','D']]},{kind:'set_table_cell',target:'@t',row:0,column:0,originalText:'A',text:'AA'},{kind:'insert_table_row',target:'@t',index:1,values:['X','Y']},{kind:'insert_table_column',target:'@t',index:1,values:['H','I','J']},{kind:'delete_table_row',target:'@t',index:2},{kind:'delete_table_column',target:'@t',index:2}],check:s=>{assert.deepEqual(s.structure.tables[0].cells.map(c=>c.text),['AA','H','X','I']);}},
 {id:'page-setup',ops:[{kind:'set_page_setup',section:0,properties:{widthMm:210,heightMm:297,landscape:true,marginLeftMm:20,marginRightMm:20,marginTopMm:20,marginBottomMm:20}}],check:s=>{assert.equal(s.structure.sections[0].page.landscape,true);}},
 {id:'mixed-controls',ops:[{kind:'create_table',after:'s0p1',resultId:'schedule',rows:[['단계','기간','담당'],['준비','1월','총무'],['실행','2월','사업'],['점검','3월','감사']]},{kind:'format_table_cells',target:'@schedule',startRow:0,rowCount:1,startColumn:0,columnCount:3,properties:{bold:true,background:'#eeeeee'}},{kind:'format_characters',target:'s0p0',properties:{bold:true,fontSizePt:16}},{kind:'format_paragraph',target:'s0p2',properties:{alignment:'center',beforeMm:2}},{kind:'set_page_setup',section:0,properties:{landscape:true,marginLeftMm:20,marginRightMm:20}}],check:s=>{assert.equal(s.structure.tables[0].rows,4);assert.equal(s.structure.sections[0].page.landscape,true);assert.equal(s.nodes.at(-1).text,'후속 조치');}},
];
const server=spawn(process.execPath,['apps/launcher/server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,JUEONY_PORT:'4208',JUEONY_DIST:resolve('evidence/dist-continuation'),JUEONY_CONNECTION_STORE:'memory'},stdio:'ignore'});
let browser,page;const results=[],errors=[],external=[];
try{
 for(let i=0;i<100;i++){if(await fetch(origin+'/api/health').then(r=>r.ok,()=>false))break;await new Promise(r=>setTimeout(r,100));}
 browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1440,height:1000}});
 page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(r.url());});
 await page.goto(origin+'/editor.html?storage=download&skipRecovery=1');await page.waitForFunction(()=>window.jueonyEditor?.snapshot&&!window.jueonyEditor.busy(),{timeout:90000});
 const build=await fetch(origin+'/build-evidence.json').then(r=>r.json());
 for(const format of ['hwp','hwpx'])for(const c of cases){
  const doc=c.empty?HwpDocument.createEmpty():fixture();if(c.empty)doc.createBlankDocument();let bytes;try{bytes=format==='hwp'?doc.exportHwp():doc.exportHwpx();}finally{doc.free();}
  const result={id:c.id,format,status:'FAIL'};
  try{
   await page.evaluate(({bytes,name})=>window.jueonyEditor.open(new Uint8Array(bytes),name),{bytes:[...bytes],name:`${c.id}.${format}`});
   const before=await page.evaluate(()=>window.jueonyEditor.snapshot());
   const applied=await page.evaluate(async operations=>{const a=window.jueonyEditor,b=a.snapshot();try{return {receipt:await a.apply(crypto.randomUUID(),b,{message:'합성 검수',sourceIds:[],operations}),snapshot:a.snapshot()};}catch(e){return {error:e instanceof Error?e.message:String(e),errorName:e?.name??'ThrownValue',before:b,snapshot:a.snapshot()};}},c.ops);
   if(applied.error){result.error=applied.error;result.errorName=applied.errorName;result.unchanged=JSON.stringify(before.nodes)===JSON.stringify(applied.snapshot.nodes)&&JSON.stringify(before.structure)===JSON.stringify(applied.snapshot.structure)&&before.revision===applied.snapshot.revision;
    const native=new HwpDocument(bytes);try{const base=snap(native);executeDocumentOperations(native,base,c.ops);const round=new HwpDocument(format==='hwp'?native.exportHwp():native.exportHwpx());try{result.nativeStructureDiff=differ(readStructure(native),readStructure(round));result.nativeTextEqual=JSON.stringify(body(native))===JSON.stringify(body(round));}finally{round.free();}}finally{native.free();}
    throw new Error(applied.error);
   }
   try{c.check(applied.snapshot);}catch(e){result.appliedSnapshot=applied.snapshot;throw e;}result.apply=true;
   const exported=new Uint8Array(await page.evaluate(()=>[...window.jueonyEditor.recovery().bytes]));await writeFile(resolve(out,`${c.id}.${format}`),exported);
   const reopened=new HwpDocument(exported);try{const rs=snap(reopened);c.check(rs);result.savedStructureDiff=differ(applied.snapshot.structure,rs.structure);assert.deepEqual(rs.structure,applied.snapshot.structure);result.structurePreserved=true;result.reopened=true;result.bodyPreserved=JSON.stringify(body(reopened))===JSON.stringify(applied.snapshot.nodes.map(n=>n.text));}finally{reopened.free();}
   await page.evaluate(receipt=>window.jueonyEditor.undoRequest(receipt),applied.receipt);const undone=await page.evaluate(()=>window.jueonyEditor.snapshot());
   assert.deepEqual(undone.nodes.map(n=>n.text),before.nodes.map(n=>n.text));assert.deepEqual(undone.structure,before.structure);result.undo=true;result.status='PASS';
  }catch(e){result.error??=String(e);}results.push(result);console.log(result.status,c.id,format,result.error??'');
 }
 const publicBytes=await readFile(resolve(root,'.tools/public-documents/notes.hwpx'));assert.equal(createHash('sha256').update(publicBytes).digest('hex'),'e353969fefeebb041d51549f5019a0df23a99bab89b18f10bf937274418bfa21');
 await page.evaluate(bytes=>window.jueonyEditor.open(new Uint8Array(bytes),'public-notes.hwpx'),[...publicBytes]);
 const publicResult=await page.evaluate(async()=>{const a=window.jueonyEditor,b=a.snapshot();try{await a.preflight(b,{message:'공개 표본 원형 보존 검수',sourceIds:[],operations:[]});return {status:'PASS',before:b,snapshot:a.snapshot()};}catch(e){return {status:'FAIL',error:e instanceof Error?e.message:String(e),before:b,snapshot:a.snapshot()};}});
 results.push({id:'public-notes-hwpx-preflight',format:'hwpx',status:publicResult.status,error:publicResult.error,unchanged:JSON.stringify(publicResult.before)===JSON.stringify(publicResult.snapshot),sourceSha256:createHash('sha256').update(publicBytes).digest('hex')});console.log(publicResult.status,'public-notes-hwpx-preflight',publicResult.error??'');
 await writeFile(resolve(out,'result.json'),JSON.stringify({build,results,errors,external,note:'Actual installed editor bridge applies synthetic commands only; original public notes read-only. Hancom independent rendering remains pending.'},null,2));
 if(results.some(r=>r.status!=='PASS')||errors.length||external.length)process.exitCode=1;
 console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,total:results.length,errors,external}));
}catch(e){console.error(e);process.exitCode=1;await writeFile(resolve(out,'fatal.json'),JSON.stringify({error:String(e),results,errors,external},null,2));}finally{await browser?.close();server.kill();}
