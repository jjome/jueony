import assert from'node:assert/strict';
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{resolve,isAbsolute}from'node:path';
import{createHash}from'node:crypto';
import{loadReviewEngine,snapshot,compareSnapshots}from'./lib/hancom-review.mjs';
import{validateN041CorpusManifest,classifyN041Failure}from'./lib/n041-corpus-contract.mjs';
import{verifyPreservedExport,capturePreservationEvidence}from'../src/adapters/rhwp/preservation.ts';

const repo=resolve(import.meta.dirname,'../../..');
const packagePath=process.env.JUEONY_ENGINE_PACKAGE,outputPath=process.env.JUEONY_TEST_OUTPUT;
assert.ok(packagePath&&isAbsolute(packagePath),'JUEONY_ENGINE_PACKAGE absolute required');
assert.ok(outputPath&&isAbsolute(outputPath),'JUEONY_TEST_OUTPUT absolute required');
const out=resolve(outputPath),inputs=resolve(out,'inputs'),outputs=resolve(out,'outputs/noop');
await mkdir(inputs,{recursive:true});await mkdir(outputs,{recursive:true});
const manifest=validateN041CorpusManifest(JSON.parse(await readFile(resolve(repo,'apps/editor/tests/fixtures/n041-engine-corpus-own/manifest.json'),'utf8')));
const engine=await loadReviewEngine(packagePath),{HwpDocument}=engine;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));

