import assert from 'node:assert/strict';
import{readFile,writeFile}from'node:fs/promises';
import{resolve,join}from'node:path';
import{loadReviewEngine,hash}from'../../apps/editor/scripts/lib/hancom-review.mjs';
const out=resolve('build/Python3-width-own76'),pkg=resolve('build/rhwp-engine/source-23d2545926a179a5/pkg'),engine=await loadReviewEngine(pkg);
const original=JSON.parse(await readFile('build/file-closure69-public/typography-residual-candidate70/native-baseline/unclaimed-raw.json','utf8')).targetParagraphs[1].paragraph.text;
const first=[...original].slice(0,31).map(c=>/[\uac00-\ud7a3]/u.test(c)?'가':c).join(''),text=first+'나'.repeat(5);
assert.equal([...first].length,31);assert.equal([...first].filter(c=>c==='가').length,25);assert.equal([...first].filter(c=>c===' ').length,5);assert.equal([...first].filter(c=>c==='.').length,1);
const results=[];
for(const width of[29867,29868,29869,29872,29873,29874,29875,29876,29877])for(const alignment of width===29868?['justify','left']:['justify']){
 const d=engine.HwpDocument.createEmpty();try{
  d.createBlankDocument();const t=JSON.parse(d.createTable(0,0,0,1,1));assert.equal(t.ok,true);
  d.setTableProperties(0,t.paraIdx,t.controlIdx,JSON.stringify({paddingLeft:0,paddingRight:0,paddingTop:0,paddingBottom:0,pageBreak:0}));
  d.setCellProperties(0,t.paraIdx,t.controlIdx,0,JSON.stringify({width,height:5000,applyInnerMargin:true,paddingLeft:0,paddingRight:0,paddingTop:0,paddingBottom:0}));
  d.insertTextInCell(0,t.paraIdx,t.controlIdx,0,0,0,text);
  const ids=Array.from({length:7},(_,lang)=>d.findOrCreateFontIdForLang(lang,'굴림체'));
  d.applyCharFormatInCell(0,t.paraIdx,t.controlIdx,0,0,0,text.length,JSON.stringify({fontIds:ids,fontSize:1100,ratios:Array(7).fill(97),spacings:Array(7).fill(0),relativeSizes:Array(7).fill(100),bold:false,italic:false}));
  d.applyParaFormatInCell(0,t.paraIdx,t.controlIdx,0,0,JSON.stringify({alignment,koreanBreakUnit:1,englishBreakUnit:0,lineSpacing:130,leftMargin:0,rightMargin:0,indent:0,spaceBefore:0,spaceAfter:0}));
  const properties=JSON.parse(d.getCellProperties(0,t.paraIdx,t.controlIdx,0));assert.equal(properties.width,width);assert.equal(properties.paddingLeft,0);assert.equal(properties.paddingRight,0);
  const bytes=d.exportHwpx(),name=`own-gulimche-11pt97-${width}-${alignment}-char-break.hwpx`;
  await writeFile(join(out,name),bytes,{flag:'wx'});
  const layout=Array.from({length:d.pageCount()},(_,p)=>JSON.parse(d.getPageTextLayout(p)).runs).flat().filter(r=>r.cellIdx===0);
  assert.ok(layout.every(r=>r.fontFamily==='굴림체'&&r.ratio===0.97&&Math.abs(r.fontSize-14.7)<0.1));
  results.push({name,widthHU:width,alignment,sha256:hash(bytes),fontSizeHU:1100,ratioPercent:97,textChars:36,first31:{full:25,spaces:5,periods:1,idealAdvanceHU:29876,glyphFloorAdvanceHU:29873},enginePartitions:layout.map(r=>({charStart:r.charStart,textChars:[...r.text].length,fontFamily:r.fontFamily,fontSize:r.fontSize,ratio:r.ratio}))});
 }finally{d.free();}
}
await writeFile(join(out,'generated-manifest-char-break.json'),JSON.stringify({engine:engine.metadata,ownText:text,scope:'Fresh self-authored 1cell documents, GulimChe11pt97%, same full/half-width pattern as measured source. No copied public sentence or font program. Next step strips only own linesegarray for explicit no-LS fixtures.',results},null,2));console.log('PASS',results.length,'own fixtures',out);
