import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readPageBorderSettings,writePageBorderSettings} from '../src/adapters/rhwp/page-border-settings.ts';
import {defaultPageGradient} from '../src/modules/document/public/index.ts';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
if(!process.env.JUEONY_ENGINE_PACKAGE)throw new Error('JUEONY_ENGINE_PACKAGE is required');
const pkg=resolve(repo,process.env.JUEONY_ENGINE_PACKAGE),out=resolve(repo,process.env.JUEONY_TEST_OUTPUT??'docs/evidence/page-border-2026-10-13/engine');
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});await mkdir(out,{recursive:true});
const parse=value=>typeof value==='string'?JSON.parse(value):value,results=[],failures=[];
if(typeof HwpDocument.prototype.getPageBorderFillEntry!=='function'||typeof HwpDocument.prototype.setPageBorderFillEntry!=='function')throw new Error('Native page entry capability is absent');
for(const format of ['hwp','hwpx'])for(const kind of ['both','even','odd'])for(const application of ['all','exceptFirst','firstOnly']){
 const name=`${format}: ${kind} ${application} two-color gradient + header/footer inclusion`;let doc,reopened;
 try{
  doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'쪽 배경 검증 본문');
  const original=doc.exportHwpx(),base=readPageBorderSettings(doc,0,kind);
  const next={...base,kind,applyPage:application,hideBorder:application==='exceptFirst',hideFill:application==='exceptFirst',basis:'page',headerInside:true,footerInside:true,
   fillType:'gradient',gradient:{...defaultPageGradient(),angle:45,centerX:40,centerY:60,colors:['#112233','#aabbcc']},borderTop:{type:1,width:3,color:'#234567'}};
  writePageBorderSettings(doc,0,kind,next);const edited=doc.exportHwpx();assert.notDeepEqual(edited,original);
  if(kind!=='both'){assert.equal(readPageBorderSettings(doc,0,'both').fillType,base.fillType);assert.equal(readPageBorderSettings(doc,0,kind==='odd'?'even':'odd').fillType,base.fillType);}
  const before=parse(doc.getPageBorderFillEntry(0,kind));assert.equal(before.applyPage,application);assert.equal(before.fillType,'gradient');assert.deepEqual(before.gradient.colors,next.gradient.colors);
  const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`${kind}-${application}.${format}`),bytes);reopened=new HwpDocument(bytes);
  const got=readPageBorderSettings(reopened,0,kind);for(const key of ['applyPage','basis','headerInside','footerInside','fillType'])assert.equal(got[key],next[key],key);
  for(const key of ['type','angle','centerX','centerY','blur','stepCenter'])assert.equal(got.gradient[key],next.gradient[key],key);
  assert.deepEqual(got.gradient.colors,next.gradient.colors);assert.equal(got.borderTop.type,1);assert.equal(got.borderTop.width,3);assert.equal(got.borderTop.color,'#234567');assert.equal(reopened.getTextFileUnicode(),doc.getTextFileUnicode());
  const xmlPath=resolve(out,`inspection-${kind}-${application}-${format}.hwpx`);await writeFile(xmlPath,reopened.exportHwpx());
  const xml=JSON.parse(execFileSync(process.env.JUEONY_TEST_PYTHON??'C:/Python314/python.exe',[resolve(repo,'apps/editor/scripts/page-border-inspect.py'),xmlPath],{encoding:'utf8',windowsHide:true}));
  const entry=xml.entries.find(entry=>entry.type===kind.toUpperCase());assert.ok(entry,'serialized entry exists');assert.equal(entry.headerInside,'1');assert.equal(entry.footerInside,'1');assert.equal(entry.textBorder,'PAPER');
  const fill=xml.fills.find(fill=>fill.id===entry.id);assert.equal(fill.gradient.type,'LINEAR');assert.equal(fill.gradient.angle,'45');assert.deepEqual(fill.colors.map(color=>color.toLowerCase()),['#112233','#aabbcc']);
  // Existing OWPML writer/parser uses HIDE_ALL for the section hide flags.
  // First-page display behavior is asserted separately against rendered SVG.
  assert.equal(xml.visibility.border,application==='firstOnly'?'SHOW_FIRST':application==='exceptFirst'?'HIDE_ALL':'SHOW_ALL');assert.equal(xml.visibility.fill,xml.visibility.border);
  results.push(name);console.log('PASS',name);
 }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{reopened?.free();doc?.free();}
}
for(const format of ['hwp','hwpx'])for(const type of [1,2,3,4]){
 const name=`${format}: gradient type${type} roundtrip preserves shared cell fill and other page entries`;let doc,reopened;
 try{
  doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'공유 배경 유지');
  const table=parse(doc.createTable(0,0,7,1,1)),cellBefore=parse(doc.getCellProperties(0,table.paraIdx,table.controlIdx,0));
  const base=readPageBorderSettings(doc,0,'odd'),both=readPageBorderSettings(doc,0,'both');
  writePageBorderSettings(doc,0,'odd',{...base,fillType:'gradient',gradient:{...defaultPageGradient(),type,colors:['#123456','#abcdef']}});
  assert.deepEqual(parse(doc.getCellProperties(0,table.paraIdx,table.controlIdx,0)),cellBefore,'shared cell fill must remain unchanged');assert.equal(readPageBorderSettings(doc,0,'both').fillType,both.fillType);
  const svg=doc.renderPageSvg(0).toLowerCase();assert.ok(svg.includes('#123456')&&svg.includes('#abcdef'),'live gradient must render without reload');assert.ok(svg.includes(type===2?'radialgradient':'lineargradient'));
  const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`gradient-type${type}.${format}`),bytes);reopened=new HwpDocument(bytes);
  assert.equal(readPageBorderSettings(reopened,0,'odd').gradient.type,type);assert.equal(readPageBorderSettings(reopened,0,'both').fillType,both.fillType);
  const after=parse(reopened.getCellProperties(0,table.paraIdx,table.controlIdx,0));for(const key of ['fillType','fillColor','patternColor','patternType'])assert.equal(after[key],cellBefore[key],key);
  results.push(name);console.log('PASS',name);
 }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{reopened?.free();doc?.free();}
}
for(const format of ['hwp','hwpx']){
 const name=`${format}: same background keeps distinct hatch patterns without mutating previous fill`;let doc,reopened;
 try{
  doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'배경 무늬 식별 검증');
  const both=readPageBorderSettings(doc,0,'both');writePageBorderSettings(doc,0,'both',{...both,fillType:'solid',fillColor:'#ffeedd',patternColor:'#123456',patternType:0});
  for(const [kind,patternType]of[['even',1],['odd',2]])writePageBorderSettings(doc,0,kind,{...readPageBorderSettings(doc,0,kind),fillType:'solid',fillColor:'#ffeedd',patternColor:'#123456',patternType});
  assert.equal(readPageBorderSettings(doc,0,'both').patternType,0);assert.equal(readPageBorderSettings(doc,0,'even').patternType,1);assert.equal(readPageBorderSettings(doc,0,'odd').patternType,2);
  const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`distinct-hatch.${format}`),bytes);reopened=new HwpDocument(bytes);
  for(const [kind,patternType]of[['even',1],['odd',2]]){const value=readPageBorderSettings(reopened,0,kind);assert.equal(value.patternType,patternType);assert.equal(value.fillColor,'#ffeedd');assert.equal(value.patternColor,'#123456');}
  assert.ok(readPageBorderSettings(reopened,0,'both').patternType<=0);assert.equal(reopened.getTextFileUnicode(),doc.getTextFileUnicode());
  results.push(name);console.log('PASS',name);
 }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{reopened?.free();doc?.free();}
}
for(const application of ['all','exceptFirst','firstOnly']){
 const name=`three-page SVG selects page parity and ${application} section scope`;let doc;
 try{
  doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'첫 쪽');const second=parse(doc.insertPageBreak(0,0,3));doc.insertText(0,second.paraIdx,0,'두 번째 쪽');const third=parse(doc.insertPageBreak(0,second.paraIdx,6));doc.insertText(0,third.paraIdx,0,'세 번째 쪽');
  assert.equal(parse(doc.getDocumentInfo()).pageCount,3);
  const both=readPageBorderSettings(doc,0,'both');writePageBorderSettings(doc,0,'both',{...both,applyPage:application,fillType:'solid',fillColor:'#00ff00',patternType:-1});
  for(const [kind,color,spacing]of[['even','#224466',1000],['odd','#884422',2000]]){const base=readPageBorderSettings(doc,0,kind);writePageBorderSettings(doc,0,kind,{...base,fillType:'solid',fillColor:color,patternType:-1,basis:'paper',spacingLeft:spacing});}
  const first=doc.renderPageSvg(0).toLowerCase(),even=doc.renderPageSvg(1).toLowerCase(),odd=doc.renderPageSvg(2).toLowerCase();
  assert.equal(first.includes('#884422'),application!=='exceptFirst');assert.equal(even.includes('#224466'),application!=='firstOnly');assert.equal(odd.includes('#884422'),application!=='firstOnly');
  assert.notEqual(parse(doc.getPageInfo(0)).pageBorderLeft,parse(doc.getPageInfo(1)).pageBorderLeft,'geometry uses the same parity entry as drawing');
  for(let i=0;i<3;i++)await writeFile(resolve(out,`parity-${application}-${i+1}.svg`),doc.renderPageSvg(i));results.push(name);console.log('PASS',name);
 }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{doc?.free();}
}
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),note:'Real WASM and independent saved XML; native Hancom visual comparison is pending.'},null,2));if(failures.length)process.exitCode=1;