function body(doc,text){doc.createBlankDocument();doc.insertText(0,0,0,text);doc.applyCharFormat(0,0,0,Array.from(text).length,JSON.stringify({fontFamily:'함초롬바탕',fontSize:1000}));}
function build(kind){
 const doc=HwpDocument.createEmpty();
 try{
  if(kind==='body-font')body(doc,'합성 문서 기본 본문 😀 2026-11-09');
  else if(kind==='page-boundary'){
   body(doc,'첫 쪽 경계 본문 😀');const next=parse(doc.insertPageBreak(0,0,doc.getParagraphLength(0,0)));doc.insertText(0,next.paraIdx,0,'둘째 쪽 본문');doc.applyCharFormat(0,next.paraIdx,0,doc.getParagraphLength(0,next.paraIdx),JSON.stringify({fontFamily:'함초롬바탕',fontSize:1000}));doc.setPageDef(0,JSON.stringify({marginLeft:11340,marginRight:11340,marginTop:8505,marginBottom:8505}));
  }else if(kind==='table'){
   body(doc,'표 검수 본문');doc.splitParagraph(0,0,doc.getParagraphLength(0,0));const table=parse(doc.createTable(0,1,0,2,2));for(const [index,value]of['항목','일정','준비','11월'].entries())doc.insertTextInCell(0,table.paraIdx,table.controlIdx,index,0,0,value);doc.setCellProperties(0,table.paraIdx,table.controlIdx,0,JSON.stringify({fillType:'solid',fillColor:'#ffeeaa',width:18000}));
  }else if(kind==='picture'){
   doc.createBlankDocument();const made=parse(doc.insertPicture(0,0,0,'[]',png,3000,3000,1,1,'png','N041 합성 그림'));assert.equal(made.ok,true);
  }else if(kind==='field'){
   body(doc,'필드 앞 뒤');const made=parse(doc.insertClickHereField(0,0,4,'입력 안내','N041 도움말','담당자',true));assert.ok(Number.isSafeInteger(made.fieldId));
  }else throw Error('unknown builder');
  return doc;
 }catch(error){doc.free();throw error;}
}
function artifact(doc,format){
 const value=doc[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();
 try{return{bytes:value.takeBytes(),loss:parse(value.contentLoss())};}finally{value.free();}
}
function probe(doc){
 const info=parse(doc.getDocumentInfo()),controls=parse(doc.getControls()),fields=parse(doc.getFieldList()),objects=parse(doc.getObjects());
 const count=predicate=>controls.filter(predicate).length;
 return{sourceFormat:doc.getSourceFormat(),pages:doc.pageCount(),sections:doc.getSectionCount(),text:doc.getTextFileUnicode(),fonts:[...new Set(info.fontsUsed??[])].sort(),tables:count(item=>item.ctrlId==='tbl'),pictures:count(item=>item.ctrlId==='gso'&&item.userDesc==='그림'),fields:fields.length,objectKinds:objects.map(item=>item.kind).sort()};
}
function checkExpected(caseInfo,actual){
 const expected=caseInfo.expected;
 assert.ok(actual.pages>=expected.minimumPages,'minimum pages');assert.ok(actual.tables>=expected.minimumTables,'minimum tables');assert.ok(actual.pictures>=expected.minimumPictures,'minimum pictures');assert.ok(actual.fields>=expected.minimumFields,'minimum fields');assert.ok(actual.fonts.includes(expected.fontFamily),'expected font missing');
}

const results=[];
for(const caseInfo of manifest.cases)for(const format of caseInfo.formats){
 const id=`${caseInfo.id}-${format}`;let stage='build',seed,source,reopened;
 try{
  seed=build(caseInfo.builder);stage='initial-export';const initial=artifact(seed,format);verifyPreservedExport(seed,initial.bytes,format,initial.loss,bytes=>new HwpDocument(bytes));
  const inputFile=resolve(inputs,`${caseInfo.id}.${format}`);await writeFile(inputFile,initial.bytes);const inputHash=hash(initial.bytes);
  stage='initial-reopen';source=new HwpDocument(initial.bytes);stage='source-probe';const beforeProbe=probe(source);checkExpected(caseInfo,beforeProbe);const beforeEvidence=capturePreservationEvidence(source);for(const path of caseInfo.requiredEvidence)assert.ok(Object.hasOwn(beforeEvidence.values,path),`missing source evidence ${path}`);
  const beforeSnapshot=snapshot(source);stage='save';const saved=artifact(source,format);stage='preservation';const preservation=verifyPreservedExport(source,saved.bytes,format,saved.loss,bytes=>new HwpDocument(bytes));assert.equal(preservation.status,'checked');
  stage='reopen';reopened=new HwpDocument(saved.bytes);const afterProbe=probe(reopened);checkExpected(caseInfo,afterProbe);assert.deepEqual(afterProbe,beforeProbe);
  const afterEvidence=capturePreservationEvidence(reopened);for(const path of caseInfo.requiredEvidence)assert.ok(Object.hasOwn(afterEvidence.values,path),`missing reopened evidence ${path}`);
  stage='layout';const comparison=compareSnapshots(beforeSnapshot,snapshot(reopened));assert.equal(comparison.status,'SAME_WITHIN_PUBLISHED_CONTRACT',JSON.stringify({semantic:comparison.semantic.count,geometry:comparison.geometry.count}));
  stage='input-integrity';assert.equal(hash(await readFile(inputFile)),inputHash);const outputFile=resolve(outputs,`${caseInfo.id}.${format}`);await writeFile(outputFile,saved.bytes);
  results.push({id,caseId:caseInfo.id,format,status:'PASS',input:{sha256:inputHash,bytes:initial.bytes.length},output:{sha256:hash(saved.bytes),bytes:saved.bytes.length},features:afterProbe,preservation:{checked:preservation.checked.length,unverified:preservation.unverified},layout:{semanticDifferences:comparison.semantic.count,geometryDifferences:comparison.geometry.count,tolerance:comparison.geometry.tolerance}});
  console.log('PASS',id);
 }catch(error){const failure=classifyN041Failure(stage,error);results.push({id,caseId:caseInfo.id,format,status:'FAIL',failure});console.error('FAIL',id,failure);}
 finally{reopened?.free();source?.free();seed?.free();}
}
const failed=results.filter(result=>result.status==='FAIL');
const report={schemaVersion:1,corpusId:manifest.corpusId,status:failed.length?'FAIL':'PASS_ENGINE_ONLY',generatedSynthetic:true,engine:engine.metadata,summary:{total:results.length,passed:results.length-failed.length,failed:failed.length},results,limitations:['같은 Jueony Rust/WASM 엔진의 합성 문서 open-save-reopen 검사다.','한글 2024 화면·인쇄·복구 경고 비교는 실행하지 않았다.','기관 실문서와 공개 문서 호환성의 근거가 아니다.']};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');
if(failed.length)process.exitCode=1;
