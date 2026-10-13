import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readPageBorderSettings,writePageBorderSettings,planPageBorderEdits,executePageBorderEdits,executeNewSectionBorder} from '../src/adapters/rhwp/page-border-settings.ts';
import {defaultPageGradient} from '../src/modules/document/public/index.ts';
import {preflightDocumentEdit} from '../src/adapters/rhwp/edit-preflight.ts';
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
const borderY=(doc,color)=>{const line=doc.renderPageSvg(0).match(new RegExp(`<line\\b[^>]*stroke="${color}"[^>]*>`,'i'))?.[0];assert.ok(line,'Expected rendered page border');return Number(line.match(/y1="([^"]+)"/)[1]);};
for(const format of ['hwp','hwpx']){
 const newName=`${format}: new-section scope splits scalar body position and applies only the new section`;let newDoc;
 try{
  newDoc=HwpDocument.createEmpty();newDoc.createBlankDocument();newDoc.insertText(0,0,0,'앞😀뒤');const before=readPageBorderSettings(newDoc,0),drafts=new Map([['both',{...before,fillType:'solid',fillColor:'#cceeff',patternType:-1}]]),position={sectionIndex:0,paragraphIndex:0,charOffset:2};
  preflightDocumentEdit({fileName:'new-scope.'+format,borrowDocumentHandle:()=>newDoc,getWasmModuleExports:()=>({HwpDocument})},scratch=>executeNewSectionBorder(scratch,position,drafts));const caret=executeNewSectionBorder(newDoc,position,drafts);assert.equal(caret.sectionIndex,1);assert.equal(newDoc.getSectionCount(),2);assert.equal(readPageBorderSettings(newDoc,0).fillType,before.fillType);assert.equal(readPageBorderSettings(newDoc,1).fillColor,'#cceeff');
  assert.equal(newDoc.getTextRange(0,0,0,newDoc.getParagraphLength(0,0)),'앞😀');assert.equal(newDoc.getTextRange(1,0,0,newDoc.getParagraphLength(1,0)),'뒤');
  const bytes=newDoc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`new-section-border.${format}`),bytes);const loaded=new HwpDocument(bytes);try{assert.equal(loaded.getSectionCount(),2);assert.equal(readPageBorderSettings(loaded,1).fillColor,'#cceeff');}finally{loaded.free();}results.push(newName);console.log('PASS',newName);
 }catch(error){failures.push({name:newName,error:String(error),stack:error.stack});console.error('FAIL',newName,error);}finally{newDoc?.free();}
 const name=`${format}: inclusion flags move real SVG borders by unequal story bands and survive guarded save`;let doc;
 try{
  doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'머리말·꼬리말 포함 검수');doc.setPageDef(0,JSON.stringify({marginTop:5000,marginHeader:3000,marginBottom:6000,marginFooter:2000}));
  const base={...readPageBorderSettings(doc,0),basis:'page',spacingTop:0,spacingBottom:0,borderTop:{type:1,width:0,color:'#13579b'},borderBottom:{type:1,width:0,color:'#2468ac'}};
  writePageBorderSettings(doc,0,'both',{...base,headerInside:false,footerInside:false});const top=borderY(doc,'#13579b'),bottom=borderY(doc,'#2468ac');
  for(const headerInside of [false,true])for(const footerInside of [false,true]){
   writePageBorderSettings(doc,0,'both',{...base,headerInside,footerInside});assert.ok(Math.abs(borderY(doc,'#13579b')-top+(headerInside?40:0))<0.01);assert.ok(Math.abs(borderY(doc,'#2468ac')-bottom-(footerInside?80:0))<0.01);
   const info=parse(doc.getPageInfo(0));assert.ok(Math.abs(info.pageBorderTop-borderY(doc,'#13579b'))<0.1);assert.ok(Math.abs(info.height-info.pageBorderBottom-borderY(doc,'#2468ac'))<0.2);
   preflightDocumentEdit({fileName:'inclusion.'+format,borrowDocumentHandle:()=>doc,getWasmModuleExports:()=>({HwpDocument})},()=>{});
   const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`inclusion-${Number(headerInside)}${Number(footerInside)}.${format}`),bytes);const loaded=new HwpDocument(bytes);
   try{assert.ok(Math.abs(borderY(loaded,'#13579b')-borderY(doc,'#13579b'))<0.01);assert.ok(Math.abs(borderY(loaded,'#2468ac')-borderY(doc,'#2468ac'))<0.01);}finally{loaded.free();}
  }
  results.push(name);console.log('PASS',name);
 }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{doc?.free();}
 const scopeName=`${format}: whole-document scope copies current parity settings without changing section paper or text`;doc=undefined;
 try{
  doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'앞뒤');doc.insertSectionBreak(0,0,1);doc.setPageDef(1,JSON.stringify({marginLeft:5000}));
  const originalText=doc.getTextFileUnicode(),papers=[0,1].map(s=>doc.getPageDef(s));
  writePageBorderSettings(doc,0,'odd',{...readPageBorderSettings(doc,0,'odd'),fillType:'solid',fillColor:'#123456',patternType:-1});
  writePageBorderSettings(doc,1,'both',{...readPageBorderSettings(doc,1),fillType:'solid',fillColor:'#abcdef',patternType:-1});
  const drafts=new Map([['odd',{...readPageBorderSettings(doc,0,'odd'),headerInside:true,basis:'page'}]]),edits=planPageBorderEdits(doc,0,drafts,'document');
  preflightDocumentEdit({fileName:'scope.'+format,borrowDocumentHandle:()=>doc,getWasmModuleExports:()=>({HwpDocument})},scratch=>executePageBorderEdits(scratch,planPageBorderEdits(scratch,0,drafts,'document')));executePageBorderEdits(doc,edits);
  for(const section of [0,1]){assert.equal(readPageBorderSettings(doc,section,'odd').fillColor,'#123456');assert.equal(readPageBorderSettings(doc,section,'odd').headerInside,true);assert.equal(readPageBorderSettings(doc,section,'even').fillType,'none');assert.equal(doc.getPageDef(section),papers[section]);}assert.equal(doc.getTextFileUnicode(),originalText);
  const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`all-section-border.${format}`),bytes);const loaded=new HwpDocument(bytes);try{assert.equal(loaded.getSectionCount(),2);assert.equal(readPageBorderSettings(loaded,1,'odd').headerInside,true);assert.equal(loaded.getTextFileUnicode(),originalText);}finally{loaded.free();}
  results.push(scopeName);console.log('PASS',scopeName);
 }catch(error){failures.push({name:scopeName,error:String(error),stack:error.stack});console.error('FAIL',scopeName,error);}finally{doc?.free();}
}
{const name='paper-based border ignores inactive inclusion flags; inclusion capability is explicit';let doc;try{doc=HwpDocument.createEmpty();doc.createBlankDocument();assert.equal(doc.pageBorderInclusionEnabled(),true);const base={...readPageBorderSettings(doc,0),basis:'paper',borderTop:{type:1,width:0,color:'#13579b'}};writePageBorderSettings(doc,0,'both',{...base,headerInside:false,footerInside:false});const before=borderY(doc,'#13579b');writePageBorderSettings(doc,0,'both',{...base,headerInside:true,footerInside:true});assert.equal(borderY(doc,'#13579b'),before);results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{doc?.free();}}
const svgBox=(svg,color)=>{const rect=svg.match(new RegExp(`<rect\\b[^>]*fill="${color}"[^>]*>`,'i'))?.[0];assert.ok(rect,'Expected scoped background rectangle');return Object.fromEntries(['x','y','width','height'].map(key=>[key,Number(rect.match(new RegExp(`\\b${key}="([^"]+)"`))[1])]));};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.2,`${actual} != ${expected}`);
if(typeof HwpDocument.prototype.pageBorderFillAreaEnabled==='function'){
 for(const format of ['hwp','hwpx'])for(const basis of ['paper','page'])for(const fillArea of ['paper','page','border']){
  const name=`${format}: ${basis} basis / ${fillArea} fill renders its actual area and survives guarded save`;let doc,loaded;
  try{
   doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'배경 범위 😀 검수');doc.setPageDef(0,JSON.stringify({marginLeft:3000,marginRight:4000,marginTop:5000,marginHeader:3000,marginBottom:6000,marginFooter:2000}));
   const border={type:1,width:0,color:'#13579b'},base={...readPageBorderSettings(doc,0),basis,fillArea,fillType:'solid',fillColor:'#bedace',patternType:-1,headerInside:true,footerInside:true,spacingLeft:1200,spacingRight:1800,spacingTop:900,spacingBottom:1500,borderLeft:border,borderRight:border,borderTop:border,borderBottom:border};
   writePageBorderSettings(doc,0,'both',base);assert.equal(doc.pageBorderFillAreaEnabled(),true);const info=parse(doc.getPageInfo(0)),svg=doc.renderPageSvg(0),box=svgBox(svg,'#bedace');
   if(fillArea==='paper'){near(box.x,0);near(box.y,0);near(box.width,info.width);near(box.height,info.height);}
   else if(fillArea==='page'){near(box.x,40);near(box.y,8000/75);near(box.width,info.width-7000/75);near(box.height,info.height-16000/75);}
   else{near(box.x,info.pageBorderLeft);near(box.y,info.pageBorderTop);near(box.width,info.width-info.pageBorderLeft-info.pageBorderRight);near(box.height,info.height-info.pageBorderTop-info.pageBorderBottom);assert.ok(box.width<info.width);const lines=[...svg.matchAll(/<line\b[^>]*stroke="#13579b"[^>]*>/gi)].map(v=>v[0]);assert.equal(lines.length,4);for(const line of lines)for(const key of ['x1','x2','y1','y2']){const value=Number(line.match(new RegExp(`\\b${key}="([^"]+)"`))[1]);assert.ok(Math.min(Math.abs(value-(key[0]==='x'?box.x:box.y)),Math.abs(value-(key[0]==='x'?box.x+box.width:box.y+box.height)))<0.2);}}
   preflightDocumentEdit({fileName:'fill-area.'+format,borrowDocumentHandle:()=>doc,getWasmModuleExports:()=>({HwpDocument})},()=>{});const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`fill-area-${basis}-${fillArea}.${format}`),bytes);await writeFile(resolve(out,`fill-area-${basis}-${fillArea}-${format}.svg`),svg);loaded=new HwpDocument(bytes);assert.deepEqual(svgBox(loaded.renderPageSvg(0),'#bedace'),box);assert.equal(readPageBorderSettings(loaded,0).fillArea,fillArea);assert.equal(loaded.getTextFileUnicode(),doc.getTextFileUnicode());
   const xmlPath=resolve(out,`inspection-fill-area-${basis}-${fillArea}-${format}.hwpx`);await writeFile(xmlPath,loaded.exportHwpx());const xml=JSON.parse(execFileSync(process.env.JUEONY_TEST_PYTHON??'C:/Python314/python.exe',[resolve(repo,'apps/editor/scripts/page-border-inspect.py'),xmlPath],{encoding:'utf8',windowsHide:true}));assert.equal(xml.entries.find(e=>e.type==='BOTH').fillArea,fillArea.toUpperCase());results.push(name);console.log('PASS',name);
  }catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{loaded?.free();doc?.free();}
 }
 for(const format of ['hwp','hwpx']){
  const name=`${format}: border-region gradient uses the same scoped rectangle as solid fill`;let doc,loaded;
  try{doc=HwpDocument.createEmpty();doc.createBlankDocument();const base={...readPageBorderSettings(doc,0),basis:'paper',fillArea:'border',spacingLeft:1000,spacingRight:2000,spacingTop:3000,spacingBottom:4000,fillType:'gradient',gradient:{...defaultPageGradient(),colors:['#12abcd','#ef3456']}};writePageBorderSettings(doc,0,'both',base);const svg=doc.renderPageSvg(0),rect=svg.match(/<rect\b[^>]*fill="url\([^>]+>/i)?.[0];assert.ok(rect);near(Number(rect.match(/\bx="([^"]+)"/)[1]),1000/75);near(Number(rect.match(/\by="([^"]+)"/)[1]),40);assert.ok(svg.includes('#12abcd'));const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`fill-area-gradient.${format}`),bytes);loaded=new HwpDocument(bytes);assert.equal(readPageBorderSettings(loaded,0).fillArea,'border');assert.equal(loaded.renderPageSvg(0).match(/<rect\b[^>]*fill="url\([^>]+>/i)?.[0],rect);results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{loaded?.free();doc?.free();}
 }
 {const name='body-based border-region fill is clipped to the physical sheet when spacing exceeds margins';let doc;try{doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.setPageDef(0,JSON.stringify({marginLeft:100,marginRight:100,marginTop:100,marginBottom:100,marginHeader:0,marginFooter:0}));writePageBorderSettings(doc,0,'both',{...readPageBorderSettings(doc,0),basis:'page',fillArea:'border',fillType:'solid',fillColor:'#bedace',patternType:-1,spacingLeft:7087,spacingRight:7087,spacingTop:7087,spacingBottom:7087});const info=parse(doc.getPageInfo(0)),box=svgBox(doc.renderPageSvg(0),'#bedace');near(box.x,0);near(box.y,0);near(box.width,info.width);near(box.height,info.height);results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{doc?.free();}}
 for(const format of ['hwp','hwpx']){
  const name=`${format}: border-region fill honors page parity and first-page visibility after reopening`;let doc,loaded;
  try{doc=HwpDocument.createEmpty();doc.createBlankDocument();doc.insertText(0,0,0,'첫');const second=parse(doc.insertPageBreak(0,0,1));doc.insertText(0,second.paraIdx,0,'둘');writePageBorderSettings(doc,0,'both',{...readPageBorderSettings(doc,0),fillArea:'border',fillType:'solid',fillColor:'#bedace',patternType:-1,applyPage:'exceptFirst'});writePageBorderSettings(doc,0,'even',{...readPageBorderSettings(doc,0,'even'),fillArea:'border',fillType:'solid',fillColor:'#fa9876',patternType:-1,basis:'paper',spacingLeft:1500,spacingRight:1500});assert.ok(!doc.renderPageSvg(0).includes('#bedace'));near(svgBox(doc.renderPageSvg(1),'#fa9876').x,20);const bytes=doc[format==='hwp'?'exportHwp':'exportHwpx']();await writeFile(resolve(out,`fill-area-parity.${format}`),bytes);loaded=new HwpDocument(bytes);assert.ok(!loaded.renderPageSvg(0).includes('#bedace'));near(svgBox(loaded.renderPageSvg(1),'#fa9876').x,20);results.push(name);console.log('PASS',name);}catch(error){failures.push({name,error:String(error),stack:error.stack});console.error('FAIL',name,error);}finally{loaded?.free();doc?.free();}
 }
}else if(process.env.JUEONY_REQUIRE_BORDER_REGION==='1')throw new Error('Border-region layout capability is absent');
await writeFile(resolve(out,'result.json'),JSON.stringify({results,failures,engine:JSON.parse(await readFile(resolve(pkg,'jueony-engine-build.json'),'utf8')),note:'Real WASM, SVG geometry and independent saved XML; native Hancom visual comparison is pending.'},null,2));if(failures.length)process.exitCode=1;
