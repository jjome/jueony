import assert from'node:assert/strict';
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{resolve,isAbsolute}from'node:path';
import{createHash}from'node:crypto';
import{loadReviewEngine,snapshot}from'./lib/hancom-review.mjs';
import{validateN042PrintManifest,captureN042PrintLayout,compareN042PrintCaptures,classifyN042Failure}from'./lib/n042-print-contract.mjs';

const repo=resolve(import.meta.dirname,'../../..'),packagePath=process.env.JUEONY_ENGINE_PACKAGE,outputPath=process.env.JUEONY_TEST_OUTPUT;
assert.ok(packagePath&&isAbsolute(packagePath),'JUEONY_ENGINE_PACKAGE absolute required');assert.ok(outputPath&&isAbsolute(outputPath),'JUEONY_TEST_OUTPUT absolute required');
const out=resolve(outputPath);await mkdir(out,{recursive:true});
const manifest=validateN042PrintManifest(JSON.parse(await readFile(resolve(repo,'apps/editor/tests/fixtures/n042-print-layout-own/manifest.json'),'utf8')));
const engine=await loadReviewEngine(packagePath),{HwpDocument}=engine,parse=value=>typeof value==='string'?JSON.parse(value):value,hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
function build(){
 const doc=HwpDocument.createEmpty();
 try{
  doc.createBlankDocument();const first='출력 비교 본문 😀 표와 그림, 누름틀';doc.insertText(0,0,0,first);doc.applyCharFormat(0,0,0,Array.from(first).length,JSON.stringify({fontFamily:manifest.environment.fontFamily,fontSize:1000}));
  const field=parse(doc.insertClickHereField(0,0,8,'입력 안내','N042','담당자',true));assert.ok(Number.isSafeInteger(field.fieldId));
  doc.splitParagraph(0,0,doc.getParagraphLength(0,0));const table=parse(doc.createTable(0,1,0,2,2));for(const[index,value]of['항목','일정','준비','11월'].entries())doc.insertTextInCell(0,table.paraIdx,table.controlIdx,index,0,0,value);
  doc.setCellProperties(0,table.paraIdx,table.controlIdx,0,JSON.stringify({fillType:'solid',fillColor:'#ffeeaa',width:18000}));
  doc.splitParagraph(0,1,doc.getParagraphLength(0,1));const picture=parse(doc.insertPicture(0,2,0,'[]',png,3000,3000,1,1,'png','N042 출력 그림'));assert.equal(picture.ok,true);
  const next=parse(doc.insertPageBreak(0,2,doc.getParagraphLength(0,2)));const second='둘째 쪽 줄바꿈 검증 본문';doc.insertText(0,next.paraIdx,0,second);doc.applyCharFormat(0,next.paraIdx,0,Array.from(second).length,JSON.stringify({fontFamily:manifest.environment.fontFamily,fontSize:1000}));
  doc.setPageDef(0,JSON.stringify({width:manifest.environment.paperWidthHwpUnit,height:manifest.environment.paperHeightHwpUnit,marginLeft:8504,marginRight:8504,marginTop:5668,marginBottom:4252,landscape:manifest.environment.landscape}));return doc;
 }catch(error){doc.free();throw error;}
}
function exportBytes(doc,format){const result=doc[format==='hwp'?'exportHwpWithReport':'exportHwpxWithReport']();try{return result.takeBytes();}finally{result.free();}}
const results=[];
for(const format of manifest.formats){let stage='build',seed,first,second;try{
 seed=build();stage='export';const input=exportBytes(seed,format),inputHash=hash(input);stage='reopen';first=new HwpDocument(input);stage='capture';const info=parse(first.getDocumentInfo());assert.ok(info.fontsUsed?.includes(manifest.environment.fontFamily),'expected font family is not used');const before=captureN042PrintLayout(snapshot(first),manifest.environment,'jueony-engine');assert.ok(before.pages>=2,'expected at least two pages');
 stage='export';const saved=exportBytes(first,format);stage='reopen';second=new HwpDocument(saved);stage='capture';const after=captureN042PrintLayout(snapshot(second),manifest.environment,'jueony-engine');stage='compare';const comparison=compareN042PrintCaptures(before,after,{mode:'baseline',tolerance:manifest.tolerance});assert.equal(comparison.status,'MATCH_WITHIN_CONTRACT',JSON.stringify(comparison.defects));
 stage='input-integrity';assert.equal(hash(input),inputHash);results.push({format,status:'PASS',pages:after.pages,inputSha256:inputHash,outputSha256:hash(saved),comparison});console.log('PASS',format);
 }catch(error){const failure=classifyN042Failure(stage,error);results.push({format,status:'FAIL',failure});console.error('FAIL',format,failure);}finally{second?.free();first?.free();seed?.free();}}
const failed=results.filter(item=>item.status==='FAIL');const report={schemaVersion:1,caseId:manifest.caseId,status:failed.length?'FAIL':'PASS_JUEONY_BASELINE_ONLY',environment:manifest.environment,engine:engine.metadata,results,limitations:['한글 2024 또는 PDF 렌더러를 실행하지 않았다.','fontFingerprint가 null이므로 실제 한글과의 교차 비교는 계약상 차단된다.','엔진의 published layout이며 인쇄 드라이버 raster 결과가 아니다.']};
await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');if(failed.length)process.exitCode=1;
