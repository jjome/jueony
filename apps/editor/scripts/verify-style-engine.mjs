import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'docs/evidence/style-management-2026-10-13/engine');
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});await mkdir(out,{recursive:true});
const parse=v=>typeof v==='string'?JSON.parse(v):v,results=[],failures=[];
const python=process.env.JUEONY_TEST_PYTHON??'C:/Python314/python.exe',fixture=resolve(repo,'apps/editor/scripts/style-reference-fixture.py');
for(const format of ['hwp','hwpx']) {
  const name=`${format}: delete remaps nested-cell and body style IDs before serializer roundtrip`;let source,doc,reopened;
  try{
    source=HwpDocument.createEmpty();source.createBlankDocument();source.insertText(0,0,0,'본문 유지됨');
    const removed=source.createStyle(JSON.stringify({name:'삭제 대상'})),kept=source.createStyle(JSON.stringify({name:'유지 스타일'}));
    const table=parse(source.createTable(0,0,7,2,2));source.insertTextInCell(0,table.paraIdx,table.controlIdx,0,0,0,'셀 삭제됨');source.insertTextInCell(0,table.paraIdx,table.controlIdx,1,0,0,'셀 유지됨');
    const base=resolve(out,'base.hwpx'),nested=resolve(out,'nested.hwpx');await writeFile(base,source.exportHwpx());
    execFileSync(python,[fixture,'prepare',base,nested,String(removed),String(kept)],{windowsHide:true});
    doc=new HwpDocument(await readFile(nested));const bodyBefore=doc.getTextFileUnicode();assert.equal(doc.deleteStyle(removed),true);
    assert.equal(doc.getTextFileUnicode(),bodyBefore);assert.equal(parse(doc.getStyleList()).find(s=>s.name==='유지 스타일').id,kept-1);
    const saved=doc[format==='hwp'?'exportHwp':'exportHwpx'](),path=resolve(out,`style-deleted-nested.${format}`);await writeFile(path,saved);reopened=new HwpDocument(saved);
    const inspection=resolve(out,`inspection-${format}.hwpx`);await writeFile(inspection,reopened.exportHwpx());
    const rows=JSON.parse(execFileSync(python,[fixture,'inspect',inspection],{encoding:'utf8',windowsHide:true}));
    assert.ok(rows.filter(r=>r.text.includes('삭제됨')).length>=2);assert.ok(rows.filter(r=>r.text.includes('유지됨')).length>=3);
    for(const row of rows)assert.equal(row.styleId,row.text.includes('삭제됨')?0:kept-1,JSON.stringify(row));
    assert.equal(reopened.getTextFileUnicode(),bodyBefore);results.push(name);console.log('PASS',name);
  }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{reopened?.free();doc?.free();source?.free();}
}
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),note:'Synthetic nested HWPX fixture; independent XML inspection of saved style references. No native Hancom comparison.'},null,2));if(failures.length)process.exitCode=1;
