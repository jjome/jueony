import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(resolve(process.cwd(),'apps/editor/package.json'));
if(!process.env.JUEONY_MARKED_PACKAGE)throw new Error('Set JUEONY_MARKED_PACKAGE to the installed marked ESM entry file. No download is performed.');
const {marked}=await import(pathToFileURL(resolve(process.env.JUEONY_MARKED_PACKAGE)).href);
const {default:puppeteer}=await import(pathToFileURL(require.resolve('puppeteer-core')).href);
const root=process.cwd(), out=resolve(process.env.JUEONY_FEATURE_PREVIEW_OUTPUT??resolve(root,'build/feature-doc-preview')), evidence=resolve(process.env.JUEONY_FEATURE_EVIDENCE_OUTPUT??resolve(root,'docs/evidence/feature-docs-2026-10-16'));
await mkdir(out,{recursive:true});await mkdir(evidence,{recursive:true});
const index=JSON.parse(await readFile('docs/features/index.json','utf8'));
const files=['docs/jueony-progress.md',...index.groups.map(g=>'docs/features/'+g.file)];
const old=execFileSync('git',['show','c09d579:docs/jueony-progress.md'],{encoding:'utf8'});
assert.equal(marked.lexer(old).filter(t=>t.type==='table').length,1,'Prior malformed feature overview is not a GFM table');
const results=[];
for(const file of files){
 const md=await readFile(file,'utf8'), tables=marked.lexer(md).filter(t=>t.type==='table');
 const expected=file.endsWith('jueony-progress.md')?index.groups.length+2:undefined;
 if(expected)assert.equal(tables.length,expected);else{
  const rowIds=tables.flatMap(t=>t.rows).flatMap(r=>r.slice(0,1)).flatMap(c=>[...c.text.matchAll(/\[([A-Z]\d+)\]/g)].map(m=>m[1]));
  const group=index.groups.find(g=>file.endsWith(g.file));assert.deepEqual([...rowIds].sort(),[...group.ids].sort());
  assert.ok(tables.slice(1).every(t=>t.header.length===5&&t.rows.length<=8));
 }
 const html=marked.parse(md), preview=resolve(out,basename(file,'.md')+'.html');
 await writeFile(preview,'<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{font:15px/1.6 "Malgun Gothic",sans-serif;color:#182c3b;max-width:1040px;margin:30px auto;padding:0 22px}table{border-collapse:collapse;width:100%;margin:12px 0 24px;table-layout:auto}th,td{border:1px solid #d4dde7;padding:9px 12px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eff4f9}h3{padding-top:14px}a{color:#12649e}details{border-bottom:1px solid #dde5ee;padding:8px 0}summary{cursor:pointer}table td:nth-child(n+3){min-width:68px}</style>'+html);
 results.push({file,sha256:createHash('sha256').update(md).digest('hex'),tableCount:tables.length,headerColumns:tables.map(t=>t.header.length),bodyRows:tables.map(t=>t.rows.length),preview});
}
const browser=await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run','--disable-background-networking'],defaultViewport:{width:1100,height:850}});
const page=await browser.newPage();
try{
 for(const result of results){await page.goto(pathToFileURL(result.preview).href);const counts=await page.evaluate(()=>[...document.querySelectorAll('table')].map(t=>({columns:t.querySelectorAll('thead th').length,rows:t.querySelectorAll('tbody tr').length,consistent:[...t.querySelectorAll('tbody tr')].every(r=>r.cells.length===t.querySelectorAll('thead th').length)})));assert.deepEqual(counts.map(c=>c.columns),result.headerColumns);assert.ok(counts.every(c=>c.consistent));result.browserTables=counts;delete result.preview;}
 await page.goto(pathToFileURL(resolve(out,'jueony-progress.html')).href);await page.screenshot({path:resolve(evidence,'overview-dashboard.png'),fullPage:false});
 await page.goto(pathToFileURL(resolve(out,'jueony-progress.html')).href+'#feature-tables');await page.screenshot({path:resolve(evidence,'overview-table.png')});
 await page.goto(pathToFileURL(resolve(out,'08-tables.html')).href+'#work-10');await page.screenshot({path:resolve(evidence,'table-functions.png')});
 for(const width of [620,1100]){await page.setViewport({width,height:850});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'Table preview overflow at '+width);}
}finally{await browser.close();}
await writeFile(resolve(evidence,'table-rendering.json'),JSON.stringify({sourceCommitBefore:'c09d579',parser:'bundled marked GFM',browser:'headless Microsoft Edge',priorOverviewRecognizedTables:1,overviewRecognizedTables:index.groups.length+2,documents:results.length,rowIdsPreserved:index.rowCount,smallWorkTableLimit:8,viewportWidths:[620,1100],results},null,2));
console.log(JSON.stringify({documents:results.length,tables:results.reduce((n,r)=>n+r.tableCount,0),rowIds:index.rowCount,passed:true}));
