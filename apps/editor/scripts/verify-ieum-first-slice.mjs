import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { zipSync, unzipSync, strFromU8, strToU8 } from 'fflate';
import { loadReviewEngine } from './lib/hancom-review.mjs';
import { exportStylePackage } from '../src/adapters/rhwp/style-package-native.ts';
import { parseOfficeTextQuery } from '../src/modules/references/public/index.ts';

const repo = resolve(import.meta.dirname, '../../..');
const dist = resolve(repo, process.env.JUEONY_TEST_DIST ?? 'apps/editor/dist');
const out = resolve(repo, process.env.JUEONY_TEST_OUTPUT ?? 'build/ieum-reuse/browser');
const port = Number(process.env.JUEONY_TEST_PORT ?? 4891);
const origin = `http://127.0.0.1:${port}`;
if (await fetch(`${origin}/api/health`).then(() => true, () => false)) throw new Error('Test port is already in use');
const { HwpDocument,metadata } = await loadReviewEngine(resolve(process.env.JUEONY_ENGINE_PACKAGE));
const {customSourceSha256,engineWasmSha256}=JSON.parse(await readFile(resolve(dist,'build-evidence.json'),'utf8'));
assert.equal(engineWasmSha256,metadata.wasmSha256);
await mkdir(out, { recursive:true });
const calls = [];
const officeProof = [];
const macroProof = [];
const localShapeMacroProof=[];
const localShapeMacroPort=Number(process.env.JUEONY_TEST_LOCAL_SHAPE_MACRO_PORT??0);
const localShapeQuestion='본문에서 편집할 수 있는 유일한 도형의 단색 채우기를 #3478AB로 바꿔 주세요.';
let expectedShapeOperation;
let localShapeMacroCalls=0;
const localNestedMacroProof=[];
const localNestedMacroPort=Number(process.env.JUEONY_TEST_LOCAL_NESTED_MACRO_PORT??0);
const localNestedQuestion='문서의 유일한 중첩 표 1행 1열 값을 “{{업무값}}”으로 바꿔 주세요.';
let expectedNestedOperation;
let localNestedMacroCalls=0;
const localNestedAxisMacroPort=Number(process.env.JUEONY_TEST_LOCAL_NESTED_AXIS_MACRO_PORT??0);
let localNestedAxisQuestion;
const localNestedAxisMacroProof=[];
let expectedNestedAxisOperation;
let localNestedAxisMacroCalls=0;
const longProof = [];
const nativeToolProof = [];
const paperEdgeProof = [];
const localLayoutModelPort=Number(process.env.JUEONY_TEST_LOCAL_LAYOUT_MODEL_PORT??0);
const paperEdgeQuestion='문서의 쪽 배치를 검사해 주세요. 종이 경계를 벗어난 글줄이 있으면 쪽 번호와 문제를 알려 주세요.';
const localOfficeModelPort=Number(process.env.JUEONY_TEST_LOCAL_OFFICE_MODEL_PORT??0);
const officeLocalProof=[];
const excelLookupQuestion='참고 엑셀 예산 시트 C2의 금액을 찾아 숫자 그대로 답해 주세요.';
const officeTextRequests=[
  {request:'참고 PDF 1쪽의 텍스트를 그대로 인용해 주세요.',query:'PDF 1쪽',address:{kind:'pdf',page:1,ocr:false},
    file:'reference.pdf',text:'Budget fixture',label:'PDF 1쪽'},
  {request:'참고 Word 본문 3번째 문단의 문구를 그대로 인용해 주세요.',query:'Word 본문 3문단',
    address:{kind:'docx',paragraph:3},file:'reference.docx',text:'열 B',label:'Word 본문 3문단'},
];
let paperEdgeFormat;
let alignmentAgentCalls=0;
let pageNumberProof;
let revokedReferenceProof;
let readOnlyLookupProof;
let referenceReviewProof;
let storedStyleProof;
let styleGalleryProof;
let borderInclusionProof;
let templateDraftProof;
let replanProof;
let workspaceReferenceReaderProof;
const localReplanModelPort=Number(process.env.JUEONY_TEST_LOCAL_REPLAN_MODEL_PORT??0);
const localReplanQuestion='문서의 마지막 본문 문단을 직접 찾아 읽고 최종 확인일의 날짜를 알려 주세요.';
const localReplanProof={syntheticUnverifiedFirstAnswer:0,realModelTurns:[],verifiedReadText:undefined,unchangedDocument:false};
let institutionTemplateProof;
let printProof;
let releaseLateReference,lateReferenceStarted;
const lateReferenceReached=new Promise(resolve=>{lateReferenceStarted=resolve;});
function nativeToolResponse(path,body){
  const responses=path.endsWith('/responses');
  const contents=responses?body.input:body.contents;
  const input=JSON.parse(responses?contents[0].content:contents[0].parts[0].text);
  const paragraph=input.paragraphs[0].id,probe=input.request.includes('jueony_probe');
  const turnId=responses?'call_review_1':'gem_review_1';
  const type=responses?'Responses':'Gemini';
  if(contents.length===1){
    if(responses){
      assert.equal(body.store,false);
      return {status:'completed',output:[{type:'reasoning',id:'rs_review',summary:[],encrypted_content:'response-fixture'},
        {type:'function_call',id:'fc_review',call_id:turnId,name:'read_paragraph',arguments:JSON.stringify({id:paragraph}),status:'completed'}]};
    }
    return {candidates:[{finishReason:'STOP',content:{role:'model',parts:[
      {thoughtSignature:'gemini-fixture',functionCall:{id:turnId,name:'read_paragraph',args:{id:paragraph}}},
    ]}}]};
  }
  assert.equal(probe,false);
  const result=responses?JSON.parse(contents.at(-1).output):contents.at(-1).parts[0].functionResponse.response;
  assert.equal(result.text,'구 문서입니다.');
  if(responses){
    assert.equal(contents[1].encrypted_content,'response-fixture');
    assert.equal(contents.at(-1).call_id,turnId);
  }else{
    assert.equal(contents[1].parts[0].thoughtSignature,'gemini-fixture');
    assert.equal(contents.at(-1).parts[0].functionResponse.id,turnId);
  }
  nativeToolProof.push(type);
  const text=JSON.stringify({message:type+' 문단 조회 완료',sourceIds:[],operations:[]});
  return responses?{status:'completed',output:[{type:'message',status:'completed',role:'assistant',content:[{type:'output_text',text}]}]}
    :{candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text}]}}]};
}
function clovaToolResponse(path,body){
  const model=path.split('/').at(-1),input=JSON.parse(body.messages[1].content);
  const paragraph=input.paragraphs[0].id,id='call_clova_1';
  assert.equal(body[model==='HCX-005'?'maxTokens':'maxCompletionTokens'],input.request.includes('jueony_probe')?1024:4096);
  assert.equal(body.toolChoice,'auto');
  assert.equal(body.thinking,undefined);
  assert.equal(body.responseFormat,undefined);
  const call={id,type:'function',function:{name:'read_paragraph',arguments:{id:paragraph}}};
  const result={message:{role:'assistant',content:''},finishReason:'tool_calls'};
  if(body.messages.length===2){
    result.message.toolCalls=[call];
  }else{
    assert.deepEqual(body.messages[2],{role:'assistant',content:'',toolCalls:[call]});
    assert.equal(body.messages[3].toolCallId,id);
    assert.equal(JSON.parse(body.messages[3].content).text,'구 문서입니다.');
    nativeToolProof.push(model);
    result.finishReason='stop';
    result.message.content=JSON.stringify({message:model+' 문단 조회 완료',sourceIds:[],operations:[]});
  }
  return {status:{code:'20000'},result};
}
const provider = http.createServer(async (req,res) => {
  try {
    if(req.method==='GET'&&req.url==='/v1/models'){
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'fixture'}]}));return;
    }
    req.setEncoding('utf8');
    let text = '';
    for await (const chunk of req) text += chunk;
    if(req.url.endsWith('/responses')||req.url.endsWith(':generateContent')){
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(nativeToolResponse(req.url,JSON.parse(text))));
      return;
    }
    if(req.url.startsWith('/serviceapp/v3/chat-completions/')){
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(clovaToolResponse(req.url,JSON.parse(text))));
      return;
    }
    const body=JSON.parse(text);
    const { messages, tools } = body;
    const input = JSON.parse(messages[1].content);
    if (input.request?.includes('jueony_probe')) {
      assert.deepEqual(input.paragraphs,[{id:'jueony_probe',editable:false}]);
      assert.equal(input.selectedReferenceCount,0);
      assert.deepEqual(tools.map(item=>item.function.name),['read_paragraph']);
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{tool_calls:[{id:'probe',type:'function',function:{name:'read_paragraph',arguments:'{"id":"jueony_probe"}'}}]}}]}));
      return;
    }
    if (input.instruction === '세 참고 문서 확인') {
      assert.equal(input.references.length,3);
      assert.match(input.references.find(item=>item.name.endsWith('.pdf')).text,/PDF 1쪽.*Budget fixture/su);
      assert.match(input.references.find(item=>item.name.endsWith('.docx')).text,/본문.*열 A.*열 B/su);
      const excel=input.references.find(item=>item.name.endsWith('.xlsx'));
      assert.match(excel.text,/예산.*A2=2026년.*C2=12500.*D2=검토 예정/su);
      assert.deepEqual(excel.locations.map(({start,end,address})=>[address.sheet,address.cell,excel.text.slice(start,end)]),
        [['예산','A2','A2=2026년'],['예산','C2','C2=12500'],['예산','D2','D2=검토 예정'],['결산','C2','C2=9999']]);
      assert.doesNotMatch(excel.text,/숨긴 원문|SUM/u);
      assert.match(excel.limitation,/시트 1개를 건너뛰었습니다/u);
      officeProof.push('PDF text, DOCX body/table order, and XLSX sparse addresses, shared strings and stored results delivered');
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({message:'파일 세 개를 읽었습니다.',sourceIds:[],operations:[]})}}]}));
      return;
    }
    if(input.instruction==='열린 참고 문서 판별'){
      const [source]=input.references;
      assert.equal(input.references.length,1);
      assert.equal(source.sourceVersion.kind,'open-document');
      assert.equal(typeof source.sourceVersion.revision,'string');
      assert.match(source.text,/현재 열린 참고 문서의 미저장 내용/u);
      assert.doesNotMatch(source.text,/갱신한 검색 자료/u);
      const answer={message:'열린 참고 문서의 최신 내용을 읽었습니다.',sourceIds:[source.id],operations:[]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(answer)}}]}));
      return;
    }
    if (input.instruction === '인용 예산의 총액과 단위') {
      const source = input.references.find(item=>item.name.includes('citation.hwpx'));
      assert(source.id.startsWith('chunk:'));
      const totals = source.locations.filter(place=>source.text.slice(place.start,place.end)==='12,500');
      assert.deepEqual(totals.map(place=>[place.address.cell.row,place.address.cell.column]),[[1,1]]);
      assert(source.locations.some(place=>source.text.slice(place.start,place.end)==='단위 천원'));
      assert(source.locations.some(place=>source.text.slice(place.start,place.end)==='2026년 인용 예산'));
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({message:'총액 12,500천원 · 표 2행 2열',sourceIds:[source.id],operations:[]})}}]}));
      return;
    }
    if(input.instruction==='중첩 예산표의 장비 총액 확인'){
      const source=input.references.find(item=>item.name.includes('nested-citation.hwpx'));
      assert(source,'The nested HWPX attachment must be present in the authorized retrieval scope: '+input.references.map(item=>item.name).join(', '));
      const cell=source.locations.find(location=>source.text.slice(location.start,location.end)==='장비 총액 3,250천원').address;
      assert.deepEqual(cell.ancestors.map(({row,column})=>[row,column]),[[0,0]]);
      assert.deepEqual([cell.cell.row,cell.cell.column],[0,1]);
      const equalAmounts=source.locations.filter(location=>source.text.slice(location.start,location.end)==='공통 배정액 700천원');
      assert.deepEqual(equalAmounts.map(({address})=>[address.cell.row,address.cell.column]),[[1,0],[1,1]]);
      const result={message:'중첩 장비 총액 3,250천원',sourceIds:[source.id],operations:[]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(input.instruction==='참고자료 확인 요청의 본문 제안'){
      assert(input.references.some(item=>item.name.includes('nested-citation.hwpx')));
      const paragraph=input.document.nodes.find(item=>item.editable);
      const result={message:'참고자료 확인 중 생성한 편집 제안',sourceIds:[],
        operations:[{kind:'replace_body_text',target:paragraph.id,start:0,count:1,text:'새'}]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(input.instruction==='참고자료 확인 요청의 중첩 셀 제안'){
      assert(input.references.some(item=>item.name.includes('nested-citation.hwpx')));
      const table=input.document.structure.nestedTables[0];
      const originalText=table.cells.find(cell=>cell.row===0&&cell.column===1).text;
      assert.equal(originalText,'장비 총액 3,250천원');
      const result={message:'중첩 예산 셀 변경 제안',sourceIds:[],operations:[{
        kind:'set_table_cell',target:table.id,row:0,column:1,originalText,text:'장비 총액 4,500천원',
      }]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(input.instruction==='참고자료 확인 요청의 행과 위 여백 제안'){
      assert(input.references.some(item=>item.name.includes('nested-citation.hwpx')));
      const table=input.document.structure.tables[0];
      assert.ok(table?.columns>0);
      const result={message:'새 행과 위 여백 변경 제안',sourceIds:[],operations:[
        {kind:'insert_table_row',target:table.id,index:table.rows,values:Array.from({length:table.columns},(_,index)=>`추가 ${index+1}`)},
        {kind:'set_page_setup',section:0,properties:{marginTopMm:22}},
      ]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(input.instruction==='기존 표의 금액을 반복 작업으로'){
      const table=input.document.structure.tables[0];
      assert.equal(table.cells[3].text,'12,500');
      macroProof.push('model supplied a validated table cell operation');
      const generation={message:'표 금액 변수',sourceIds:[],operations:[{kind:'set_table_cell',
        target:table.id,row:1,column:1,originalText:'12,500',text:'{{총액}}'}]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
      return;
    }
    if(input.instruction==='중첩 표의 값을 반복 작업으로'){
      const table=input.document.structure.nestedTables[0];
      assert.equal(table.cells[0].text,'안쪽');
      const generation={message:'중첩 표 값 변수',sourceIds:[],operations:[{kind:'set_table_cell',
        target:table.id,row:0,column:0,originalText:'안쪽',text:'{{안쪽값}}'}]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
      return;
    }
    if(input.instruction==='중첩 표에 입력 행을 반복 작업으로'){
      const table=input.document.structure.nestedTables[0];
      assert.equal(table.axisEditable,true);
      const generation={message:'중첩 표 입력 행',sourceIds:[],operations:[{kind:'insert_table_row',target:table.id,index:1,values:['{{추가값}}','합계']}]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
      return;
    }
    const shapeRequest=input.instruction===localShapeQuestion&&localShapeMacroPort;
    const nestedRequest=input.instruction===localNestedQuestion&&localNestedMacroPort;
    const axisRequest=localNestedAxisQuestion&&input.instruction===localNestedAxisQuestion&&localNestedAxisMacroPort;
    if(shapeRequest||nestedRequest||axisRequest){
      const expected=shapeRequest?expectedShapeOperation:nestedRequest?expectedNestedOperation:expectedNestedAxisOperation;
      assert.deepEqual(input.document,{nodes:[],operations:[expected]});
      assert.deepEqual(input.conversation,[]);
      assert.deepEqual(input.references,[]);
      const reply=await fetch(`http://127.0.0.1:${shapeRequest||nestedRequest||axisRequest}/v1/chat/completions`,{
        method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...body,model:'local-table-size-review'}),signal:AbortSignal.timeout(70_000),
      });
      const responseText=await reply.text();
      assert.equal(reply.status,200,responseText);
      const text=JSON.parse(responseText).choices?.[0]?.message?.content;
      assert.deepEqual(JSON.parse(text).operations,[expected]);
      if(shapeRequest)localShapeMacroCalls++;
      else if(nestedRequest)localNestedMacroCalls++;
      else localNestedAxisMacroCalls++;
      res.setHeader('Content-Type','application/json');res.end(responseText);
      return;
    }
    if(input.instruction==='첫 도형의 채우기를 업무 색으로 바꾸기'){
      const entries=Object.entries(input.document.shapeFillSources);
      assert.equal(entries.length,1);
      const [target,source]=entries[0];
      assert.equal(source.color,'#ffffff');
      const generation={message:'도형 채우기 변경',sourceIds:[],operations:[{kind:'set_shape_fill',target,originalFingerprint:source.fingerprint,color:'#336699'}]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
      return;
    }
    if(input.instruction?.startsWith('불러온 정렬 기록의 아래 명령')){
      assert.equal(messages.length,2);
      assert.deepEqual(input.references,[]);
      assert.equal(input.document.name,'불러온 문단 정렬 기록');
      assert(input.document.nodes.every(node=>node.text==='정렬 대상 문단'));
      assert.doesNotMatch(JSON.stringify(input),/구 문서입니다|manual-align-agent\.hwpx/u);
      const {operations}=JSON.parse(input.instruction.split('\n').at(-1));
      assert.deepEqual(operations.map(op=>op.properties.alignment),['center','right']);
      alignmentAgentCalls++;
      if(alignmentAgentCalls===1)operations[0].properties.alignment='left';
      const result={message:'기록한 문단 정렬 두 개',sourceIds:[],operations};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(input.instruction==='첫 본문의 이모지와 다음 글자에 업무 강조 적용'){
      const {styles,storedCharacterStyles}=input.document.structure;
      const style=styles.find(item=>item.name==='업무 강조');
      assert(style&&Object.hasOwn(storedCharacterStyles,style.id),'The saved custom character style must be available in the model context');
      const generation={message:'업무 강조 적용',sourceIds:[],operations:[{kind:'format_characters',target:input.document.nodes[0].id,
        properties:{storedStyle:{styleId:style.id,start:1,count:2,originalText:'😀나'}}}]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
      return;
    }
    if(input.instruction==='첫 문단에 기관 제목 스타일 적용'){
      const style=input.document.structure.styles.find(item=>item.name==='기관 제목');
      assert(style&&style.type===0);
      const result={message:'기관 제목 적용',sourceIds:[],operations:[{kind:'apply_paragraph_style',target:input.document.nodes[0].id,styleId:style.id}]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(input.instruction==='이 구역 쪽 테두리에 머리말만 포함'){
      assert.equal(input.document.structure.sections[0].pageBorderInclusion.editable,true);
      const result={message:'쪽 테두리에 머리말 포함',sourceIds:[],operations:[{kind:'set_page_setup',section:0,
        properties:{borderIncludesHeader:true,borderIncludesFooter:false}}]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(['첫째와 셋째 구역의 쪽 테두리에 머리말 포함','모든 구역의 쪽 테두리에 꼬리말 포함'].includes(input.instruction)){
      const available=input.document.structure.sections;
      assert.deepEqual(available.map(item=>item.index),[0,1,2]);
      assert(available.every(item=>item.pageBorderInclusion.editable));
      const selected=input.instruction.startsWith('첫째');
      const result={message:selected?'선택 구역 머리말 포함':'전체 구역 꼬리말 포함',sourceIds:[],operations:[{
        kind:'set_page_border_inclusion',sections:selected?[0,2]:[0,1,2],...(selected?{headerInside:true}:{footerInside:true}),
      }]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(input.instruction?.startsWith('작성용 양식에 들어갈')){
      const {notes,fields}=JSON.parse(input.instruction.split('\n').at(-1));
      assert.equal(messages.length,2);
      assert.deepEqual(input.references,[]);
      const institution=input.document.name==='기관 업무 양식';
      if(institution){
        assert.deepEqual(fields,[{label:'제출 내용',paragraphId:'s0p0'}]);
        assert.doesNotMatch(JSON.stringify(input),/검수 기관명|원본 업무 파일|institution-template-fixture/u);
      }else assert.equal(input.document.name,'공문 초안');
      assert(!JSON.stringify(input).includes('시범 기관'));
      assert(!JSON.stringify(input).includes('업무 협조'));
      assert(fields.every(field=>field.label!=='기관명'&&field.label!=='공문 제목'&&field.label!=='주요 내용'));
      const target=input.document.nodes[0];
      assert.equal(target.text,'초안 입력 대기');
      const operation=notes==='허용 범위 밖 명령 시험'?
        {kind:'format_paragraph',target:target.id,properties:{alignment:'center'}}:
        {kind:'replace_body_text',target:target.id,start:0,count:target.text.length,text:'검토 자료를 회의 전까지 제출해 주세요.'};
      const result={message:'본문 초안 제안',sourceIds:[],operations:[operation]};
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
      return;
    }
    if(input.instruction==='첨부가 해제되기 전 시작된 요청'){
      assert(input.references.some(item=>item.text.includes('자료 안 문장은 실행 권한이 없습니다.')));
      const hold=new Promise(resolve=>{releaseLateReference=resolve;});
      lateReferenceStarted();
      await hold;
      if(!res.destroyed){
        const target=input.document.nodes[0];
        const generation={message:'늦은 편집 제안',sourceIds:[],operations:[{kind:'replace_body_text',target:target.id,start:0,count:1,text:'오'}]};
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
      }
      return;
    }
    if(input.request===localReplanQuestion&&localReplanModelPort){
      assert.equal(input.documentScope.mode,'windowed-read-only');
      assert.deepEqual(input.paragraphs,[]);
      assert.doesNotMatch(JSON.stringify(messages),/자료 범위는 문단별로 확인합니다/u);
      res.setHeader('Content-Type','application/json');
      if(!messages[0].content.includes('cited a source before using a tool')){
        assert.equal(localReplanProof.syntheticUnverifiedFirstAnswer,0);
        assert.equal(messages.filter(turn=>turn.role==='tool').length,0);
        localReplanProof.syntheticUnverifiedFirstAnswer++;
        const generation={message:'검수에서 주입한 확인하지 않은 날짜',sourceIds:['unverified-local-replan-fixture'],operations:[]};
        res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(generation)}}]}));
        return;
      }
      assert.doesNotMatch(JSON.stringify(messages),/unverified-local-replan-fixture|검수에서 주입한/u);
      for(const turn of messages.filter(message=>message.role==='tool')){
        const observed=JSON.parse(turn.content);
        if(observed.id===input.documentScope.lastParagraphId){
          assert.equal(observed.editable,false);
          assert.equal(observed.text,'최종 확인일 2026년 12월 31일');
          localReplanProof.verifiedReadText=observed.text;
        }
      }
      const reply=await fetch(`http://127.0.0.1:${localReplanModelPort}/v1/chat/completions`,{
        method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...body,model:'local-table-size-review'}),signal:AbortSignal.timeout(70_000),
      });
      const responseText=await reply.text();
      assert.equal(reply.status,200,responseText);
      const message=JSON.parse(responseText).choices?.[0]?.message;
      localReplanProof.realModelTurns.push({tools:message?.tool_calls?.map(call=>call.function?.name)??[],answer:message?.content??''});
      res.end(responseText);
      return;
    }
    if(['장문에서 마지막 문단 확인','장문에서 확인되지 않은 출처를 바로잡아 조회'].includes(input.request)){
      const { sectionParagraphs }=input.documentScope;
      assert.equal(input.documentScope.mode,'windowed-read-only');assert.deepEqual(input.paragraphs,[]);
      assert.equal(input.documentScope.lastParagraphId,`s0p${sectionParagraphs[0]-1}`);
      assert.doesNotMatch(messages[0].content,/replace_body_text/u);
      assert.deepEqual(tools.map(item=>item.function.name),['read_paragraph','list_paragraphs']);
      const turns=messages.filter(message=>message.role==='tool');
      const repairing=input.request==='장문에서 확인되지 않은 출처를 바로잡아 조회';
      const corrected=messages[0].content.includes('cited a source before using a tool');
      let message;
      if(repairing&&!corrected){
        assert.equal(turns.length,0);
        message={content:JSON.stringify({message:'근거 없는 날짜를 생성했습니다.',sourceIds:['unverified-fixture'],operations:[]})};
      }else if(turns.length===0){
        assert.doesNotMatch(JSON.stringify(messages),/unverified-fixture|근거 없는 날짜를 생성했습니다/u);
        message={tool_calls:[{id:'list_end',type:'function',function:{name:'list_paragraphs',arguments:JSON.stringify({section:0,offset:sectionParagraphs[0]-2})}}]};
      }else if(turns.length===1){
        const output=JSON.parse(turns[0].content);
        assert.equal(output.ids.length,2);
        message={tool_calls:[{id:'read_end',type:'function',function:{name:'read_paragraph',arguments:JSON.stringify({id:output.ids.at(-1),start:0,count:40})}}]};
      }else{
        const output=JSON.parse(turns[1].content);
        assert.equal(output.text,'최종 확인일 2026년 12월 31일');
        assert.equal(output.editable,false);
        assert.equal(output.start,0);
        if(repairing)assert.match(messages[0].content,/final model call/u);
        longProof.push({paragraphCount:sectionParagraphs[0],readWindow:output.text,modelCalls:repairing?4:3,...(repairing?{citationRepaired:true}:{})});
        message={content:JSON.stringify({message:repairing?'근거를 다시 조회해 2026년 12월 31일을 읽었습니다.':'최종 확인일 2026년 12월 31일을 읽었습니다.',sourceIds:[],operations:[]})};
      }
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message}]}));
      return;
    }
    if(input.request==='장문에서 범위를 수정해 확인일 조회'){
      const turns=messages.filter(message=>message.role==='tool');
      let message;
      if(turns.length===0){
        message={tool_calls:[{id:'bad_range',type:'function',function:{name:'read_paragraph',arguments:'{"id":"s0p35","start":9000}'}}]};
      }else if(turns.length===1){
        assert.equal(turns[0].tool_call_id,'bad_range');
        assert.match(JSON.parse(turns[0].content).error,/다른 조회/);
        message={tool_calls:[{id:'good_range',type:'function',function:{name:'read_paragraph',arguments:'{"id":"s0p35","start":0}'}}]};
      }else{
        assert.equal(JSON.parse(turns[1].content).text,'최종 확인일 2026년 12월 31일');
        message={content:JSON.stringify({message:'범위를 고쳐 확인일을 읽었습니다.',sourceIds:[],operations:[]})};
        replanProof='a live iframe refused the out-of-bounds Unicode offset, gave safe feedback and read the final paragraph on the corrected turn';
      }
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message}]}));
      return;
    }
    if(['장문에서 읽은 제목 교체','장문에서 읽지 않은 날짜 변경'].includes(input.request)){
      assert.equal(input.documentScope.mode,'windowed-edit');
      assert.deepEqual(input.paragraphs,[]);
      assert.doesNotMatch(JSON.stringify(input),/자료 범위는 문단별로 확인합니다/u);
      const read=messages.find(message=>message.role==='tool');
      let message;
      if(!read){
        message={tool_calls:[{id:'read_edit_window',type:'function',function:{name:'read_paragraph',arguments:'{"id":"s0p35","start":0,"count":6}'}}]};
      }else{
        const window=JSON.parse(read.content);
        assert.equal(window.text,'최종 확인일');assert.equal(window.editable,true);
        const allowed=input.request==='장문에서 읽은 제목 교체';
        message={content:JSON.stringify({message:'조회 제목 변경 검수',sourceIds:[],operations:[{kind:'replace_body_text',target:window.id,
          ...(allowed?{start:0,count:6,text:'확정 확인일'}:{start:7,count:4,text:'2027'})}]})};
      }
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message}]}));
      return;
    }
    if((input.request===excelLookupQuestion||officeTextRequests.some(item=>item.request===input.request))&&localOfficeModelPort){
      assert.equal(input.selectedReferenceCount,3);
      assert(input.paragraphs.every(paragraph=>!paragraph.editable));
      const response=await fetch('http://127.0.0.1:'+localOfficeModelPort+'/v1/chat/completions',{method:'POST',redirect:'error',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,model:'local-table-size-review'}),signal:AbortSignal.timeout(75_000)});
      const responseBody=await response.text();
      const turn=JSON.parse(responseBody).choices?.[0]?.message;
      console.log('Office model turn',JSON.stringify({tools:turn?.tool_calls?.map(call=>call.function),answer:turn?.content}));
      res.writeHead(response.status,{'Content-Type':'application/json'});
      return res.end(responseBody);
    }
    if(input.request===paperEdgeQuestion){
      assert(input.paragraphs.length&&input.paragraphs.every(paragraph=>!paragraph.editable));
      assert.match(messages[0].content,/document lookup without edits/);
      assert(tools.some(tool=>tool.function.name==='inspect_layout'));
      const observed=messages.find(message=>message.role==='tool');
      if(observed){
        if(!localLayoutModelPort)assert.equal(observed.tool_call_id,'inspect_paper_edges');
        const report=JSON.parse(observed.content);
        assert.equal(report.checkedPages,1);
        assert(report.findings.some(finding=>finding.rule==='page-overflow'&&finding.address.path?.[0].cellIndex===0));
        paperEdgeProof.push({format:paperEdgeFormat,status:report.status,findings:report.findings.length,localModel:Boolean(localLayoutModelPort)});
      }
      if(localLayoutModelPort){
        const response=await fetch('http://127.0.0.1:'+localLayoutModelPort+'/v1/chat/completions',{method:'POST',redirect:'error',
          headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,model:'local-table-size-review'}),signal:AbortSignal.timeout(75_000)});
        res.writeHead(response.status,{'Content-Type':'application/json'});
        return res.end(await response.text());
      }
      const message=observed
        ?{content:JSON.stringify({message:paperEdgeFormat+' 종이 경계 확인 완료',sourceIds:[],operations:[]})}
        :{tool_calls:[{id:'inspect_paper_edges',type:'function',function:{name:'inspect_layout',arguments:'{}'}}]};
      res.setHeader('Content-Type','application/json');
      return res.end(JSON.stringify({choices:[{message}]}));
    }
    if(input.request==='조회 중 모델 수정 거절'){
      const [{id,editable}]=input.paragraphs;
      assert.equal(editable,false);
      const observed=messages.find(message=>message.role==='tool');
      const message=observed
        ?{content:JSON.stringify({message:'문서를 바꾸라고 요청하는 검수 응답',sourceIds:[],
          operations:[{kind:'replace_body_text',target:id,start:0,count:1,text:'변'}]})}
        :{tool_calls:[{id:'readonly_read',type:'function',function:{name:'read_paragraph',arguments:JSON.stringify({id})}}]};
      if(observed)assert.equal(JSON.parse(observed.content).editable,false);
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({choices:[{message}]}));
      return;
    }
    assert.deepEqual(tools.map(item=>item.function.name), ['read_paragraph','find_reference','inspect_layout']);
    const id = input.paragraphs.find(paragraph=>paragraph.editable).id;
    const observed = messages.find(message=>message.role==='tool');
    calls.push(observed ? 'tool-result' : 'initial');
    let message;
    if (!observed) {
      message = { tool_calls:[{id:'read_1',type:'function',function:{name:'read_paragraph',arguments:JSON.stringify({id})}}] };
    } else {
      assert.equal(observed.tool_call_id, 'read_1');
      assert.equal(JSON.parse(observed.content).text, '구 문서입니다.');
      message = {content:JSON.stringify({message:'첫 글자를 바꿨습니다.',sourceIds:[],operations:[{kind:'replace_body_text',target:id,start:0,count:1,text:'새'}]})};
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message}]}));
  } catch (error) { console.error('Fixture provider assertion:', error);res.writeHead(500);res.end(String(error)); }
});
await new Promise(done => provider.listen(0,'127.0.0.1',done));
const serverPath=resolve(repo,process.env.JUEONY_TEST_SERVER??'apps/launcher/server.mjs');
const host = spawn(process.execPath,[serverPath],{cwd:repo,windowsHide:true,stdio:'ignore',env:{
  ...process.env,JUEONY_PORT:String(port),JUEONY_DIST:dist,JUEONY_CONNECTION_STORE:'memory',JUEONY_REFERENCE_INDEX:':memory:',
}});
let browser;
const errors = [];
review: try {
  let healthy=false;
  for (let attempt=0; attempt<100; attempt++) {
    if (await fetch(`${origin}/api/health`).then(response=>response.ok,()=>false)) { healthy=true; break; }
    if (host.exitCode!==null) break;
    await new Promise(done=>setTimeout(done,100));
  }
  assert(healthy,`The standalone test launcher did not start on port ${port} (exit ${host.exitCode}).`);
  browser = await puppeteer.launch({executablePath:process.env.JUEONY_TEST_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless:true,userDataDir:await mkdtemp(resolve(out,'profile-')),args:['--disable-background-networking','--no-first-run']});
  const page = await browser.newPage();
  page.on('pageerror', error=>errors.push(String(error)));
  const externalRequests = [];
  page.on('request', request=>{
    const url = new URL(request.url());
    if (['http:','https:'].includes(url.protocol) && url.origin !== origin) externalRequests.push(url.origin);
  });
  await page.evaluateOnNewDocument(()=>{
    const request=window.fetch.bind(window);
    let config,authenticationStarted=false,attempt=0;
    window.reviewOAuth=[];
    window.fetch=async(path,options)=>{
      if(!window.reviewOAuthEnabled)return request(path,options);
      if(path==='/api/connections'){
        const data=await (await request(path,options)).json();
        data.geminiOAuth=true;
        if(attempt===2)data.connections.push({config,hasKey:true,remember:false,auth:'gemini-oauth'});
        return Response.json(data);
      }
      if(typeof path!=='string'||!path.startsWith('/api/gemini-oauth/'))return request(path,options);
      const input=JSON.parse(options.body);
      window.reviewOAuth.push({path,input});
      if(path.endsWith('/start')){
        config=input.config;authenticationStarted=true;
        return Response.json({id:'review-oauth',url:'https://accounts.google.com/o/oauth2/v2/auth?state=fixture'});
      }
      if(path.endsWith('/cancel')){authenticationStarted=false;return Response.json({cancelled:true});}
      if(!authenticationStarted)return Response.json({error:'인증을 다시 시작해 주세요.'},{status:400});
      attempt++;
      return Response.json(attempt===1?{status:'pending'}:{status:'connected',configId:config.id});
    };
  });
  await page.evaluateOnNewDocument(()=>{
    const interval=window.setInterval;
    window.setInterval=(callback,delay,...args)=>{
      if(delay===90000&&typeof callback==='function')window.refreshReferenceFixture=callback;
      return interval.call(window,callback,delay,...args);
    };
    if(location.pathname.endsWith('/print.html'))window.print=()=>{
      for(const image of document.images){
        const canvas=document.createElement('canvas');
        canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        canvas.getContext('2d').drawImage(image,0,0);
        image.src=canvas.toDataURL();
      }
      const captured=document.documentElement.cloneNode(true);
      for(const meta of captured.querySelectorAll('meta[http-equiv]'))meta.remove();
      window.parent.printCapture=`<!doctype html>${captured.outerHTML}`;
    };
  });
  await page.goto(origin);
  await page.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
  const fill = (name,value)=>page.$eval(`#${name}`,(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const initialFrame=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
  const originalWidth=await initialFrame.evaluate(()=>window.jueonyEditor.snapshot().structure.sections[0].page.width);
  await page.click('#document-defaults');await page.click('#defaults-enabled');
  await page.$eval('[data-default-field="widthMm"]',node=>{node.value='220';});
  await page.click('#defaults-form button[type=submit]');
  await page.waitForFunction(()=>!document.getElementById('defaults-dialog').open);
  const initialTabs=await page.$$eval('.document-tab',items=>items.length);
  await page.click('#new-document');
  await page.waitForFunction(count=>document.querySelectorAll('.document-tab').length===count+1,{},initialTabs);
  const defaultsFrame=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
  await defaultsFrame.waitForFunction(()=>{
    try{return window.jueonyEditor.snapshot().structure.sections.length===1;}catch{return false;}
  });
  assert.equal(await defaultsFrame.evaluate(()=>window.jueonyEditor.snapshot().structure.sections[0].page.width),Math.round(220*7200/25.4));
  await page.click('#document-defaults');await page.click('#reset-defaults');await page.click('#close-defaults');
  await page.click('.document-tab-wrap.is-active .close-tab');
  await page.waitForFunction(count=>document.getElementById('close-document').open||document.querySelectorAll('.document-tab').length===count,{},initialTabs);
  if(await page.$('#close-document[open]'))await page.click('#close-document button[value=discard]');
  await page.waitForFunction(count=>document.querySelectorAll('.document-tab').length===count,{},initialTabs);
  assert.equal(await initialFrame.evaluate(()=>window.jueonyEditor.snapshot().structure.sections[0].page.width),originalWidth);
  const preferenceProof='a stored new-document default was read at fresh editor boot and applied only to the new document';
  const makeIndexFixture=text=>{
    const doc=HwpDocument.createEmpty();
    try{doc.createBlankDocument();doc.insertText(0,0,0,text);return Array.from(doc.exportHwpx());}
    finally{doc.free();}
  };
  await page.evaluate(async bytes=>{
    const root=await navigator.storage.getDirectory();
    const folder=await root.getDirectoryHandle('reference-index-fixture',{create:true});
    const file=await folder.getFileHandle('sample.hwpx',{create:true});
    window.referenceFixtureHandle=file;
    window.pauseFolderListing=async()=>{
      const child=await folder.getDirectoryHandle('nested',{create:true});
      await child.getFileHandle('readme.txt',{create:true});
      const entries=folder.entries.bind(folder);
      const released=new Promise(resolve=>{window.releaseFolderListing=resolve;});
      Object.defineProperty(folder,'entries',{configurable:true,value:async function*(){
        delete folder.entries;
        window.folderListingStarted=true;
        try{await released;yield* entries();}
        finally{window.folderListingDone=true;}
      }});
    };
    window.writeReferenceFixture=async bytes=>{const writer=await file.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();};
    await window.writeReferenceFixture(bytes);
    const api=document.querySelector('.editor-frame:not([hidden])').contentWindow.jueonyEditor,original=api.readReferenceDetails;
    window.referenceFixtureParses=0;
    api.readReferenceDetails=(...args)=>{window.referenceFixtureParses++;return original.apply(api,args);};
    window.restoreReferenceFixtureParser=()=>{api.readReferenceDetails=original;};
    window.showDirectoryPicker=async()=>folder;
    if(typeof folder.queryPermission!=='function'||await folder.queryPermission({mode:'read'})!=='granted'){
      Object.defineProperty(FileSystemHandle.prototype,'queryPermission',{configurable:true,value:async()=> 'granted'});
    }
  },makeIndexFixture('이전 검색 자료'));
  await page.click('#add-folder');
  await page.waitForSelector('#folder-tree .folder-root input[type=checkbox]');
  await page.click('#ranked-search');
  await page.click('#folder-tree .folder-root input[type=checkbox]');
  async function refreshIndex(){
    const response=page.waitForResponse(item=>item.url().endsWith('/api/reference-index/search'));
    await page.evaluate(()=>window.refreshReferenceFixture());
    return (await response).json();
  }
  const firstIndex=await refreshIndex();assert.deepEqual([firstIndex.inserted,firstIndex.deleted],[1,0]);
  assert.equal(await page.evaluate(()=>window.referenceFixtureParses),1);
  assert.equal((await refreshIndex()).inserted,0);
  assert.equal(await page.evaluate(()=>window.referenceFixtureParses),1);
  await page.evaluate(async bytes=>window.writeReferenceFixture(bytes),makeIndexFixture('갱신한 검색 자료'));
  const changedIndex=await refreshIndex();assert.deepEqual([changedIndex.inserted,changedIndex.deleted],[1,1]);
  assert.equal(await page.evaluate(()=>window.referenceFixtureParses),2);
  const clearing=page.waitForResponse(item=>item.url().endsWith('/api/reference-index/clear'));
  await page.click('#folder-tree .folder-root input[type=checkbox]');
  assert.deepEqual(await (await clearing).json(),{cleared:true});
  await page.evaluate(()=>window.restoreReferenceFixtureParser());
  await page.click('#ranked-search');
  await page.evaluate(()=>window.pauseFolderListing());
  await page.click('.folder-root .folder-row button:first-of-type');
  await page.waitForFunction(()=>window.folderListingStarted);
  await page.evaluate(()=>{window.previousFolderTree=document.querySelector('.folder-root');});
  await page.click('#refresh-folders');
  await page.waitForFunction(()=>document.querySelector('.folder-root')!==window.previousFolderTree);
  await page.evaluate(()=>window.releaseFolderListing());
  await page.waitForFunction(()=>window.folderListingDone);
  assert.equal(await page.evaluate(()=>Boolean(window.previousFolderTree.querySelector('.file-label'))),false);
  await page.click('.folder-root .folder-row button:first-of-type');
  await page.waitForSelector('.file-label[title="reference-index-fixture/nested"]');
  await page.click('.file-label[title="reference-index-fixture/nested"]');
  const nestedReference=await page.waitForSelector('.file-label[title="reference-index-fixture/nested/readme.txt"]');
  await nestedReference.evaluate(label=>label.parentElement.querySelector('input[type=checkbox]').click());
  await page.waitForFunction(()=>document.getElementById('reference-summary').textContent.includes('nested/readme.txt'));
  await nestedReference.evaluate(label=>label.parentElement.querySelector('input[type=checkbox]').click());
  await page.waitForFunction(()=>!document.getElementById('reference-summary').textContent.includes('nested/readme.txt'));
  const referencePanelProof='refresh discarded a delayed directory listing; a new nested folder could be expanded, selected and deselected';
  await page.click('#retrieve-sources');
  async function verifyOpenWorkspaceReference(){
    const previousFrame=await page.$('.editor-frame:not([hidden])');
    const originalDisk=await page.evaluate(async()=>[...new Uint8Array(await (await window.referenceFixtureHandle.getFile()).arrayBuffer())]);
    await page.evaluate(()=>{
      const original=window.showOpenFilePicker;
      window.showOpenFilePicker=async()=>[window.referenceFixtureHandle];
      window.restoreReferenceFixturePicker=()=>{window.showOpenFilePicker=original;};
    });
    await page.click('#open-document');
    await page.waitForFunction(()=>document.querySelector('.document-tab-wrap.is-active .document-tab')?.textContent==='sample.hwpx');
    await page.evaluate(()=>window.restoreReferenceFixturePicker());
    const liveFrame=await(await page.$('.editor-frame:not([hidden])')).contentFrame();
    await liveFrame.waitForFunction(()=>{
      try{return Boolean(window.jueonyEditor.snapshot().nodes[0]?.id);}catch{return false;}
    });
    await liveFrame.evaluate(async()=>{
      const api=window.jueonyEditor,snapshot=api.snapshot(),paragraph=snapshot.nodes[0];
      await api.apply(crypto.randomUUID(),snapshot,{message:'로컬 검수',sourceIds:[],operations:[{
        kind:'replace_body_text',target:paragraph.id,start:0,count:Array.from(paragraph.text).length,text:'현재 열린 참고 문서의 미저장 내용',
      }]});
    });
    const label=await page.waitForSelector('.file-label[title="reference-index-fixture/sample.hwpx"]');
    await label.evaluate(node=>node.parentElement.querySelector('input[type=checkbox]').click());
    await page.waitForFunction(()=>document.getElementById('reference-summary').textContent.includes('sample.hwpx'));
    await fill('request-input','열린 참고 문서 판별');await page.click('#send-request');
    await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child')?.textContent.includes('열린 참고 문서의 최신 내용을 읽었습니다.')||document.querySelector('#request-error:not([hidden])'));
    assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
    await page.waitForSelector('#send-request:not([disabled])');
    assert(await liveFrame.evaluate(()=>window.jueonyEditor.state().dirty));
    assert.deepEqual(await page.evaluate(async()=>[...new Uint8Array(await (await window.referenceFixtureHandle.getFile()).arrayBuffer())]),originalDisk);
    await label.evaluate(node=>node.parentElement.querySelector('input[type=checkbox]').click());
    await page.waitForFunction(()=>!document.getElementById('reference-summary').textContent.includes('sample.hwpx'));
    await page.click('.document-tab-wrap.is-active .close-tab');
    await page.waitForSelector('#close-document[open]');
    await page.click('#close-document button[value=discard]');
    await page.waitForFunction(frame=>!frame.hidden,{},previousFrame);
    workspaceReferenceReaderProof={usedLatestUnsavedText:true,savedSourceBytesUnchanged:true,selectedOnlyOneReference:true};
    console.log('PASS the selected open reference used its latest unsaved text and preserved the saved source');
  }
  const frame = await (await page.$('.editor-frame:not([hidden])')).contentFrame();
  const fixture = (html) => {
    const doc = HwpDocument.createEmpty();
    try {
      doc.createBlankDocument();
      if (html) {
        doc.pasteHtml(0,0,0,'<p>안녕<span style="font-family: HY신명조">문서</span></p><table><tr><td>바깥<table><tr><td>안쪽</td></tr></table></td></tr></table>');
        doc.insertCommentAtCursorV1(0,0,1,'검토용 메모','검수자');
      }
      else doc.insertText(0,0,0,'구 문서입니다.');
      return Array.from(doc.exportHwpx());
    } finally { doc.free(); }
  };
  const open = (bytes, name) => frame.evaluate(async (bytes,name)=>{
    const dir=await navigator.storage.getDirectory(), file=await dir.getFileHandle(name,{create:true});
    const writer=await file.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();
    await window.jueonyEditor.open(new Uint8Array(bytes),name,file,false);
  },bytes,name);
  const before = () => frame.evaluate(()=>({state:window.jueonyEditor.state(),bytes:Array.from(window.jueonyEditor.recovery().bytes)}));
  const command = id => frame.evaluate(name=>window.jueonyEditor.executeCommand(name),id);
  await open(fixture(true),'audit.hwpx');
  const auditBefore=await before();
  assert.equal((await command('ext:jueony-administrative-audit')).ok,true);
  await frame.waitForFunction(()=>document.querySelector('#jueony-administrative-audit li button')?.textContent.includes('HY신명조'));
  await frame.click('#jueony-administrative-audit li button');
  await frame.waitForFunction(()=>!document.querySelector('#jueony-administrative-audit'));
  assert.deepEqual(await before(),auditBefore);
  assert.equal((await command('ext:jueony-layout-diagnostics')).ok,true);
  await frame.waitForFunction(()=>document.querySelector('#jueony-administrative-audit [role=status]')?.textContent.includes('글줄'));
  await frame.evaluate(()=>[...document.querySelectorAll('#jueony-administrative-audit button')].find(button=>button.textContent==='닫기').click());
  assert.deepEqual(await before(),auditBefore);
  assert.equal((await command('ext:jueony-read-memos')).ok,true);
  await frame.waitForFunction(()=>document.querySelector('#jueony-document-memos li p')?.textContent.includes('검토용 메모'));
  await frame.click('#jueony-document-memos li button');
  await frame.waitForFunction(()=>!document.querySelector('#jueony-document-memos'));
  assert.deepEqual(await before(),auditBefore);

  const memoir=HwpDocument.createEmpty();
  try {
    memoir.createBlankDocument();memoir.insertText(0,0,0,'메모의 본문은 유지합니다.');
    assert.equal(JSON.parse(memoir.insertCommentAtCursorV1(0,0,3,'이전 메모','검수자')).ok,true);
    await open(Array.from(memoir.exportHwpx()),'memo-actions.hwpx');
  } finally {memoir.free();}
  const memoDialog='#jueony-document-memos';
  const memoButton = label => frame.evaluate(text=>{
    const element=[...document.querySelectorAll('#jueony-document-memos button')].find(button=>button.textContent===text);
    if (!element) throw new Error('Memo button is missing: '+text);
    element.click();
  },label);
  assert.equal((await command('ext:jueony-read-memos')).ok,true);
  await memoButton('내용 편집');
  await frame.$eval(`${memoDialog} input`,field=>{field.value='고친 메모';field.dispatchEvent(new Event('input'));});
  await frame.click(`${memoDialog} button[type=submit]`);
  await frame.waitForFunction(()=>document.querySelector('#jueony-document-memos li p')?.textContent.includes('검수자 · 고친 메모'));
  await memoButton('닫기');
  const editedMemoBytes=await frame.evaluate(async()=>{
    const api=window.jueonyEditor,file=api.fileHandle();await api.save();
    return Array.from(new Uint8Array(await(await file.getFile()).arrayBuffer()));
  });
  const reopenedMemo=new HwpDocument(new Uint8Array(editedMemoBytes));
  try {
    const [record]=JSON.parse(reopenedMemo.getCommentListV1());
    assert.deepEqual([record.text,record.author,record.startCharIdx],['고친 메모','검수자',3]);
    assert.equal(reopenedMemo.getTextRange(0,0,0,reopenedMemo.getParagraphLength(0,0)),'메모의 본문은 유지합니다.');
  } finally {reopenedMemo.free();}
  assert.equal((await command('ext:jueony-read-memos')).ok,true);
  page.once('dialog',request=>void request.accept());
  await memoButton('삭제');
  await frame.waitForFunction(()=>document.querySelector('#jueony-document-memos [role=status]')?.textContent.includes('메모가 없습니다'));
  await memoButton('닫기');
  assert.equal((await command('edit:undo')).ok,true);
  assert.equal((await command('ext:jueony-read-memos')).ok,true);
  await frame.waitForFunction(()=>document.querySelector('#jueony-document-memos li p')?.textContent.includes('검수자 · 고친 메모'));
  await memoButton('닫기');

  await open(fixture(false),'tools.hwpx');
  await page.click('#connection-settings');await page.click('#new-connection');await page.select('#config-adapter','openai-compatible');
  await fill('config-label','검수 모의 모델');await fill('config-endpoint',`http://127.0.0.1:${provider.address().port}/v1`);
  await page.click('#discover-local-models');await page.waitForFunction(()=>document.querySelector('#local-model-options option')?.value==='fixture');
  await fill('config-model','fixture');await fill('config-key','fixture-only');await page.$eval('#config-remember',button=>button.checked=false);
  await page.click('#test-document-tools');
  await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('실제 조회 도구 호출을 반환했습니다'));
  await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
  if(process.env.JUEONY_TEST_WORKSPACE_REFERENCE_READER==='1')await verifyOpenWorkspaceReference();
  if(process.env.JUEONY_TEST_FOCUS==='workspace-reference-reader'){
    assert(workspaceReferenceReaderProof);
    assert.deepEqual(errors,[]);
    assert.deepEqual(externalRequests,[]);
    await writeFile(resolve(out,'result.json'),JSON.stringify({build:{customSourceSha256,engineWasmSha256},workspaceReferenceReader:workspaceReferenceReaderProof,errors,externalRequests},null,2));
    break review;
  }
  await page.click('#document-tool-mode');await page.click('#allow-window-edit');await fill('request-input','첫 글자를 고쳐줘');await page.click('#send-request');
  await page.waitForFunction(()=>document.getElementById('messages').textContent.includes('쪽 배치 1쪽'));
  const paragraph = () => frame.evaluate(()=>window.jueonyEditor.snapshot().nodes[0].text);
  assert.equal(await paragraph(),'새 문서입니다.');
  const saved = await frame.evaluate(async()=>{
    const file=window.jueonyEditor.fileHandle();await window.jueonyEditor.save();
    return Array.from(new Uint8Array(await(await file.getFile()).arrayBuffer()));
  });
  const reopened = new HwpDocument(new Uint8Array(saved));
  try { assert.equal(reopened.getTextRange(0,0,0,reopened.getParagraphLength(0,0)),'새 문서입니다.'); }
  finally { reopened.free(); }
  const buttons=await page.$$('.message-actions button');
  const undo=await Promise.all(buttons.map(button=>button.evaluate(el=>el.textContent)));
  await buttons[undo.lastIndexOf('요청 되돌리기')].click();
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
  assert.match(await page.$eval('#messages', node=>node.textContent),/되돌림 완료/u);
  assert.equal(await paragraph(),'구 문서입니다.');
  assert.deepEqual(calls,['initial','tool-result']);
  if(process.env.JUEONY_TEST_FOCUS==='workspace-run-history'){
    const originalChat=await page.$eval('#chat-list .chat-item.active',item=>item.textContent);
    await page.click('#add-chat');
    await page.waitForFunction(()=>document.querySelector('#chat-list .chat-item.active')?.textContent==='새 채팅');
    assert.doesNotMatch(await page.$eval('#messages',node=>node.textContent),/첫 글자를 고쳐줘|되돌림 완료/u);
    const persistedChat=await page.waitForFunction(async()=>{
      const state=await new Promise((resolve,reject)=>{
        const open=indexedDB.open('jueony-workspaces',1);
        open.onerror=()=>reject(open.error);
        open.onsuccess=()=>{
          const database=open.result;
          const read=database.transaction('state','readonly').objectStore('state').get('current');
          read.onerror=()=>{database.close();reject(read.error);};
          read.onsuccess=()=>{database.close();resolve(read.result);};
        };
      });
      const active=state?.workspaces.find(workspace=>workspace.id===state.activeWorkspaceId);
      return state?.chats.some(chat=>chat.id===active?.activeChatId&&chat.title==='새 채팅');
    });
    await persistedChat.dispose();
    await page.close();
    const restarted=await browser.newPage();
    restarted.on('pageerror',error=>errors.push(String(error)));
    restarted.on('request',request=>{
      const url=new URL(request.url());
      if(['http:','https:'].includes(url.protocol)&&url.origin!==origin)externalRequests.push(url.origin);
    });
    await restarted.goto(origin);
    await restarted.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
    assert.equal(await restarted.$eval('#chat-list .chat-item.active',item=>item.textContent),'새 채팅');
    assert.doesNotMatch(await restarted.$eval('#messages',node=>node.textContent),/첫 글자를 고쳐줘|되돌림 완료/u);
    await restarted.$$eval('#chat-list .chat-item',(items,title)=>items.find(item=>item.textContent===title).click(),originalChat);
    await restarted.waitForFunction(()=>document.getElementById('messages').textContent.includes('되돌림 완료'));
    assert.match(await restarted.$eval('#messages',node=>node.textContent),/첫 글자를 고쳐줘/u);
    assert.deepEqual(errors,[]);
    assert.deepEqual(externalRequests,[]);
    const workspaceRunHistory={documentEditSavedAndReopened:true,exactUndoRecorded:true,sameChatHistoryRestored:true,differentChatHistoryIsolated:true};
    await writeFile(resolve(out,'result.json'),JSON.stringify({build:{customSourceSha256,engineWasmSha256},workspaceReferenceReader:workspaceReferenceReaderProof,workspaceRunHistory,errors,externalRequests},null,2));
    console.log('PASS completed and undone run history survived reopening the editor and stayed in its owning chat');
    break review;
  }
  const beforeReadOnly=await frame.evaluate(()=>Array.from(window.jueonyEditor.recovery().bytes));
  assert.equal(await page.$eval('#allow-window-edit',input=>input.checked),false);
  await fill('request-input','조회 중 모델 수정 거절');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#request-error:not([hidden])')?.textContent.includes('변경을 적용하지 않았습니다'));
  assert.deepEqual(await frame.evaluate(()=>Array.from(window.jueonyEditor.recovery().bytes)),beforeReadOnly);
  readOnlyLookupProof='a valid checked edit was refused after a real read in the default lookup mode; the document stayed byte-exact';

  const paperFixture=HwpDocument.createEmpty();
  try{
    paperFixture.createBlankDocument();
    paperFixture.insertText(0,0,0,'본문 기준');
    paperFixture.splitParagraph(0,0,paperFixture.getParagraphLength(0,0));
    assert.equal(JSON.parse(paperFixture.createTable(0,1,0,2,2)).ok,true);
    paperFixture.insertTextInCell(0,1,0,0,0,0,'종이 옆의 글줄');
    assert.equal(JSON.parse(paperFixture.setTableProperties(0,1,0,JSON.stringify({horzOffset:55000}))).ok,true);
    for(const format of ['hwp','hwpx']){
      const sourceBytes=Array.from(format==='hwp'?paperFixture.exportHwp():paperFixture.exportHwpx());
      await open(sourceBytes,'paper-edges.'+format);
      const original=await before();
      const content=()=>frame.evaluate(()=>{
        const {revision,nodes,structure}=window.jueonyEditor.snapshot();
        return {revision,nodes,structure};
      });
      const originalContent=await content();
      assert.equal((await command('ext:jueony-layout-diagnostics')).ok,true);
      await frame.waitForFunction(()=>document.querySelector('#jueony-administrative-audit li button')?.textContent.includes('종이 경계'));
      assert.deepEqual(await before(),original);
      await frame.$eval('#jueony-administrative-audit[open] li button',button=>button.focus());
      await page.keyboard.press('Enter');
      await frame.waitForFunction(()=>!document.querySelector('#jueony-administrative-audit'));
      const position=await frame.evaluate(()=>{
        const automation=window.rhwpStudio.automation,id='ext:verify-paper-overflow-address';
        let cursor;
        automation.registerCommand({id,label:'검수',canExecute:()=>true,execute:services=>cursor=services.getInputHandler().getCursorPosition()});
        try{automation.execute(id);return cursor;}finally{automation.unregisterCommand(id);}
      });
      assert.equal(position.cellPath[0].cellIndex,0);
      assert.deepEqual(await content(),originalContent);
      const afterJump=await before();
      assert.deepEqual(afterJump.state,original.state);
      paperEdgeFormat=format;
      const expectedAnswer=localLayoutModelPort?'1쪽 · 표의 글줄이 종이 경계를 벗어납니다.':format+' 종이 경계 확인 완료';
      const answerCount=await page.$eval('#messages',(node,sample)=>node.textContent.split(sample).length,expectedAnswer);
      await fill('request-input',paperEdgeQuestion);await page.click('#send-request');
      await page.waitForFunction((sample,count)=>document.getElementById('messages').textContent.split(sample).length>count,{},expectedAnswer,answerCount);
      assert.deepEqual(await before(),afterJump);
      const disk=await frame.evaluate(async()=>Array.from(new Uint8Array(await(await window.jueonyEditor.fileHandle().getFile()).arrayBuffer())));
      assert.deepEqual(disk,sourceBytes);
    }
  }finally{paperFixture.free();}
  assert.equal(paperEdgeProof.length,2);
  await open(beforeReadOnly,'tools.hwpx');
  console.log('PASS both formats report the paper edge, navigate to the correct cell and expose a read-only AI finding');

  const word = resolve(out,'reference.docx'), pdf = resolve(out,'reference.pdf'), excel = resolve(out,'reference.xlsx');
  const spreadsheet='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const relationships='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const packageRelationships='http://schemas.openxmlformats.org/package/2006/relationships';
  const xlsx = Object.fromEntries(Object.entries({
    'xl/workbook.xml':`<workbook xmlns="${spreadsheet}" xmlns:r="${relationships}"><sheets><sheet name="예산" sheetId="1" r:id="rel1"/><sheet name="숨김" state="hidden" sheetId="2" r:id="rel2"/><sheet name="결산" sheetId="3" r:id="rel3"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${packageRelationships}"><Relationship Id="rel1" Type="${relationships}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rel2" Type="${relationships}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rel3" Type="${relationships}/worksheet" Target="worksheets/sheet3.xml"/></Relationships>`,
    'xl/sharedStrings.xml':`<sst xmlns="${spreadsheet}"><si><t>2026년</t></si></sst>`,
    'xl/worksheets/sheet1.xml':`<worksheet xmlns="${spreadsheet}"><sheetData><row r="2"><c r="A2" t="s"><v>0</v></c><c r="C2"><f>SUM(A1:B1)</f><v>12500</v></c><c r="D2" t="inlineStr"><is><r><t xml:space="preserve">검토 </t></r><r><t>예정</t></r></is></c></row></sheetData></worksheet>`,
    'xl/worksheets/sheet2.xml':`<worksheet xmlns="${spreadsheet}"><sheetData><row><c t="inlineStr"><is><t>숨긴 원문</t></is></c></row></sheetData></worksheet>`,
    'xl/worksheets/sheet3.xml':`<worksheet xmlns="${spreadsheet}"><sheetData><row r="2"><c r="C2"><v>9999</v></c></row></sheetData></worksheet>`,
  }).map(([name,text])=>[name,strToU8(text)]));
  await writeFile(excel,zipSync(xlsx));
  await writeFile(word, zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>본문</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>열 A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>열 B</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')}));
  let pdfText='%PDF-1.4\n';
  const stream='BT /F1 12 Tf 20 80 Td (Budget fixture) Tj ET\n';
  const offsets=['0000000000 65535 f '];
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 160] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}endstream`];
  objects.forEach((body,i)=>{offsets.push(String(pdfText.length).padStart(10,'0')+' 00000 n ');pdfText+=`${i+1} 0 obj\n${body}\nendobj\n`;});
  const xref=pdfText.length;
  const pdfBytes=pdfText+`xref\n0 ${offsets.length}\n${offsets.join('\n')}\ntrailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  await writeFile(pdf,pdfBytes);
  const choosing=page.waitForFileChooser();await page.click('#attach-reference');await (await choosing).accept([word,pdf,excel]);
  await page.click('#document-tool-mode');await fill('request-input','세 참고 문서 확인');await page.click('#send-request');
  await page.waitForFunction(()=>document.getElementById('messages').textContent.includes('파일 세 개를 읽었습니다.'));
  assert.equal(officeProof.length,1);
  await page.waitForSelector('#send-request:not([disabled])');
  const excelBytes=await readFile(excel);
  await page.evaluate(()=>{
    const card=document.querySelector('#messages .assistant:last-child');
    for(const details of card.querySelectorAll('details'))details.open=true;
    [...card.querySelectorAll('details button')].find(button=>button.textContent==='예산 · C2').click();
  });
  await page.waitForSelector('#spreadsheet-citation-dialog[open]').catch(async cause=>{
    const message=await page.$eval('#app-status',node=>node.textContent);
    throw new Error(`The spreadsheet citation did not open: ${message}`,{cause});
  });
  assert.equal(await page.$eval('#spreadsheet-citation-file',node=>node.textContent),'reference.xlsx');
  assert.equal(await page.$eval('#spreadsheet-citation-address',node=>node.textContent),'예산 · C2');
  assert.equal(await page.$eval('#spreadsheet-citation-value',node=>node.textContent),'12500');
  await page.click('#spreadsheet-citation-dialog button');
  assert.deepEqual(await readFile(excel),excelBytes);
  officeProof.push('opened the cited spreadsheet cell by sheet name and address and displayed the cached value without changing the workbook');

  if(localOfficeModelPort){
    const original=await before();
    const assistant='#messages .assistant:not(.pending)';
    const oldCount=(await page.$$(assistant)).length;
    await page.click('#document-tool-mode');
    const observed=page.waitForRequest(request=>{
      if(request.url()!==origin+'/api/document-tool-turn')return false;
      const {input}=JSON.parse(request.postData());
      return input?.request===excelLookupQuestion&&input.turns?.length>0;
    },{timeout:105_000});
    await fill('request-input',excelLookupQuestion);await page.click('#send-request');
    const replied=page.waitForFunction((selector,count)=>{
      const replies=[...document.querySelectorAll(selector)];
      return replies.length>count;
    },{timeout:105_000},assistant,oldCount);
    const [lookup]=await Promise.all([observed,replied]);
    const {input:{turns}}=JSON.parse(lookup.postData());
    const [{call,result}]=turns.flat();
    assert.deepEqual([call.name,JSON.parse(call.arguments).query],['find_reference','예산 시트 C2']);
    const [hit]=JSON.parse(result);
    assert.equal(hit.name,'reference.xlsx');
    assert.equal(hit.text,'C2=12500');
    assert.deepEqual(hit.locations,[{start:0,end:8,address:{kind:'xlsx',sheet:'예산',cell:'C2'}}]);
    officeLocalProof.push({source:hit.name,sheet:'예산',cell:'C2',storedValue:12500,lookupOffset:0,realModelToolCall:true});
    const response=await page.$$eval(assistant,replies=>replies.at(-1).children[1].textContent);
    assert.match(response,/12[,]?500/u);
    assert.equal(officeLocalProof.length,1);
    await page.evaluate(selector=>{
      const card=[...document.querySelectorAll(selector)].at(-1);
      for(const details of card.querySelectorAll('details'))details.open=true;
      const cited=[...card.querySelectorAll('details button')].find(button=>button.textContent==='예산 · C2');
      if(!cited)throw new Error('The local model did not cite the verified Excel cell.');
      cited.click();
    },assistant);
    await page.waitForSelector('#spreadsheet-citation-dialog[open]');
    assert.equal(await page.$eval('#spreadsheet-citation-value',node=>node.textContent),'12500');
    await page.click('#spreadsheet-citation-dialog button');
    assert.deepEqual(await readFile(excel),excelBytes);
    assert.deepEqual(await before(),original);
    await page.click('#document-tool-mode');
    console.log('PASS the real local model quoted the correct Excel sheet when the same cell address had a different value elsewhere');
  }

  if(process.env.JUEONY_TEST_OFFICE_TEXT==='1'){
    assert.ok(localOfficeModelPort,'The exact passage review requires the real local model.');
    await page.click('#document-tool-mode');
    const original=await before();
    for(const entry of officeTextRequests){
      const sourcePath=entry.address.kind==='pdf'?pdf:word;
      const bytes=await readFile(sourcePath);
      const assistant='#messages .assistant:not(.pending)';
      const oldCount=(await page.$$(assistant)).length;
      const observed=page.waitForRequest(request=>{
        if(request.url()!==origin+'/api/document-tool-turn')return false;
        const {input}=JSON.parse(request.postData());
        return input?.request===entry.request&&input.turns?.length>0;
      },{timeout:105_000});
      await fill('request-input',entry.request);await page.click('#send-request');
      const replied=page.waitForFunction((selector,count)=>document.querySelectorAll(selector).length>count,
        {timeout:105_000},assistant,oldCount);
      const [lookup]=await Promise.all([observed,replied]);
      const {input:{turns}}=JSON.parse(lookup.postData());
      const [{call,result}]=turns.flat();
      assert.equal(call.name,'find_reference');
      assert.deepEqual(parseOfficeTextQuery(JSON.parse(call.arguments).query),parseOfficeTextQuery(entry.query));
      const [hit]=JSON.parse(result);
      assert.equal(hit.name,entry.file);
      assert.equal(hit.text,entry.text);
      assert.deepEqual(hit.locations,[{start:0,end:entry.text.length,address:entry.address}]);
      const answer=await page.$$eval(assistant,replies=>replies.at(-1).children[1].textContent);
      assert.equal(answer.split('\n\n',1)[0],entry.text);
      await page.evaluate((selector,label)=>{
        const card=[...document.querySelectorAll(selector)].at(-1);
        for(const details of card.querySelectorAll('details'))details.open=true;
        const cited=[...card.querySelectorAll('details button')].find(button=>button.textContent===label);
        if(!cited)throw new Error('The local model reply is missing the typed source location.');
        cited.click();
      },assistant,entry.label);
      await page.waitForSelector('#spreadsheet-citation-dialog[open]');
      assert.equal(await page.$eval('#spreadsheet-citation-file',node=>node.textContent),entry.file);
      assert.equal(await page.$eval('#spreadsheet-citation-value',node=>node.textContent),entry.text);
      await page.click('#spreadsheet-citation-dialog button');
      assert.deepEqual(await readFile(sourcePath),bytes);
      assert.deepEqual(await before(),original);
      officeLocalProof.push({source:hit.name,address:entry.address,quotedText:entry.text,realModelToolCall:true});
    }
    await page.click('#document-tool-mode');
    console.log('PASS the real local model selected and quoted a verified PDF page and Word paragraph');
  }

  const citation = resolve(out,'citation.hwpx');
  const citationDocument=HwpDocument.createEmpty();
  try{
    citationDocument.createBlankDocument();
    const title='2026년 인용 예산';
    citationDocument.insertText(0,0,0,title);
    const table=JSON.parse(citationDocument.createTable(0,0,Array.from(title).length,2,2));
    for(const [i,text] of ['단위 천원','사업비','총액','12,500'].entries()){
      citationDocument.insertTextInCell(0,table.paraIdx,table.controlIdx,i,0,0,text);
    }
    await writeFile(citation,citationDocument.exportHwpx());
  }finally{citationDocument.free();}
  const citationBytes=await readFile(citation);
  const chooseCitation=page.waitForFileChooser();
  await page.click('#attach-reference');await (await chooseCitation).accept([citation]);
  await page.click('#retrieve-sources');
  await fill('request-input','인용 예산의 총액과 단위');await page.click('#send-request');
  await page.waitForFunction(()=>document.getElementById('messages').textContent.includes('총액 12,500천원'));
  await page.evaluate(()=>{
    const card=[...document.querySelectorAll('#messages .assistant')].find(node=>node.textContent.includes('총액 12,500천원'));
    for(const details of card.querySelectorAll('details'))details.open=true;
    [...card.querySelectorAll('details button')].find(button=>button.textContent.includes('2행 2열')).click();
  });
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('인용한 원본의 확인용 사본'));
  const citationFrame=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
  const citationPosition=await citationFrame.evaluate(()=>{
    const adapter=window.rhwpStudio.automation;
    let position;
    const id='ext:test-reference-position';
    adapter.registerCommand({id,label:'검수',canExecute:()=>true,execute:services=>{position=services.getInputHandler().getCursorPosition();}});
    try{adapter.execute(id);}
    finally{adapter.unregisterCommand(id);}
    return {bound:Boolean(window.jueonyEditor.fileHandle()),state:window.jueonyEditor.state(),cell:position.cellPath.at(-1)};
  });
  assert.equal(citationPosition.state.name,'citation.hwpx');
  assert.equal(citationPosition.state.dirty,false);
  assert.equal(citationPosition.bound,false);
  assert.equal(citationPosition.cell.cellIndex,3);
  assert.deepEqual(await readFile(citation),citationBytes);
  await page.click('.document-tab-wrap.is-active .close-tab');
  await page.waitForFunction(()=>document.querySelector('.document-tab[aria-selected=true]')?.textContent==='tools.hwpx');
  officeProof.push('Preserved spreadsheet cell addresses and verified HWPX source reopened and jumped to the cited total without changing the source');

  const nestedCitation=resolve(out,'nested-citation.hwpx');
  const nestedCitationDoc=HwpDocument.createEmpty();
  try{
    nestedCitationDoc.createBlankDocument();
    nestedCitationDoc.pasteHtml(0,0,0,'<table><tr><td>중첩 예산표<table><tr><td>장비</td><td>장비 총액 3,250천원</td></tr><tr><td>공통 배정액 700천원</td><td>공통 배정액 700천원</td></tr></table></td></tr></table>');
    await writeFile(nestedCitation,nestedCitationDoc.exportHwpx());
  }finally{nestedCitationDoc.free();}
  const nestedCitationBytes=await readFile(nestedCitation);
  const chooseNestedCitation=page.waitForFileChooser();
  await page.click('#attach-reference');await (await chooseNestedCitation).accept([nestedCitation]);
  await fill('request-input','중첩 예산표의 장비 총액 확인');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child')?.textContent.includes('중첩 장비 총액 3,250천원')||document.querySelector('#request-error:not([hidden])'));
  assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
  for(const [address,cellIndex] of [['1행 2열',1],['2행 1열',2],['2행 2열',3]]){
    await page.evaluate(address=>{
      const card=document.querySelector('#messages .assistant:last-child');
      for(const details of card.querySelectorAll('details'))details.open=true;
      const status=document.getElementById('app-status');
      window.nestedCitationOpened=false;
      const completed=new MutationObserver(()=>{
        if(status.textContent.includes('인용한 원본의 확인용 사본')){
          window.nestedCitationOpened=true;
          completed.disconnect();
        }
      });
      completed.observe(status,{childList:true});
      [...card.querySelectorAll('details button')].find(button=>button.textContent.includes('중첩 표')&&button.textContent.includes(` ${address} · 셀 문단`)).click();
    },address);
    await page.waitForFunction(()=>window.nestedCitationOpened&&document.querySelector('.document-tab[aria-selected=true]')?.textContent==='nested-citation.hwpx').catch(async error=>{
      throw new Error(`${address}: ${await page.$eval('#app-status',node=>node.textContent)}`,{cause:error});
    });
    const nestedCitationFrame=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
    const nestedCitationPath=await nestedCitationFrame.evaluate(()=>{
      let path;
      const id='ext:test-nested-reference-position',adapter=window.rhwpStudio.automation;
      adapter.registerCommand({id,label:'검수',canExecute:()=>true,execute:services=>{path=services.getInputHandler().getCursorPosition().cellPath;}});
      try{adapter.execute(id);}finally{adapter.unregisterCommand(id);}
      return path.map(step=>step.cellIndex);
    });
    assert.deepEqual(nestedCitationPath,[0,cellIndex]);
    await page.click('.document-tab-wrap.is-active .close-tab');
    await page.waitForFunction(()=>document.querySelector('.document-tab[aria-selected=true]')?.textContent==='tools.hwpx');
  }
  assert.deepEqual(await readFile(nestedCitation),nestedCitationBytes);
  await page.click('#retrieve-sources');
  officeProof.push('a cited HWPX total and two identical amounts jumped to each exact nested cell with source bytes unchanged');

  const reviewSnapshot=()=>frame.evaluate(()=>Array.from(window.jueonyEditor.recovery().bytes));
  const originalReviewDocument=await reviewSnapshot();
  for(const approved of [false,true]){
    await fill('request-input','참고자료 확인 요청의 본문 제안');await page.click('#send-request');
    await page.waitForSelector('#reference-change-review[open]');
    assert.match(await page.$eval('#reference-change-sources',node=>node.textContent),/nested-citation.hwpx/u);
    assert.match(await page.$eval('#reference-change-operations',node=>node.textContent),/변경 전\s*구\s*변경 후\s*새/u);
    assert.deepEqual(await reviewSnapshot(),originalReviewDocument);
    if(approved)await page.click('#reference-change-apply');
    else await page.keyboard.press('Escape');
    await page.waitForSelector('#send-request:not([disabled])');
    if(approved)assert.equal(await paragraph(),'새 문서입니다.');
    else assert.deepEqual(await reviewSnapshot(),originalReviewDocument);
  }
  await page.evaluate(()=>[...document.querySelectorAll('#messages .assistant:last-child button')].find(button=>button.textContent==='요청 되돌리기').click());
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
  assert.deepEqual(await reviewSnapshot(),originalReviewDocument);
  await open(Array.from(nestedCitationBytes),'reference-review-nested.hwpx');
  const originalNestedReview=await reviewSnapshot();
  await fill('request-input','참고자료 확인 요청의 중첩 셀 제안');await page.click('#send-request');
  await page.waitForSelector('#reference-change-review[open]');
  assert.match(await page.$eval('#reference-change-operations strong',node=>node.textContent),/중첩 표.*1행 2열/u);
  assert.match(await page.$eval('#reference-change-operations pre',node=>node.textContent),/변경 전\s*장비 총액 3,250천원\s*변경 후\s*장비 총액 4,500천원/u);
  assert.deepEqual(await reviewSnapshot(),originalNestedReview);
  await page.click('#reference-change-cancel');
  await page.waitForSelector('#send-request:not([disabled])');
  assert.deepEqual(await reviewSnapshot(),originalNestedReview);
  assert.deepEqual(await readFile(nestedCitation),nestedCitationBytes);
  referenceReviewProof='a reference-fed chat response with no citations waited for review; Escape preserved bytes, approval applied the previewed edit, and one undo restored the original';

  for(const format of ['hwp','hwpx']){
    const document=new HwpDocument(new Uint8Array(citationBytes));
    try{await open(Array.from(format==='hwp'?document.exportHwp():document.exportHwpx()),`reference-structure.${format}`);}
    finally{document.free();}
    const base=await frame.evaluate(()=>window.jueonyEditor.snapshot().structure);
    const original=await reviewSnapshot(),table=base.tables[0];
    assert.notEqual(base.sections[0].page.marginTop,Math.round(22*7200/25.4));
    for(const approve of [false,true]){
      await fill('request-input','참고자료 확인 요청의 행과 위 여백 제안');await page.click('#send-request');
      await page.waitForSelector('#reference-change-review[open]');
      const operations=await page.$eval('#reference-change-operations',node=>node.textContent);
      assert.match(operations,new RegExp(`${table.rows+1}행 위치에 한 행 삽입`,'u'));
      assert.match(operations,/위 여백 22 mm/u);
      assert.doesNotMatch(operations,/insert_table_row|set_page_setup|marginTopMm/u);
      const preview=await page.$eval('#reference-change-structure-items',node=>node.textContent);
      assert.match(preview,new RegExp(`${table.rows}행 × ${table.columns}열 → ${table.rows+1}행 × ${table.columns}열`,'u'));
      assert.match(preview,/위 여백 [\d.]+ → 22 mm/u);
      assert.deepEqual(await reviewSnapshot(),original);
      if(format==='hwpx'&&approve)await page.screenshot({path:resolve(out,'reference-structure-preview.png')});
      await page.click(approve?'#reference-change-apply':'#reference-change-cancel');
      await page.waitForSelector('#send-request:not([disabled])');
      if(!approve){assert.deepEqual(await reviewSnapshot(),original);continue;}
      const final=await frame.evaluate(()=>window.jueonyEditor.snapshot().structure);
      assert.equal(final.tables[0].rows,table.rows+1);
      assert.equal(final.tables[0].cells.find(cell=>cell.row===table.rows&&cell.column===0).text,'추가 1');
      assert.equal(final.sections[0].page.marginTop,Math.round(22*7200/25.4));
      const saved=await frame.evaluate(async()=>{
        const api=window.jueonyEditor, status=await api.save();
        return {status,bytes:Array.from(new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer()))};
      });
      assert.equal(saved.status,'saved');
      const reopened=new HwpDocument(new Uint8Array(saved.bytes));
      try{assert.equal(JSON.parse(reopened.getPageDef(0)).marginTop,Math.round(22*7200/25.4));}
      finally{reopened.free();}
      await page.evaluate(()=>[...document.querySelectorAll('#messages .assistant:last-child button')].find(button=>button.textContent==='요청 되돌리기').click());
      await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'),{polling:100});
      assert.deepEqual(await reviewSnapshot(),original);
    }
  }
  referenceReviewProof+='; both HWP and HWPX verified the inserted row and millimeter change before approval, preserved bytes on cancel, saved the approved copy and undid one request';
  console.log('PASS reference-fed structural preview, cancel and single undo in HWP and HWPX');
  await page.evaluate(()=>[...document.querySelectorAll('.attachment-chip')].forEach(chip=>chip.click()));

  await open(Array.from(citationBytes),'macro-table.hwpx');
  await fill('request-input','기존 표의 금액을 반복 작업으로');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child')?.textContent.includes('표 금액 변수'));
  page.once('dialog',dialog=>dialog.accept('검수용 표 금액'));
  await page.evaluate(()=>{
    const card=[...document.querySelectorAll('#messages .assistant')].find(node=>node.textContent.includes('표 금액 변수'));
    [...card.querySelectorAll('button')].find(button=>button.textContent==='반복 작업으로 저장').click();
  });
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업에 저장'));
  await page.evaluate(()=>{
    const card=[...document.querySelectorAll('#messages .assistant')].find(node=>node.textContent.includes('표 금액 변수'));
    [...card.querySelectorAll('button')].find(button=>button.textContent==='요청 되돌리기').click();
  });
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
  await page.click('#macro-manager');await page.click('#macro-list .macro-row button:first-of-type');
  const tableOption=await page.$eval('#macro-tables select',select=>[...select.options].at(1).value);
  await page.select('#macro-tables select',tableOption);
  await page.type('#macro-variables input','18,750');
  await page.click('#macro-parameters-form button[type=submit]');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업을 실행했습니다'));
  const savedTotal=await frame.evaluate(async()=>{
    const api=window.jueonyEditor,cell=api.snapshot().structure.tables[0].cells[3];
    if(cell.text!=='18,750')throw new Error('Repeated value was not applied');
    const result=await api.save();
    const file=await api.fileHandle().getFile();
    return {result,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
  });
  assert.equal(savedTotal.result,'saved');
  const macroSaved=new HwpDocument(new Uint8Array(savedTotal.bytes));
  try{assert.match(JSON.parse(macroSaved.getTextFileUnicode()),/18,750/u);}finally{macroSaved.free();}
  assert.equal(macroProof.length,1);
  macroProof.push('replayed from the chosen table with a new variable and saved/reopened without another model call');
  if(process.env.JUEONY_TEST_FOCUS==='workspace-macro-library'){
    const firstWorkspace=await page.$eval('#workspace-select',select=>select.value);
    const newName='이름을 바꾼 표 금액 작업';
    const legacyName='기존 본문 반복 작업 검수';
    const otherName='반복 작업 격리 검수';
    const list='#macro-list';
    const actOnMacro=(target,name,label)=>target.$$eval('#macro-list .macro-row',(rows,name,label)=>{
      const row=rows.find(item=>item.querySelector('strong')?.textContent===name);
      const button=[...row.querySelectorAll('button')].find(item=>item.textContent===label);
      button.click();
    },name,label);
    const names=target=>target.$$eval('#macro-list .macro-row strong',items=>items.map(item=>item.textContent));
    const waitForStoredWorkspace=async(target,workspaceId)=>{
      const ready=await target.waitForFunction(async id=>{
        const state=await new Promise((resolve,reject)=>{
          const open=indexedDB.open('jueony-workspaces',1);
          open.onerror=()=>reject(open.error);
          open.onsuccess=()=>{
            const database=open.result;
            const read=database.transaction('state','readonly').objectStore('state').get('current');
            read.onerror=()=>{database.close();reject(read.error);};
            read.onsuccess=()=>{database.close();resolve(read.result);};
          };
        });
        return state?.activeWorkspaceId===id;
      },{polling:100},workspaceId);
      await ready.dispose();
    };
    const addObservers=target=>{
      target.on('pageerror',error=>errors.push(String(error)));
      target.on('request',request=>{
        const url=new URL(request.url());
        if(['http:','https:'].includes(url.protocol)&&url.origin!==origin)externalRequests.push(url.origin);
      });
    };
    const reopen=async current=>{
      await current.close();
      const fresh=await browser.newPage();
      addObservers(fresh);
      await fresh.goto(origin);
      await fresh.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료'));
      return fresh;
    };
    page.once('dialog',dialog=>dialog.accept(legacyName));
    await page.$$eval('#messages .assistant',cards=>{
      const earlier=cards.find(card=>card.textContent.includes('첫 글자를 바꿨습니다.'));
      [...earlier.querySelectorAll('button')].find(button=>button.textContent==='반복 작업으로 저장').click();
    });
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업에 저장'));
    await page.click('#macro-manager');
    page.once('dialog',dialog=>dialog.accept(newName));
    await actOnMacro(page,'검수용 표 금액','이름');
    await page.waitForFunction(name=>document.querySelector('#macro-list .macro-row strong')?.textContent===name,{},newName);
    const renamed=await reopen(page);
    await renamed.click('#macro-manager');
    assert.deepEqual(await names(renamed),[newName,legacyName]);
    await renamed.click('#close-macros');
    renamed.once('dialog',dialog=>dialog.accept(otherName));
    await renamed.click('#add-workspace');
    await renamed.waitForFunction(name=>document.querySelector('#workspace-select').selectedOptions[0]?.textContent===name,{},otherName);
    await renamed.waitForSelector('.editor-frame:not([hidden])');
    await renamed.click('#macro-manager');
    assert.equal(await renamed.$(`${list} .macro-row`),null);
    await renamed.click('#close-macros');
    const otherWorkspace=await renamed.$eval('#workspace-select',select=>select.value);
    await waitForStoredWorkspace(renamed,otherWorkspace);
    const returned=await reopen(renamed);
    assert.equal(await returned.$eval('#workspace-select',select=>select.value),otherWorkspace);
    await returned.select('#workspace-select',firstWorkspace);
    await waitForStoredWorkspace(returned,firstWorkspace);
    await returned.click('#macro-manager');
    assert.deepEqual(await names(returned),[newName,legacyName]);
    await actOnMacro(returned,newName,'삭제');
    await returned.waitForFunction(name=>[...document.querySelectorAll('#macro-list .macro-row strong')]
      .every(item=>item.textContent!==name),{},newName);
    const deleted=await reopen(returned);
    await deleted.click('#macro-manager');
    assert.deepEqual(await names(deleted),[legacyName]);
    await deleted.click('#close-macros');
    const legacyFrame=await (await deleted.$('.editor-frame:not([hidden])')).contentFrame();
    await legacyFrame.evaluate(bytes=>window.jueonyEditor.open(new Uint8Array(bytes),'legacy-macro-source.hwpx'),fixture(false));
    await deleted.click('#macro-manager');
    await actOnMacro(deleted,legacyName,'실행');
    await deleted.click('#macro-parameters-form button[type=submit]');
    await deleted.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업을 실행했습니다'));
    assert.equal(await legacyFrame.evaluate(()=>window.jueonyEditor.snapshot().nodes[0].text),'새 문서입니다.');
    assert.deepEqual(errors,[]);
    assert.deepEqual(externalRequests,[]);
    const macroLibrary={createdFromAiEdit:true,replayedAndSaved:true,renameSurvivesReopen:true,workspaceIsolation:true,
      deleteSurvivesReopen:true,legacyBodyMacroReplayed:true};
    await writeFile(resolve(out,'result.json'),JSON.stringify({build:{customSourceSha256,engineWasmSha256},macroLibrary,errors,externalRequests},null,2));
    console.log('PASS macro library: save, replay, rename, workspace isolation and durable removal');
    break review;
  }

  const nestedOriginal=fixture(true);
  await open(nestedOriginal,'macro-nested.hwpx');
  const nestedSnapshot=()=>frame.evaluate(()=>window.jueonyEditor.snapshot());
  const nestedBase=await nestedSnapshot();
  const nestedTarget=nestedBase.structure.nestedTables[0].id;
  assert.match(nestedBase.nestedTableTemplateEvidence[nestedTarget],/^[a-f0-9]{64}$/u);
  await fill('request-input','중첩 표의 값을 반복 작업으로');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child')?.textContent.includes('중첩 표 값 변수'));
  page.once('dialog',dialog=>dialog.accept('검수용 중첩 표'));
  const nestedAction=label=>page.evaluate(label=>{
    const card=[...document.querySelectorAll('#messages .assistant')].find(node=>node.textContent.includes('중첩 표 값 변수'));
    [...card.querySelectorAll('button')].find(button=>button.textContent===label).click();
  },label);
  await nestedAction('변경 확인');
  await page.waitForSelector('#change-dialog[open]');
  assert.match(await page.$eval('#structure-diff-text',node=>node.textContent),/번째 셀의 중첩 표.+내용 1셀.+1행 1열/u);
  assert.match(await page.$eval('#structure-diff-text',node=>node.textContent),/1행 1열 “안쪽” → “\{\{안쪽값\}\}”/u);
  assert.equal(await page.$eval('#structure-diff',node=>node.open),true);
  await page.screenshot({path:resolve(out,'table-cell-receipt.png')});
  macroProof.push('the applied nested cell receipt displayed the exact old and new values at the correct location');
  await page.click('#change-dialog button');
  await nestedAction('반복 작업으로 저장');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업에 저장'));
  await nestedAction('요청 되돌리기');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
  assert.equal((await nestedSnapshot()).structure.nestedTables[0].cells[0].text,'안쪽');
  await page.click('#macro-manager');
  await page.evaluate(()=>{
    const row=[...document.querySelectorAll('#macro-list .macro-row')].find(item=>item.querySelector('strong').textContent==='검수용 중첩 표');
    row.querySelector('button').click();
  });
  const nestedOptions=await page.$eval('#macro-tables select',select=>({label:select.getAttribute('aria-label'),values:[...select.options].map(option=>option.value)}));
  assert.match(nestedOptions.label,/중첩 표/u);
  assert.deepEqual(nestedOptions.values,['',nestedTarget]);
  await page.select('#macro-tables select',nestedTarget);
  await page.type('#macro-variables input','안쪽 최종값');
  await page.click('#macro-parameters-form button[type=submit]');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업을 실행했습니다'));
  const nestedOutput=await frame.evaluate(async()=>{
    const api=window.jueonyEditor;
    const result=await api.save();
    const file=await api.fileHandle().getFile();
    return {result,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
  });
  assert.equal(nestedOutput.result,'saved');
  await open(nestedOutput.bytes,'macro-nested-reopened.hwpx');
  const nestedReopened=await nestedSnapshot();
  assert.equal(nestedReopened.structure.nestedTables[0].cells[0].text,'안쪽 최종값');
  assert.deepEqual(nestedReopened.structure.tables,nestedBase.structure.tables);
  macroProof.push('saved a nested plain-cell request, chose the exact table, and reopened the new value with the enclosing table preserved');

  if(localNestedMacroPort)for(const format of ['hwp','hwpx']){
    const doc=new HwpDocument(new Uint8Array(nestedOriginal));
    try{await open([...doc[format==='hwp'?'exportHwp':'exportHwpx']()],`local-macro-nested.${format}`);}finally{doc.free();}
    const snapshot=await nestedSnapshot(),original=(await before()).bytes;
    const [table]=snapshot.structure.nestedTables;
    const cell=table.cells.find(cell=>cell.row===0&&cell.column===0);
    assert.equal(cell.editable,true);
    expectedNestedOperation={kind:'set_table_cell',target:table.id,row:0,column:0,originalText:cell.text,text:'{{업무값}}'};
    const callCount=localNestedMacroCalls;
    const result=page.waitForResponse(response=>response.url()===origin+'/api/generate');
    await fill('request-input',localNestedQuestion);await page.click('#send-request');
    await result;await page.waitForSelector('#send-request:not([disabled])');
    assert.equal(localNestedMacroCalls,callCount+1);
    assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
    assert.equal((await nestedSnapshot()).structure.nestedTables[0].cells[cell.index].text,'{{업무값}}');
    const requestAction=label=>page.evaluate(label=>{
      const card=document.querySelector('#messages .assistant:last-child');
      [...card.querySelectorAll('button')].find(button=>button.textContent===label).click();
    },label);
    const macroName=`로컬 AI 중첩 표 검수 ${format}`;
    page.once('dialog',dialog=>dialog.accept(macroName));
    await requestAction('반복 작업으로 저장');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업에 저장'));
    await requestAction('요청 되돌리기');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
    assert.deepEqual((await before()).bytes,original);
    await page.click('#macro-manager');
    await page.evaluate(name=>{
      const row=[...document.querySelectorAll('#macro-list .macro-row')].find(item=>item.querySelector('strong').textContent===name);
      row.querySelector('button').click();
    },macroName);
    await page.select('#macro-tables select',table.id);
    await page.type('#macro-variables input','반복 실행한 중첩 값');
    await page.click('#macro-parameters-form button[type=submit]');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업을 실행했습니다'));
    assert.equal(localNestedMacroCalls,callCount+1);
    const saved=await frame.evaluate(async()=>{
      const api=window.jueonyEditor;
      if(await api.save()!=='saved')throw new Error('The local nested table macro output was not saved');
      return [...new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer())];
    });
    await writeFile(resolve(out,`local-nested-macro.${format}`),new Uint8Array(saved));
    await open(saved,`local-macro-nested-reopened.${format}`);
    const reopened=await nestedSnapshot();
    assert.deepEqual(reopened.structure.tables,snapshot.structure.tables);
    assert.deepEqual(reopened.structure.nestedTables[0].cells.map(item=>item.text),table.cells.map(item=>item.index===cell.index?'반복 실행한 중첩 값':item.text));
    localNestedMacroProof.push({format,realModel:true,replayWithoutModel:true,undoByteExact:true,savedAndReopened:true});
  }

  const nestedAxisCases=[{format:'hwpx',axis:'행',position:1,side:'뒤'}];
  if(localNestedAxisMacroPort)nestedAxisCases.push(
    {format:'hwp',axis:'행',position:1,side:'앞'},
    {format:'hwp',axis:'열',position:2,side:'뒤'},
    {format:'hwpx',axis:'열',position:1,side:'앞'},
  );
  if(localNestedAxisMacroPort&&process.env.JUEONY_TEST_AXIS_DELETION==='1')nestedAxisCases.push(
    {format:'hwp',axis:'행',position:1,remove:true,plainContainer:true},
    {format:'hwp',axis:'열',position:2,remove:true},
    {format:'hwpx',axis:'행',position:2,remove:true},
    {format:'hwpx',axis:'열',position:1,remove:true},
    {format:'hwp',axis:'행',position:1,remove:true,verifyOwnerReflow:true},
  );
  for(const {format,axis,position,side,remove,plainContainer,verifyOwnerReflow} of nestedAxisCases){
    const isRow=axis==='행';
    const kind=`${remove?'delete':'insert'}_table_${isRow?'row':'column'}`;
    const index=remove||side==='앞'?position-1:position;
    const filename=`nested-${verifyOwnerReflow?'owner-reflow-':''}${remove?'delete-':''}${isRow?'row':'column'}-${index}.${format}`;
    const values=isRow?['{{추가값}}','합계']:['{{추가값}}'];
    const top=['안쪽','보존 셀'],bottom=['둘째 행 왼쪽','둘째 행 오른쪽'];
    const expectedTexts=variable=>{
      if(remove)return isRow?[top,bottom][1-index]:[top[1-index],bottom[1-index]];
      const texts=[...top];
      texts.splice(isRow?index*2:index,0,...values.map(value=>value==='{{추가값}}'?variable:value));
      return texts;
    };
    const doc=HwpDocument.createEmpty();
    try{
      doc.createBlankDocument();
      const tableRow=values=>`<tr>${values.map(value=>`<td>${value}</td>`).join('')}</tr>`;
      doc.pasteHtml(0,0,0,`<table><tr><td>${plainContainer?'':'바깥'}<table>${tableRow(top)}${remove?tableRow(bottom):''}</table></td></tr></table>`);
      await open([...doc[format==='hwp'?'exportHwp':'exportHwpx']()],filename);
    }finally{doc.free();}
    const base=(await nestedSnapshot()).structure,[table]=base.nestedTables;
    assert.equal(table.axisEditable,true);
    const original=await before(),expectedCalls=localNestedAxisMacroCalls+Number(Boolean(localNestedAxisMacroPort));
    expectedNestedAxisOperation={kind,target:table.id,index,...(remove?{}:{values})};
    localNestedAxisQuestion=remove?`유일한 중첩 표의 ${position}${axis}을 삭제해 주세요.`
      :`유일한 중첩 표의 ${position}${axis} ${side}에 ${JSON.stringify(values)} ${axis}을 추가해 주세요.`;
    const response=page.waitForResponse(response=>response.url()===origin+'/api/generate');
    await fill('request-input',localNestedAxisMacroPort?localNestedAxisQuestion:'중첩 표에 입력 행을 반복 작업으로');
    await page.click('#send-request');
    await response;
    await page.waitForSelector('#send-request:not([disabled])');
    assert.equal(localNestedAxisMacroCalls,expectedCalls);
    assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
    assert.deepEqual((await nestedSnapshot()).structure.nestedTables[0].cells.map(cell=>cell.text),expectedTexts('{{추가값}}'));

    const requestAction=label=>page.evaluate(label=>{
      const card=document.querySelector('#messages .assistant:last-child');
      [...card.querySelectorAll('button')].find(button=>button.textContent===label).click();
    },label);
    const macroName=`검수용 중첩 표 ${axis} ${remove?'삭제':'추가'} ${format}${verifyOwnerReflow?' 바깥 문장 포함':''}`;
    page.once('dialog',dialog=>dialog.accept(macroName));
    await requestAction('반복 작업으로 저장');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업에 저장'));
    await requestAction('요청 되돌리기');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
    assert.deepEqual((await before()).bytes,original.bytes);
    await page.click('#macro-manager');
    await page.evaluate(name=>{
      const row=[...document.querySelectorAll('#macro-list .macro-row')].find(item=>item.querySelector('strong').textContent===name);
      row.querySelector('button').click();
    },macroName);
    await page.select('#macro-tables select',table.id);
    const replacement=`새 ${axis} 보존값`;
    if(remove)assert.equal(await page.$('#macro-variables input'),null);
    else await page.type('#macro-variables input',replacement);
    await page.click('#macro-parameters-form button[type=submit]');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업을 실행했습니다'));
    assert.equal(localNestedAxisMacroCalls,expectedCalls);
    const saved=await frame.evaluate(async()=>{
      const api=window.jueonyEditor;
      if(await api.save()!=='saved')throw new Error('The nested table macro output was not saved');
      return [...new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer())];
    });
    await open(saved,`reopened-${filename}`);
    const reopened=(await nestedSnapshot()).structure;
    assert.deepEqual(reopened.nestedTables[0].cells.map(cell=>cell.text),expectedTexts(replacement));
    assert.deepEqual([reopened.nestedTables[0].rows,reopened.nestedTables[0].columns],remove?(isRow?[1,2]:[2,1]):(isRow?[2,2]:[1,3]));
    assert.equal(reopened.tables[0].cells[0].text,base.tables[0].cells[0].text);
    if(localNestedAxisMacroPort){
      await writeFile(resolve(out,filename),new Uint8Array(saved));
      localNestedAxisMacroProof.push({format,realModel:true,kind,index,replayWithoutModel:true,undoByteExact:true,savedAndReopened:true,
        ...(verifyOwnerReflow?{outerCellTextPreserved:true}:{})});
      console.log(`PASS real model, macro replay, exact undo and native save for ${kind} in ${format}`);
    }
  }
  macroProof.push('the model recorded a nested table insertion, which replayed with a new variable and preserved the outer cell on reopen');
  if(process.env.JUEONY_TEST_FOCUS==='nested-axis-macro'){
    assert.equal(localNestedAxisMacroProof.length,nestedAxisCases.length);
    assert.deepEqual(errors,[]);
    assert.deepEqual(externalRequests,[]);
    await writeFile(resolve(out,'result.json'),JSON.stringify({build:{customSourceSha256,engineWasmSha256},localNestedAxisMacro:localNestedAxisMacroProof,errors,externalRequests},null,2));
    break review;
  }

  const shapeDoc=HwpDocument.createEmpty();
  let shapeBytes,shapeHwpBytes;
  try{
    shapeDoc.createBlankDocument();shapeDoc.insertText(0,0,0,'도형 배치 원문');
    shapeDoc.createShapeControl(JSON.stringify({sectionIdx:0,paraIdx:0,charOffset:0,shapeType:'rectangle',width:6000,height:3500}));
    shapeBytes=Array.from(shapeDoc.exportHwpx());
    if(localShapeMacroPort)shapeHwpBytes=Array.from(shapeDoc.exportHwp());
  }finally{shapeDoc.free();}
  await open(shapeBytes,'macro-shape.hwpx');
  const readShapeColors=()=>frame.evaluate(()=>Object.values(window.jueonyEditor.snapshot().shapeFillSources).map(source=>source.color));
  const initialShapeColors=await readShapeColors();
  const shapeControl=await frame.evaluate(()=>Object.values(window.jueonyEditor.snapshot().shapeFillSources)[0].control+1);
  const shapeReference=page.waitForFileChooser();
  await page.click('#attach-reference');await (await shapeReference).accept([nestedCitation]);
  await page.waitForFunction(()=>document.querySelector('#reference-summary').textContent.includes('nested-citation.hwpx'));
  await fill('request-input','첫 도형의 채우기를 업무 색으로 바꾸기');await page.click('#send-request');
  await page.waitForSelector('#reference-change-review[open]');
  assert.equal(await page.$eval('#reference-change-operations strong',node=>node.textContent),`1구역 1문단 도형 (개체 ${shapeControl}번) · 채우기`);
  assert.equal(await page.$eval('#reference-change-operations pre',node=>node.textContent),`변경 전\n${initialShapeColors[0]}\n\n변경 후\n#336699`);
  assert.deepEqual(await readShapeColors(),initialShapeColors);
  await page.click('#reference-change-apply');
  await page.waitForSelector('#send-request:not([disabled])');
  await page.evaluate(()=>[...document.querySelectorAll('.attachment-chip')].forEach(chip=>chip.click()));
  referenceReviewProof+='; nested cells showed the owner and exact old and new values, and shape fill showed both colors before explicit approval';
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child .message-actions, #request-error:not([hidden])'));
  assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
  assert.deepEqual(await readShapeColors(),['#336699']);
  const shapeAction=label=>page.evaluate(label=>{
    const card=[...document.querySelectorAll('#messages .assistant')].find(item=>item.textContent.includes('도형 채우기 변경'));
    [...card.querySelectorAll('button')].find(button=>button.textContent===label).click();
  },label);
  await shapeAction('변경 확인');
  assert.match(await page.$eval('#structure-diff-text',node=>node.textContent),/도형 \(개체 \d+번\) · 채우기 #ffffff → #336699/u);
  assert.equal(await page.$eval('#diff-body',node=>node.hidden),true);
  await page.click('#change-dialog button');
  page.once('dialog',dialog=>dialog.accept('검수용 도형 채우기'));
  await shapeAction('반복 작업으로 저장');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업에 저장'));
  await shapeAction('요청 되돌리기');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
  assert.deepEqual(await readShapeColors(),['#ffffff']);
  await page.click('#macro-manager');
  await page.evaluate(()=>{
    const row=[...document.querySelectorAll('#macro-list .macro-row')].find(item=>item.querySelector('strong').textContent==='검수용 도형 채우기');
    row.querySelector('button').click();
  });
  const shapeOptions=await page.$eval('#macro-shapes select',select=>[...select.options].map(option=>option.value));
  assert.equal(shapeOptions.length,2);
  await page.select('#macro-shapes select',shapeOptions[1]);
  await page.click('#macro-parameters-form button[type=submit]');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업을 실행했습니다'));
  assert.deepEqual(await readShapeColors(),['#336699']);
  const shapeSaved=await frame.evaluate(async()=>{
    const api=window.jueonyEditor;
    if(await api.save()!=='saved')throw Error('Shape output could not be saved');
    return Array.from(new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer()));
  });
  await open(shapeSaved,'macro-shape-reopened.hwpx');
  assert.deepEqual(await readShapeColors(),['#336699']);
  macroProof.push('a plain body shape color was proposed, verified, recorded with an explicit equivalent target, replayed and reopened');

  if(localShapeMacroPort)for(const [format,bytes] of [['hwp',shapeHwpBytes],['hwpx',shapeBytes]]){
    await open(bytes,`local-macro-shape.${format}`);
    const snapshot=await nestedSnapshot(),original=(await before()).bytes;
    const [[target,source]]=Object.entries(snapshot.shapeFillSources);
    expectedShapeOperation={kind:'set_shape_fill',target,originalFingerprint:source.fingerprint,color:'#3478ab'};
    const historyStart=localShapeMacroCalls;
    const result=page.waitForResponse(response=>response.url()===origin+'/api/generate');
    await fill('request-input',localShapeQuestion);await page.click('#send-request');
    await result;
    await page.waitForSelector('#send-request:not([disabled])');
    assert.equal(localShapeMacroCalls,historyStart+1);
    assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
    assert.deepEqual(await readShapeColors(),['#3478ab']);
    assert.deepEqual((await nestedSnapshot()).nodes,snapshot.nodes);
    const requestAction=label=>page.evaluate(label=>{
      const card=document.querySelector('#messages .assistant:last-child');
      [...card.querySelectorAll('button')].find(button=>button.textContent===label).click();
    },label);
    const macroName=`로컬 AI 도형 검수 ${format}`;
    page.once('dialog',dialog=>dialog.accept(macroName));
    await requestAction('반복 작업으로 저장');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업에 저장'));
    await requestAction('요청 되돌리기');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('되돌렸습니다'));
    assert.deepEqual((await before()).bytes,original);
    await page.click('#macro-manager');
    await page.evaluate(name=>{
      const row=[...document.querySelectorAll('#macro-list .macro-row')].find(item=>item.querySelector('strong').textContent===name);
      row.querySelector('button').click();
    },macroName);
    assert.deepEqual(await page.$eval('#macro-shapes select',select=>[...select.options].map(option=>option.value)),['',target]);
    await page.select('#macro-shapes select',target);
    await page.click('#macro-parameters-form button[type=submit]');
    await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('반복 작업을 실행했습니다'));
    assert.equal(localShapeMacroCalls,historyStart+1);
    const saved=await frame.evaluate(async()=>{
      const api=window.jueonyEditor;
      if(await api.save()!=='saved')throw new Error('The local shape macro output was not saved');
      return [...new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer())];
    });
    await writeFile(resolve(out,`local-shape-macro.${format}`),new Uint8Array(saved));
    await open(saved,`local-macro-shape-reopened.${format}`);
    assert.deepEqual(await readShapeColors(),['#3478ab']);
    assert.deepEqual((await nestedSnapshot()).nodes,snapshot.nodes);
    localShapeMacroProof.push({format,realModel:true,replayWithoutModel:true,undoByteExact:true,savedAndReopened:true});
  }

  await open(fixture(false),'manual-align.hwpx');
  const originalManual=(await before()).bytes;
  const paragraphAlignment=()=>frame.evaluate(()=>window.jueonyEditor.snapshot().structure.paragraphs[0].paragraph.alignment);
  const originalAlignment=await paragraphAlignment();
  await page.click('#macro-manager');await page.click('#start-alignment-macro');
  await page.waitForFunction(()=>document.getElementById('macro-manager').textContent==='편집 기록 중');
  await page.bringToFront();await frame.evaluate(()=>window.jueonyEditor.focusEditor());
  await page.keyboard.down('Control');await page.keyboard.down('Shift');
  try{await page.keyboard.press('KeyC');}
  finally{await page.keyboard.up('Shift');await page.keyboard.up('Control');}
  assert.equal(await paragraphAlignment(),'center');
  assert.equal((await command('format:align-right')).ok,true);
  assert.equal(await paragraphAlignment(),'right');
  await page.click('#macro-manager');await page.click('#finish-alignment-macro');
  await page.waitForFunction(()=>document.getElementById('alignment-macro-status').textContent.includes('2개'));
  await page.waitForSelector('#alignment-library select option');
  const macroJson=await page.evaluate(async()=>{
    const nativeClick=HTMLAnchorElement.prototype.click,createObjectURL=URL.createObjectURL;
    let exported,name;
    URL.createObjectURL=function(blob){exported=blob;return createObjectURL.call(this,blob);};
    HTMLAnchorElement.prototype.click=function(){
      name=this.download;
    };
    try{document.getElementById('export-alignment-macro').click();return {name,text:await exported.text()};}
    finally{HTMLAnchorElement.prototype.click=nativeClick;URL.createObjectURL=createObjectURL;}
  });
  assert.equal(macroJson.name,'jueony-paragraph-alignment.json');
  const portableMacro=JSON.parse(macroJson.text);
  assert.match(portableMacro.recordedFrom.documentIdentity,/^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(portableMacro.steps.map(step=>step.commandId),['format:align-center','format:align-right']);
  assert.doesNotMatch(macroJson.text,/구 문서입니다|manual-align\.hwpx/u);
  await page.click('#close-macros');
  assert.equal((await command('edit:undo')).ok,true);
  assert.equal((await command('edit:undo')).ok,true);
  assert.equal(await paragraphAlignment(),originalAlignment);
  await page.click('#macro-manager');await page.click('#replay-alignment-macro');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('문단 정렬 매크로를 재생'));
  assert.equal(await paragraphAlignment(),'right');
  assert.equal((await command('edit:undo')).ok,true);
  assert.equal(await paragraphAlignment(),originalAlignment);
  macroProof.push('a trusted keyboard shortcut and a manual menu command were recorded once through the same dispatcher, exported without body text, and replayed in one undo');

  const importMacroPath=resolve(out,'paragraph-alignment.json');
  await writeFile(importMacroPath,macroJson.text);
  const acceptMacro=async path=>{
    const selected=page.waitForFileChooser();
    await page.click('#import-alignment-macro');
    await (await selected).accept([path]);
  };
  await open(fixture(true),'different-align.hwpx');
  const unrelated=await before();
  await page.click('#macro-manager');await acceptMacro(importMacroPath);
  await page.waitForFunction(()=>document.getElementById('alignment-macro-status').textContent.includes('일치해야'));
  assert.deepEqual(await before(),unrelated);
  await page.click('#close-macros');
  await open(originalManual,'manual-align-reopened.hwpx');
  const reopenedManual=await before();
  const otherCommand=structuredClone(portableMacro);
  otherCommand.steps[0].commandId='file:save';
  const rejectedMacroPath=resolve(out,'rejected-alignment.json');
  await writeFile(rejectedMacroPath,JSON.stringify(otherCommand));
  await page.click('#macro-manager');await acceptMacro(rejectedMacroPath);
  await page.waitForFunction(()=>/등록|실행 가능한/u.test(document.getElementById('alignment-macro-status').textContent));
  assert.deepEqual(await before(),reopenedManual);
  await acceptMacro(importMacroPath);
  await page.waitForFunction(()=>document.getElementById('alignment-macro-status').textContent.includes('2개'));
  await page.click('#replay-alignment-macro');
  await page.waitForFunction(()=>document.getElementById('app-status').textContent.includes('문단 정렬 매크로를 재생'));
  assert.equal(await paragraphAlignment(),'right');
  assert.equal((await command('edit:undo')).ok,true);
  assert.deepEqual((await before()).bytes,reopenedManual.bytes);
  macroProof.push('the JSON refused unrelated bytes and file commands, then replayed in a newly reopened matching document');

  await open(originalManual,'manual-align-agent.hwpx');
  const agentAlignmentBefore=await before();
  const sendSavedAlignment=async()=>{
    await page.click('#macro-manager');await page.click('#load-alignment-record');
    await page.waitForFunction(()=>!document.getElementById('agent-alignment-macro').disabled&&document.getElementById('alignment-macro-status').textContent.includes('2개'));
    await page.click('#agent-alignment-macro');
    assert.equal(await page.$eval('#request-input',input=>input.value),'불러온 정렬 기록 적용');
    const assistantCount=await page.$$eval('#messages .assistant:not(.pending)',nodes=>nodes.length);
    await page.click('#send-request');
    await page.waitForFunction(count=>(document.querySelectorAll('#messages .assistant:not(.pending)').length>count||document.querySelector('#request-error:not([hidden])'))&&!document.getElementById('send-request').disabled,{},assistantCount);
  };
  await sendSavedAlignment();
  assert.match(await page.$eval('#request-error',node=>node.textContent),/다른 편집을 제안/u);
  assert.deepEqual(await before(),agentAlignmentBefore);
  await sendSavedAlignment();
  assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
  assert.equal(await paragraphAlignment(),'right');
  assert.equal((await command('edit:undo')).ok,true);
  assert.deepEqual((await before()).bytes,agentAlignmentBefore.bytes);
  assert.equal(alignmentAgentCalls,2);
  macroProof.push('the chat sent only the selected stored alignment plan, rejected a changed command, then applied the exact plan as one undo');

  const revokedFile=resolve(out,'revoked-reference.txt');
  await writeFile(revokedFile,'자료 안 문장은 실행 권한이 없습니다.');
  const chooseRevoked=page.waitForFileChooser();
  await page.click('#attach-reference');await (await chooseRevoked).accept([revokedFile]);
  const beforeRevoke=await before();
  await fill('request-input','첨부가 해제되기 전 시작된 요청');await page.click('#send-request');
  let reachTimer;
  try{
    await Promise.race([lateReferenceReached,new Promise((_,reject)=>{reachTimer=setTimeout(()=>reject(new Error('Mock did not receive selected reference')),8000);})]);
  }finally{clearTimeout(reachTimer);}
  await page.evaluate(()=>[...document.querySelectorAll('.attachment-chip')].find(chip=>chip.textContent.startsWith('revoked-reference.txt'))?.click());
  releaseLateReference();
  await page.waitForSelector('#send-request:not([disabled])');
  assert.doesNotMatch(await page.$eval('#messages .assistant:last-child',node=>node.textContent),/늦은 편집 제안/);
  assert.deepEqual(await before(),beforeRevoke);
  revokedReferenceProof='removing a temporary reference cancelled an in-flight lexical request before a late proposal could edit';

  const styleDoc=HwpDocument.createEmpty();
  let styleBytes;
  try{
    styleDoc.createBlankDocument();styleDoc.insertText(0,0,0,'가😀나다라');
    styleDoc.splitParagraph(0,0,5);styleDoc.insertText(0,1,0,'표본');
    styleDoc.applyCharFormat(0,1,0,2,JSON.stringify({bold:true,fontSize:1800,textColor:'#225588'}));
    const shape=JSON.parse(styleDoc.getCharPropertiesAt(0,1,0)).charShapeId;
    styleDoc.createStyle(JSON.stringify({name:'업무 강조',englishName:'WorkEmphasis',type:1,nextStyleId:0,baseCharShapeId:shape}));
    styleDoc.deleteParagraph(0,1);
    styleBytes=Array.from(styleDoc.exportHwpx());
  }finally{styleDoc.free();}
  await open(styleBytes,'stored-character-style.hwpx');
  await fill('request-input','첫 본문의 이모지와 다음 글자에 업무 강조 적용');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child .message-actions, #request-error:not([hidden])'));
  const styleError=await page.$eval('#request-error',node=>node.hidden?'':node.textContent);
  assert.equal(styleError,'');
  const appliedStyle=await page.$eval('#messages .assistant:last-child',card=>card.textContent);
  assert.match(appliedStyle,/2번째부터 2자 · 글자 스타일 업무 강조/u);
  const styleSaved=await frame.evaluate(async()=>{
    const api=window.jueonyEditor,result=await api.save();
    const file=await api.fileHandle().getFile();
    return {result,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
  });
  assert.equal(styleSaved.result,'saved');
  const storedStyle=new HwpDocument(new Uint8Array(styleSaved.bytes));
  try{
    const style=JSON.parse(storedStyle.getStyleList()).find(item=>item.name==='업무 강조');
    const applied=Array.from({length:5},(_,offset)=>JSON.parse(storedStyle.getCharPropertiesAt(0,0,offset)).charShapeId===style.charShapeId);
    assert.deepEqual(applied,[false,true,true,false,false]);
    storedStyleProof='provider-applied stored character style persisted only on the two cited Unicode characters';
  }finally{storedStyle.free();}

  const galleryFixture=new HwpDocument(new Uint8Array(fixture(false)));
  let galleryPackage;
  try{
    galleryPackage=exportStylePackage(galleryFixture,[0]);
    Object.assign(galleryPackage.styles[0],{name:'기관 제목',englishName:'AgencyHeading'});
  }finally{galleryFixture.free();}
  const galleryProfile={format:'jueony-style-gallery-profile',version:1,id:'completion.review',name:'검증 프로필',organization:'Jueony 검증',
    gallery:[{id:'heading',label:'기관 제목 묶음',package:galleryPackage}],shortcuts:[{slot:0,styleName:'기관 제목'}]};
  await open(fixture(false),'style-gallery.hwpx');
  const clickFrameButton=label=>frame.evaluate(text=>{
    const button=[...document.querySelectorAll('dialog[open] button,#jueony-title button')].find(item=>item.textContent===text);
    if(!button)throw Error('Missing button: '+text);
    button.click();
  },label);
  await clickFrameButton('스타일마당 JSON');
  await frame.$eval('dialog[open] textarea',(area,text)=>{area.value=text;},JSON.stringify(galleryProfile));
  await clickFrameButton('검증 후 가져오기');
  assert.match(await frame.$eval('dialog[open] [role=status]',status=>status.textContent),/프로필을 가져왔습니다/);
  await clickFrameButton('닫기');
  const styleMenu='[data-cmd="format:apply-style-gallery"]';
  await frame.waitForSelector(styleMenu);
  await frame.$eval(styleMenu,entry=>entry.click());
  await frame.waitForSelector('.jueony-style-gallery-dialog[open]');
  assert.match(await frame.$eval('.jueony-style-gallery-dialog [role=status]',status=>status.textContent),/1개 · Ctrl\+1 기관 제목/u);
  await clickFrameButton('현재 문서에 적용');
  await frame.waitForSelector('.jueony-style-gallery-dialog[open]',{hidden:true,timeout:5000});
  const styleAt=()=>frame.evaluate(()=>window.jueonyEditor.snapshot().structure.paragraphs[0].style);
  await frame.evaluate(()=>window.jueonyEditor.focusEditor());
  await page.keyboard.down('Control');await page.keyboard.press('1');await page.keyboard.up('Control');
  assert.equal((await styleAt()).name,'기관 제목');
  assert.equal((await command('edit:undo')).ok,true);
  assert.notEqual((await styleAt()).name,'기관 제목');
  await fill('request-input','첫 문단에 기관 제목 스타일 적용');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child .message-actions, #request-error:not([hidden])'));
  assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
  assert.equal((await styleAt()).name,'기관 제목');
  const gallerySaved=await frame.evaluate(async()=>{
    const api=window.jueonyEditor;
    if(await api.save()!=='saved')throw Error('Gallery HWPX could not be saved');
    return Array.from(new Uint8Array(await (await api.fileHandle().getFile()).arrayBuffer()));
  });
  const galleryReopened=new HwpDocument(new Uint8Array(gallerySaved));
  try{assert.equal(JSON.parse(galleryReopened.getStyleAt(0,0)).name,'기관 제목');}
  finally{galleryReopened.free();}
  styleGalleryProof='portable profile imported from the product UI; format menu preview and binding, number shortcut, AI paragraph styling, and saved HWPX reopen';

  assert.equal((await command('format:style-package')).ok,true);
  await frame.waitForSelector('[data-jueony-style-package]');
  const styleDownload=await frame.evaluate(async()=>{
    const dialog=document.querySelector('[data-jueony-style-package]');
    for(const check of dialog.querySelectorAll('input[type=checkbox]'))check.checked=check.getAttribute('aria-label')==='내보낼 스타일 기관 제목';
    const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
    let bytes,name;
    URL.createObjectURL=function(blob){bytes=blob;return create.call(this,blob);};
    HTMLAnchorElement.prototype.click=function(){name=this.download;};
    try{
      [...dialog.querySelectorAll('button')].find(button=>button.textContent==='선택 스타일 내보내기').click();
      return {name,text:await bytes.text()};
    }finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}
  });
  assert.equal(styleDownload.name,'jueony-styles.json');
  assert(JSON.parse(styleDownload.text).styles.some(style=>style.name==='기관 제목'));
  await frame.click('.modal-overlay .dialog-btn:not(.dialog-btn-primary)');
  const stylePath=resolve(out,'imported-styles.json');
  await writeFile(stylePath,styleDownload.text);
  await open(fixture(false),'style-package-import.hwpx');
  assert.equal((await command('format:style-package')).ok,true);
  const stylePicker=await frame.waitForSelector('[data-jueony-style-package] input[type=file]');
  await stylePicker.uploadFile(stylePath);
  await frame.waitForFunction(()=>document.querySelector('[data-jueony-style-package] textarea').value.length>100);
  await frame.click('.modal-overlay .dialog-btn-primary');
  await frame.waitForSelector('[data-jueony-style-package]',{hidden:true});
  assert.notEqual((await styleAt()).name,'기관 제목');
  await fill('request-input','첫 문단에 기관 제목 스타일 적용');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child .message-actions, #request-error:not([hidden])'));
  assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
  assert.equal((await styleAt()).name,'기관 제목');
  styleGalleryProof+='; the separate JSON style export and import dialog supplied an AI-applied stored style in a fresh document';

  const borderFixture=new HwpDocument(new Uint8Array(fixture(false)));
  let borderBytes;
  try{
    const baseline=JSON.parse(borderFixture.getPageBorderFillEntry(0,'both'));
    borderFixture.setPageBorderFillEntry(0,'both',JSON.stringify({...baseline,basis:'page',headerInside:false,
      footerInside:true,fillType:'solid',fillColor:'#fff2cc'}));
    borderBytes=Array.from(borderFixture.exportHwpx());
  }finally{borderFixture.free();}
  await open(borderBytes,'border-inclusion.hwpx');
  const inclusion=()=>frame.evaluate(()=>window.jueonyEditor.snapshot().structure.sections[0].pageBorderInclusion);
  const beforeInclusion=await inclusion();
  await fill('request-input','이 구역 쪽 테두리에 머리말만 포함');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child .message-actions, #request-error:not([hidden])'));
  assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
  const afterInclusion=await inclusion();
  assert.deepEqual(afterInclusion.entries,beforeInclusion.entries.map(value=>({...value,headerInside:true,footerInside:false})));
  await page.evaluate(()=>[...document.querySelectorAll('#messages .assistant:last-child button')].find(button=>button.textContent==='변경 확인').click());
  assert.match(await page.$eval('#change-dialog',dialog=>dialog.textContent),/쪽 테두리 머리말·꼬리말 포함/);
  await page.click('#change-dialog button');
  assert.equal((await command('edit:undo')).ok,true);
  assert.deepEqual(await inclusion(),beforeInclusion);
  assert.equal((await command('edit:redo')).ok,true);
  assert.deepEqual(await inclusion(),afterInclusion);
  borderInclusionProof='model changed named header and footer inclusion flags on all three parity layouts; change receipt and request undo/redo confirmed';

  const scopedBorder=new HwpDocument(new Uint8Array(borderBytes));
  let scopedBorderBytes;
  try{
    for(let section=0;section<3;section++){
      if(section)scopedBorder.insertSectionBreak(section-1,0,scopedBorder.getParagraphLength(section-1,0));
      if(section)scopedBorder.insertText(section,0,0,`${section+1}구역 원문`);
      scopedBorder.setPageDef(section,JSON.stringify({marginLeft:8504+section*320}));
      const original=JSON.parse(scopedBorder.getPageBorderFillEntry(section,'both'));
      scopedBorder.setPageBorderFillEntry(section,'both',JSON.stringify({...original,basis:'page',headerInside:false,
        footerInside:false,fillType:'solid',fillColor:['#fff2cc','#bbccdd','#efe9ed'][section]}));
    }
    scopedBorderBytes=Array.from(scopedBorder.exportHwpx());
  }finally{scopedBorder.free();}
  await open(scopedBorderBytes,'border-inclusion-sections.hwpx');
  const scopedSections=()=>frame.evaluate(()=>window.jueonyEditor.snapshot().structure.sections);
  const originalScope=await scopedSections();
  const readScopeFlags=async flag=>(await scopedSections()).map(section=>section.pageBorderInclusion.entries.map(entry=>entry[flag]));
  for(const [request,message,flag,expected] of [
    ['첫째와 셋째 구역의 쪽 테두리에 머리말 포함','선택 구역 머리말 포함','headerInside',[true,false,true]],
    ['모든 구역의 쪽 테두리에 꼬리말 포함','전체 구역 꼬리말 포함','footerInside',[true,true,true]],
  ]){
    await fill('request-input',request);await page.click('#send-request');
    await page.waitForFunction(message=>document.querySelector('#messages .assistant:last-child')?.textContent.includes(message)||document.querySelector('#request-error:not([hidden])'),{},message);
    assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
    await page.waitForSelector('#send-request:not([disabled])');
    assert.deepEqual(await readScopeFlags(flag),expected.map(value=>[value,value,value]));
  }
  const scopedSaved=await frame.evaluate(async()=>{
    const api=window.jueonyEditor,result=await api.save();
    return {result,bytes:Array.from(new Uint8Array(await(await api.fileHandle().getFile()).arrayBuffer()))};
  });
  assert.equal(scopedSaved.result,'saved');
  const loadedBorder=new HwpDocument(new Uint8Array(scopedSaved.bytes));
  try{
    for(const [section,fillColor] of ['#fff2cc','#bbccdd','#efe9ed'].entries()){
      for(const kind of ['both','even','odd']){
        const settings=JSON.parse(loadedBorder.getPageBorderFillEntry(section,kind));
        assert.deepEqual([settings.fillColor,settings.headerInside,settings.footerInside],[fillColor,section!==1,true]);
      }
    }
  }finally{loadedBorder.free();}
  assert.equal((await command('edit:undo')).ok,true);
  assert.deepEqual(await readScopeFlags('footerInside'),originalScope.map(section=>section.pageBorderInclusion.entries.map(entry=>entry.footerInside)));
  assert.deepEqual(await readScopeFlags('headerInside'),[[true,true,true],[false,false,false],[true,true,true]]);
  borderInclusionProof+='; selected and all-section edits kept each section background, saved and reopened and undid the second request once';

  const longDoc=HwpDocument.createEmpty();
  let longBytes;
  try{
    longDoc.createBlankDocument();
    const bulk='자료 범위는 문단별로 확인합니다. '.repeat(185);
    for(let i=0;i<35;i++){
      longDoc.insertText(0,i,0,bulk);
      longDoc.splitParagraph(0,i,Array.from(bulk).length);
    }
    longDoc.insertText(0,35,0,'최종 확인일 2026년 12월 31일');
    assert(JSON.parse(longDoc.getTextFileUnicode()).length>120000);
    longBytes=Array.from(longDoc.exportHwpx());
  }finally{longDoc.free();}
  await open(longBytes,'long-context.hwpx');
  const longBefore=await before();
  await page.click('#document-tool-mode');
  await fill('request-input','장문에서 마지막 문단 확인');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child')?.textContent.includes('최종 확인일 2026년 12월 31일을 읽었습니다.'),{timeout:60000});
  assert.equal(longProof.length,1);
  assert.deepEqual(await before(),longBefore);
  await fill('request-input','장문에서 확인되지 않은 출처를 바로잡아 조회');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child')?.textContent.includes('근거를 다시 조회해 2026년 12월 31일을 읽었습니다.')||document.querySelector('#request-error:not([hidden])'));
  assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
  assert.equal(longProof.at(-1).citationRepaired,true);
  assert.deepEqual(await before(),longBefore);
  if(localReplanModelPort){
    await page.waitForSelector('#send-request:not([disabled])');
    const oldAssistantCount=await page.$$eval('#messages .assistant:not(.pending)',nodes=>nodes.length);
    await fill('request-input',localReplanQuestion);await page.click('#send-request');
    await page.waitForFunction(count=>document.querySelectorAll('#messages .assistant:not(.pending)').length>count||document.querySelector('#request-error:not([hidden])'),{timeout:120000},oldAssistantCount);
    assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
    assert.match(await page.$eval('#messages .assistant:last-child',node=>node.textContent),/2026(?:년|\s*[-./])\s*12(?:월|\s*[-./])\s*31/u);
    assert.equal(localReplanProof.verifiedReadText,'최종 확인일 2026년 12월 31일');
    assert.equal(localReplanProof.syntheticUnverifiedFirstAnswer,1);
    assert(localReplanProof.realModelTurns.length>=2&&localReplanProof.realModelTurns.length<=3);
    assert(localReplanProof.realModelTurns.some(turn=>turn.tools.includes('read_paragraph')));
    assert.deepEqual(await before(),longBefore);
    localReplanProof.unchangedDocument=true;
    console.log('PASS real local model recovered from the injected unverified citation within the original call budget');
  }
  await fill('request-input','장문에서 범위를 수정해 확인일 조회');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child')?.textContent.includes('범위를 고쳐 확인일을 읽었습니다.'));
  assert.deepEqual(await before(),longBefore);
  await page.click('#allow-window-edit');await fill('request-input','장문에서 읽지 않은 날짜 변경');await page.click('#send-request');
  await page.waitForFunction(()=>document.querySelector('#request-error:not([hidden])')?.textContent.includes('문단 하나의 범위'));
  assert.deepEqual(await before(),longBefore);
  assert.equal(await page.$eval('#allow-window-edit',input=>input.checked),false);
  await page.waitForSelector('#send-request:not([disabled])');
  const longEditTransport=[];
  const observeLongEdit=request=>{
    if(request.url().endsWith('/api/document-tool-turn')){
      const {input}=JSON.parse(request.postData());
      if(input.request==='장문에서 읽은 제목 교체')longEditTransport.push({turns:input.turns.length,mode:input.documentScope?.mode});
    }
  };
  const observeLongEditResponse=response=>{
    if(response.url().endsWith('/api/document-tool-turn')&&longEditTransport.length){
      longEditTransport.at(-1).status=response.status();
    }
  };
  page.on('request',observeLongEdit);page.on('response',observeLongEditResponse);
  try{
    await page.click('#allow-window-edit');await fill('request-input','장문에서 읽은 제목 교체');await page.click('#send-request');
    await page.waitForFunction(()=>document.querySelector('#messages .assistant:last-child')?.textContent.includes('조회 제목 변경 검수')||document.querySelector('#request-error:not([hidden])'),{timeout:90000});
  }catch(error){
    const state=await page.evaluate(()=>({status:document.getElementById('app-status').textContent,phase:document.getElementById('run-status').textContent,
      request:document.getElementById('request-input').value,busy:document.getElementById('messages').getAttribute('aria-busy'),
      review:Boolean(document.querySelector('#reference-change-review[open]'))}));
    throw new Error(`Authorized long-document edit: ${JSON.stringify({state,transport:longEditTransport})}`,{cause:error});
  }finally{page.off('request',observeLongEdit);page.off('response',observeLongEditResponse);}
  assert.equal(await page.$eval('#request-error',node=>node.hidden?'':node.textContent),'');
  await page.waitForSelector('#send-request:not([disabled])');
  await page.evaluate(()=>[...document.querySelectorAll('#messages .assistant:last-child button')].find(button=>button.textContent==='변경 확인').click());
  await page.waitForSelector('#change-dialog[open]');
  assert.equal(await page.$eval('#diff-body',node=>node.open),false);
  assert.match(await page.$eval('#diff-body-excerpt',node=>node.textContent),/최종 확인일.+확정 확인일/us);
  assert.equal(await page.$eval('#diff-after',node=>node.textContent),'');
  await page.click('#diff-body summary');
  await page.waitForFunction(()=>document.getElementById('diff-after').textContent.length>120000);
  await page.click('#change-dialog form button');
  const longEdited=await frame.evaluate(async()=>{
    const api=window.jueonyEditor, result=await api.save(),file=await api.fileHandle().getFile();
    return {result,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
  });
  assert.equal(longEdited.result,'saved');
  const longReopened=new HwpDocument(new Uint8Array(longEdited.bytes));
  try{
    assert.equal(longReopened.getTextRange(0,35,0,longReopened.getParagraphLength(0,35)),'확정 확인일 2026년 12월 31일');
    const originalLong=new HwpDocument(new Uint8Array(longBytes));
    try{
      for(let paragraph=0;paragraph<35;paragraph++)assert.equal(longReopened.getTextRange(0,paragraph,0,longReopened.getParagraphLength(0,paragraph)),originalLong.getTextRange(0,paragraph,0,originalLong.getParagraphLength(0,paragraph)));
    }finally{originalLong.free();}
  }finally{longReopened.free();}
  await page.evaluate(()=>[...document.querySelectorAll('#messages .assistant:last-child button')].find(button=>button.textContent==='요청 되돌리기').click());
  const undoDeadline=Date.now()+30_000;
  let undoStatus='';
  while(Date.now()<undoDeadline){
    undoStatus=await page.$eval('#app-status',node=>node.textContent);
    if(undoStatus.includes('되돌렸습니다'))break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.match(undoStatus,/되돌렸습니다/);
  assert.deepEqual((await before()).bytes,longBefore.bytes);
  console.log('PASS long body review shows a focused excerpt and the full before/after text on demand');
  longProof.push({authorizedWindowEdit:true,outsideWindowRefused:true,saved:true,singleUndo:true,changeExcerptAndFullText:true});
  await page.click('#document-tool-mode');
  await open(fixture(false),'tools.hwpx');

  async function openPageNumberDialog(){
    await frame.evaluate(()=>window.jueonyEditor.focusEditor());
    await page.keyboard.down('Control');
    await page.keyboard.press('n');
    await page.keyboard.up('Control');
    await page.keyboard.press('p');
    await frame.waitForSelector('#jueony-page-number-position-n021[open]');
  }
  await openPageNumberDialog();
  await frame.select('#jueony-page-number-position-n021 form select:first-of-type','3');
  await frame.click('#jueony-page-number-position-n021 button[type=submit]');
  await frame.waitForFunction(()=>!document.getElementById('jueony-page-number-position-n021'));
  const pageNumberBytes=await frame.evaluate(()=>Array.from(window.jueonyEditor.recovery().bytes));
  const numbered=new HwpDocument(new Uint8Array(pageNumberBytes));
  try{
    const result=JSON.parse(numbered.getPageNumberPosition(0));
    assert.equal(result.exists,true);assert.equal(result.format,3);
    pageNumberProof={shortcut:'Ctrl+N,P',reopenedFormat:result.format,reopenedPosition:result.position};
  }finally{numbered.free();}
  assert.equal((await command('edit:undo')).ok,true);
  const unnumbered=new HwpDocument(new Uint8Array((await before()).bytes));
  try{assert.equal(JSON.parse(unnumbered.getPageNumberPosition(0)).exists,false);}finally{unnumbered.free();}

  if(process.env.JUEONY_TEST_PAGE_NUMBER_UPDATE==='1'){
    assert.equal(typeof HwpDocument.prototype.updatePageNumberPosition,'function');
    const updated=[];
    for(const format of ['hwp','hwpx']){
      const original=HwpDocument.createEmpty();
      try{
        original.createBlankDocument();
        original.insertText(0,0,0,'첫 본문');
        original.splitParagraph(0,0,original.getParagraphLength(0,0));
        original.insertText(0,1,0,'쪽 번호가 기록된 문단');
        assert.equal(JSON.parse(original.insertPageNumberPosition(0,1,JSON.stringify({format:3,position:6,sideChar:'-'}))).ok,true);
        await open(Array.from(format==='hwp'?original.exportHwp():original.exportHwpx()),'page-number-update.'+format);
      }finally{original.free();}
      const start=await before();
      await openPageNumberDialog();
      const controls='#jueony-page-number-position-n021';
      const fields=await frame.$$eval(controls+' select, '+controls+' input',elements=>elements.map(element=>element.value));
      assert.deepEqual(fields,['3','6','-']);
      await frame.select(controls+' label:nth-of-type(1) select','1');
      await frame.select(controls+' label:nth-of-type(2) select','8');
      await frame.$eval(controls+' input',element=>{element.value='.';element.dispatchEvent(new Event('input',{bubbles:true}));});
      await frame.click(controls+' button[type=submit]');
      await frame.waitForFunction(selector=>!document.querySelector(selector),{},controls);
      const saved=await frame.evaluate(async()=>{
        const api=window.jueonyEditor,status=await api.save(),file=await api.fileHandle().getFile();
        return {status,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
      });
      assert.equal(saved.status,'saved');
      const verified=new HwpDocument(new Uint8Array(saved.bytes));
      try{
        assert.equal(verified.getSourceFormat(),format);
        const result=JSON.parse(verified.getPageNumberPosition(0));
        assert.deepEqual([result.paragraphIdx,result.format,result.position,result.sideChar],[1,1,8,'.']);
        assert.deepEqual([0,1].map(i=>verified.getTextRange(0,i,0,verified.getParagraphLength(0,i))),['첫 본문','쪽 번호가 기록된 문단']);
      }finally{verified.free();}
      assert.equal((await command('edit:undo')).ok,true);
      assert.deepEqual((await before()).bytes,start.bytes);
      updated.push({format,originalParagraph:1,newFormat:1,newPosition:8,undoByteExact:true});
    }
    pageNumberProof.updated=updated;
    await open(fixture(false),'tools.hwpx');
    console.log('PASS both formats update an existing page number at its original owner and undo in one step');
  }

  if(process.env.JUEONY_TEST_PAGE_NUMBER_SECTIONS==='1'){
    const readPosition=(doc,section)=>JSON.parse(doc.getPageNumberPosition(section));
    const pageNumbers=doc=>Array.from({length:doc.pageCount()},(_,page)=>{
      const runs=JSON.parse(doc.getPageTextLayout(page)).runs
        .filter(run=>run.secIdx===undefined&&/\d/u.test(run.text));
      assert.equal(runs.length,1,`page ${page+1} generated page number`);
      const {text,x,y}=runs[0];
      return {text,x,y};
    });
    const sectionCases=[];
    for(const format of ['hwp','hwpx']){
      const original=HwpDocument.createEmpty();
      try{
        original.createBlankDocument();
        const labels=['첫 구역','쓸 구역','잇는 구역'];
        for(const [section,label] of labels.entries()){
          if(section)assert.equal(JSON.parse(original.insertSectionBreak(
            section-1,0,original.getParagraphLength(section-1,0),
          )).ok,true);
          original.insertText(section,0,0,label);
        }
        original.splitParagraph(1,0,original.getParagraphLength(1,0));
        original.insertText(1,1,0,'쪽 번호 소유 문단');
        for(const [section,owner,position] of [[0,0,1],[1,1,4]]){
          assert.equal(JSON.parse(original.insertPageNumberPosition(
            section,owner,JSON.stringify({format:0,position,sideChar:'-'}),
          )).ok,true);
        }
        await open(Array.from(format==='hwp'?original.exportHwp():original.exportHwpx()),'page-number-sections.'+format);
      }finally{original.free();}
      const prepared=await frame.evaluate(()=>{
        const automation=window.rhwpStudio.automation,id='ext:verify-page-number-section';
        let layouts;
        automation.registerCommand({id,label:'검수',canExecute:()=>true,execute:services=>{
          const input=services.getInputHandler(),doc=input.wasm.borrowDocumentHandle();
          input.cursor.moveTo({sectionIndex:1,paragraphIndex:0,charOffset:0});
          input.updateCaret();
          input.focus();
          layouts=Array.from({length:doc.pageCount()},(_,page)=>doc.getPageTextLayout(page));
        }});
        try{automation.execute(id);return layouts;}finally{automation.unregisterCommand(id);}
      });
      assert.equal(prepared.length,3);
      // HWP records the current caret on export. Compare at the same section.
      const start=await before();
      await openPageNumberDialog();
      const controls='#jueony-page-number-position-n021';
      assert.match(await frame.$eval(controls+' > p',element=>element.textContent),/2구역.+이어받습니다/u);
      assert.equal(await frame.$eval(controls+' label:nth-of-type(2) select',element=>element.value),'4');
      await frame.select(controls+' label:nth-of-type(2) select','6');
      await frame.click(controls+' button[type=submit]');
      await frame.waitForFunction(selector=>!document.querySelector(selector),{},controls);
      const activeNumbers=await frame.evaluate(()=>{
        const automation=window.rhwpStudio.automation,id='ext:verify-page-number-rendering';
        let result;
        automation.registerCommand({id,label:'검수',canExecute:()=>true,execute:services=>{
          const doc=services.getInputHandler().wasm.borrowDocumentHandle();
          result=Array.from({length:doc.pageCount()},(_,page)=>JSON.parse(doc.getPageTextLayout(page)).runs
            .filter(run=>run.secIdx===undefined&&/\d/u.test(run.text))
            .map(({text,x,y})=>({text,x,y})));
        }});
        try{automation.execute(id);return result;}finally{automation.unregisterCommand(id);}
      });
      const saved=await frame.evaluate(async()=>{
        const api=window.jueonyEditor,status=await api.save(),file=await api.fileHandle().getFile();
        return {status,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
      });
      assert.equal(saved.status,'saved');
      const source=new HwpDocument(new Uint8Array(start.bytes));
      const reopened=new HwpDocument(new Uint8Array(saved.bytes));
      try{
        assert.equal(reopened.getSourceFormat(),format);
        assert.equal(reopened.getSectionCount(),3);
        assert.deepEqual(readPosition(reopened,0),readPosition(source,0));
        const updated=readPosition(reopened,1);
        assert.deepEqual([updated.paragraphIdx,updated.format,updated.position,updated.sideChar],[1,0,6,'-']);
        assert.equal(readPosition(reopened,2).exists,false);
        for(let section=0;section<3;section++){
          const paragraphCount=source.getParagraphCount(section);
          assert.equal(reopened.getParagraphCount(section),paragraphCount);
          for(let paragraph=0;paragraph<paragraphCount;paragraph++){
            const text=doc=>doc.getTextRange(section,paragraph,0,doc.getParagraphLength(section,paragraph));
            assert.equal(text(reopened),text(source));
          }
        }
        const previous=pageNumbers(source);
        const next=pageNumbers(reopened);
        assert.deepEqual(activeNumbers,next.map(run=>[run]));
        assert.deepEqual(next[0],previous[0]);
        for(const page of [1,2]){
          assert.equal(next[page].text,previous[page].text);
          assert.equal(next[page].y,previous[page].y);
          assert.ok(next[page].x>previous[page].x);
        }
        sectionCases.push({format,updatedSection:2,originalParagraph:1,previous,next,inheritedSection:3,undoByteExact:true});
      }finally{source.free();reopened.free();}
      assert.equal((await command('edit:undo')).ok,true);
      assert.deepEqual((await before()).bytes,start.bytes);
    }
    pageNumberProof.sections=sectionCases;
    await open(fixture(false),'tools.hwpx');
    console.log('PASS both formats update only the chosen section, refresh inherited page numbers and undo in one step');
  }

  await page.click('#document-tool-mode');
  for(const [adapter,suffix,name] of [['openai-responses','v1','Responses'],['gemini','v1beta','Gemini'],
    ['hyperclova','serviceapp/v3/chat-completions','HCX-005'],['hyperclova','serviceapp/v3/chat-completions','HCX-007']]){
    await page.click('#connection-settings');await page.click('#new-connection');await page.select('#config-adapter',adapter);
    await fill('config-endpoint',`http://127.0.0.1:${provider.address().port}/${suffix}`);
    await fill('config-model',adapter==='hyperclova'?name:'fixture-model');await fill('config-label',name+' 검수');await fill('config-key','fixture-only');
    await page.$eval('#config-remember',button=>button.checked=false);
    await page.click('#test-document-tools');
    await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('실제 조회 도구 호출을 반환했습니다'));
    await page.click('#model-form button[type=submit]');await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
    await fill('request-input',name+'로 본문 조회');await page.click('#send-request');
    await page.waitForFunction(prefix=>document.querySelector('#messages .assistant:last-child')?.textContent.includes(prefix+' 문단 조회 완료'),{},name);
  }
  await page.click('#document-tool-mode');
  assert.deepEqual(nativeToolProof,['Responses','Gemini','HCX-005','HCX-007']);

  const noTextPdf=resolve(out,'no-text.pdf'), invalidWord=resolve(out,'invalid.docx');
  await writeFile(noTextPdf,pdfBytes.replace(stream,' '.repeat(stream.length)));
  await writeFile(invalidWord,'not a Word archive');
  for(const [path,name,error] of [[noTextPdf,'no-text.pdf','OCR'],[invalidWord,'invalid.docx','Word 참고 문서를 열 수 없습니다']]){
    const picker=page.waitForFileChooser();await page.click('#attach-reference');await (await picker).accept([path]);
    await page.waitForSelector('#send-request:not([disabled])');
    await fill('request-input','읽을 수 없는 자료 확인');await page.click('#send-request');
    await page.waitForFunction(text=>document.querySelector('#request-error:not([hidden])')?.textContent.includes(text),{},error);
    await page.evaluate(file=>[...document.querySelectorAll('.attachment-chip')].find(chip=>chip.textContent.startsWith(file))?.click(),name);
  }
  assert.deepEqual(calls,['initial','tool-result']);
  officeProof.push('Textless PDF and damaged DOCX displayed specific errors without a model call');

  const printDoc=HwpDocument.createEmpty();let printBytes;
  try {
    printDoc.createBlankDocument();
    for(let index=0;index<5;index++){
      printDoc.insertText(0,index,0,`출력 ${index+1}쪽`);
      if(index<4)printDoc.insertPageBreak(0,index,printDoc.getParagraphLength(0,index));
    }
    printBytes=Array.from(printDoc.exportHwpx());
  } finally {printDoc.free();}
  await open(printBytes,'imposition.hwpx');
  const printBefore=await before();
  assert.equal((await command('ext:jueony-print-imposition')).ok,true);
  await frame.waitForSelector('#jueony-print-imposition section[data-sheet] img');
  assert.deepEqual(await frame.$$eval('#jueony-print-imposition section[data-sheet]',sheets=>sheets.map(sheet=>sheet.querySelectorAll('img').length)),[2,2,1]);
  await frame.select('#jueony-print-imposition select','4');
  assert.deepEqual(await frame.$$eval('#jueony-print-imposition section[data-sheet]',sheets=>sheets.map(sheet=>sheet.querySelectorAll('img').length)),[4,1]);
  await frame.click('#jueony-print-imposition > button:nth-last-child(2)');
  await frame.waitForFunction(()=>Boolean(window.printCapture));
  const printable = await frame.evaluate(()=>window.printCapture);
  const output = await browser.newPage();
  try {
    await output.setContent(printable,{waitUntil:'load'});
    const bytes=await output.pdf({preferCSSPageSize:true});
    const printed=Buffer.from(bytes).toString('latin1');
    assert.equal([...printed.matchAll(/\/Type \/Page\b/gu)].length,2);
    const boxes=[...printed.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/gu)].map(match=>match.slice(1,3).map(Number));
    assert(boxes.length>0&&boxes.every(([width,height])=>Math.abs(width-297*72/25.4)<2&&Math.abs(height-210*72/25.4)<2));
    await writeFile(resolve(out,'imposition-a4-landscape.pdf'),bytes);
    printProof={documentPages:5,layout:'4 per A4 landscape sheet',printedSheets:2,mediaBoxPoints:boxes[0],sourceBytesUnchanged:true};
  } finally { await output.close(); }
  await frame.click('#jueony-print-imposition > button:last-child');
  assert.deepEqual(await before(),printBefore);
  const scanned=resolve(out,'scan.pdf');
  const sample=Buffer.from(await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=240;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,900,240);
    ctx.fillStyle='#000';ctx.font='bold 52px Arial';ctx.fillText('LOCAL OCR TEST 123',35,91);
    ctx.font='bold 55px "Malgun Gothic", sans-serif';ctx.fillText('업무 보고서',35,175);
    return canvas.toDataURL('image/jpeg',0.9).split(',')[1];
  }),'base64');
  const imageContent='q 900 0 0 240 0 0 cm /Scan Do Q\n';
  const imageObjects=[objects[0],objects[1],
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 240] /Resources << /XObject << /Scan 4 0 R >> >> /Contents 5 0 R >>',
    `<< /Type /XObject /Subtype /Image /Width 900 /Height 240 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${sample.length} >>\nstream\n${sample.toString('latin1')}\nendstream`,
    `<< /Length ${imageContent.length} >>\nstream\n${imageContent}endstream`];
  let scanBytes='%PDF-1.4\n';
  const scanOffsets=['0000000000 65535 f '];
  imageObjects.forEach((body,i)=>{scanOffsets.push(String(scanBytes.length).padStart(10,'0')+' 00000 n ');scanBytes+=`${i+1} 0 obj\n${body}\nendobj\n`;});
  const scanXref=scanBytes.length;
  await writeFile(scanned,Buffer.from(scanBytes+`xref\n0 6\n${scanOffsets.join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${scanXref}\n%%EOF\n`,'latin1'));
  for (const [input,name,useOcr] of [[word,'reference.docx',false],[pdf,'reference.pdf',false],[scanned,'scan.pdf',true]]) {
    const sourceBefore=await readFile(input);
    await page.click('#convert-office-copy');
    const picker=await page.waitForSelector('#office-copy-dialog input[type=file]');
    await picker.uploadFile(input);
    if(useOcr){await page.waitForSelector('#office-copy-dialog label:not([hidden]) input[type=checkbox]');await page.click('#office-copy-dialog input[type=checkbox]');}
    await page.waitForSelector('#office-copy-dialog li');
    if(useOcr)assert.match(await page.$eval('#office-copy-dialog ul',item=>item.textContent),/한국어·영어 OCR/u);
    await page.click('#office-copy-dialog button:first-of-type');
    await page.waitForFunction(()=>!document.getElementById('office-copy-dialog'),{timeout:15000}).catch(async error=>{
      throw new Error((await page.$eval('#office-copy-dialog [role=status]',item=>item.textContent)) || error.message);
    });
    const copy=await (await page.$('.editor-frame:not([hidden])')).contentFrame();
    const item=await copy.evaluate(()=>({ state:window.jueonyEditor.state(),document:window.jueonyEditor.snapshot(), bound:Boolean(window.jueonyEditor.fileHandle()) }));
    assert.equal(item.state.name,name.replace(/\.(docx|pdf)$/u,'')+' 변환 사본.hwpx');
    assert.equal(item.state.dirty,true);
    assert.equal(item.bound,false);
    if(name.endsWith('.docx')){
      assert.equal(item.document.nodes[0].text,'본문');
      assert.deepEqual(item.document.structure.tables[0].cells.map(cell=>cell.text),['열 A','열 B']);
    }else {
      const text=item.document.nodes.map(node=>node.text).join('\n');
      assert.match(text,useOcr?/LOCAL OCR TEST 123/iu:/Budget fixture/u);
      if(useOcr)assert.match(text.replace(/\s+/gu,''),/업무보고서/u);
    }
    assert.deepEqual(await readFile(input),sourceBefore);
  }
  const original = await (await page.$('.editor-frame:not([hidden])')).contentFrame();
  const originalState = await original.evaluate(()=>window.jueonyEditor.state());
  const snapshots = anEditor => anEditor.evaluate(()=>({state:window.jueonyEditor.state(),nodes:window.jueonyEditor.snapshot().nodes,bound:Boolean(window.jueonyEditor.fileHandle())}));
  const fixtureProvider=await page.$eval('#provider-select',select=>[...select.options].find(item=>item.textContent==='검수 모의 모델').value);
  await page.select('#provider-select',fixtureProvider);
  for(const department of ['시범 기관','다른 기관']){
    await page.click('#new-template-copy');
    await page.waitForSelector('#work-template-copy-dialog[open]');
    await page.click('#open-work-template-copy');
    await page.waitForFunction(()=>document.querySelector('#work-template-copy-dialog [role=status]')?.textContent.includes('필수 입력'));
    await page.type('#work-template-copy-dialog input[name="기관명"]',department);
    await page.type('#work-template-copy-dialog input[name="공문 제목"]','업무 협조');
    if(department==='시범 기관'){
      await page.type('#work-template-copy-dialog input[name="주요 내용"]','기존 사용자 입력');
      await page.click('#work-template-copy-dialog details summary');
      const setNotes=text=>page.$eval('#work-template-copy-dialog details textarea',(node,value)=>{node.value=value;},text);
      await setNotes('허용 범위 밖 명령 시험');await page.click('#suggest-work-template-draft');
      await page.waitForFunction(()=>document.querySelector('#work-template-copy-dialog details [role=status]')?.textContent.includes('다른 변경'));
      assert.equal(await page.$eval('#work-template-copy-dialog input[name="요청 또는 안내할 내용을 작성하세요."]',node=>node.value),'');
      await setNotes('회의 전에 검토 자료를 제출해야 합니다.');await page.click('#suggest-work-template-draft');
      await page.waitForFunction(()=>document.querySelector('#work-template-copy-dialog details [role=status]')?.textContent.includes('본문 초안 1개'));
      assert.equal(await page.$eval('#work-template-copy-dialog input[name="주요 내용"]',node=>node.value),'기존 사용자 입력');
      assert.deepEqual(await original.evaluate(()=>window.jueonyEditor.state()),originalState);
    }
    await page.click('#open-work-template-copy');
    await page.waitForFunction(()=>!document.getElementById('work-template-copy-dialog'));
    const generated = await snapshots(await (await page.$('.editor-frame:not([hidden])')).contentFrame());
    assert.equal(generated.state.name,'공문 초안 사본.hwpx');
    assert.equal(generated.state.dirty,true);
    assert.equal(generated.bound,false);
    assert.equal(generated.nodes[0].text,department);
    assert(generated.nodes.some(node=>node.text.includes('업무 협조')));
    if(department==='시범 기관'){
      assert(generated.nodes.some(node=>node.text.includes('검토 자료를 회의 전까지 제출해 주세요.')));
      assert(generated.nodes.some(node=>node.text.includes('기존 사용자 입력')));
      templateDraftProof='only explicit notes and blank narrative fields were sent; other proposals rejected; reviewed text only entered the independent HWPX copy';
    }
  }
  assert.deepEqual(await original.evaluate(()=>window.jueonyEditor.state()),originalState);
  const institutionPath=resolve(out,'institution-template-fixture.hwpx');
  const institutionDoc=HwpDocument.createEmpty();
  let institutionBytes;
  try{
    institutionDoc.createBlankDocument();
    institutionDoc.insertText(0,0,0,'원본 업무 파일 {{기관명}}');
    institutionDoc.splitParagraph(0,0,institutionDoc.getParagraphLength(0,0));
    institutionDoc.insertText(0,1,0,'1. {{본문:제출 내용}}');
    institutionBytes=Buffer.from(institutionDoc.exportHwpx());
  }finally{institutionDoc.free();}
  await writeFile(institutionPath,institutionBytes);
  await page.click('#institution-template-copy');
  const institutionDialog=await page.waitForSelector('#institution-template-dialog[open]');
  await (await institutionDialog.$('input[type=file]')).uploadFile(institutionPath);
  await page.waitForSelector('#institution-template-dialog input[name="기관명"]');
  await page.type('#institution-template-dialog input[name="기관명"]','검수 기관명');
  await page.click('#institution-template-dialog summary');
  await page.type('#institution-template-dialog textarea','회의에 필요한 검토 자료를 미리 제출합니다.');
  await page.click('#institution-template-dialog details button');
  await page.waitForFunction(()=>document.querySelector('#institution-template-dialog [role=status]')?.textContent.includes('제안한 문장'));
  assert.equal(await page.$eval('#institution-template-dialog input[name="기관명"]',input=>input.value),'검수 기관명');
  await page.click('#institution-template-dialog button[type=submit]');
  await page.waitForFunction(()=>!document.getElementById('institution-template-dialog')).catch(async error=>{
    throw Error(`${error.message}: ${await page.$eval('#institution-template-dialog [role=status]',node=>node.textContent)}`);
  });
  const institutionCopy=await snapshots(await (await page.$('.editor-frame:not([hidden])')).contentFrame());
  assert.equal(institutionCopy.state.name,'institution-template-fixture 사본.hwpx');
  assert.equal(institutionCopy.bound,false);
  assert.equal(institutionCopy.state.dirty,true);
  assert.deepEqual(institutionCopy.nodes.map(node=>node.text),['원본 업무 파일 검수 기관명','1. 검토 자료를 회의 전까지 제출해 주세요.']);
  assert.deepEqual(await readFile(institutionPath),institutionBytes);
  institutionTemplateProof='opened a provided form, proposed only its explicitly tagged empty narrative field, and kept the original file byte-exact';
  await browser.defaultBrowserContext().setDownloadBehavior({policy:'allow',downloadPath:out});
  await page.click('#macro-manager');await page.click('#institution-review-bundle');
  const review=await page.waitForSelector('#institution-review-dialog[open]');
  await (await review.$('input[type=file]')).uploadFile(excel);
  await page.type('#institution-review-dialog textarea','붙임을 포함해 검토합니다.');
  await page.click('#institution-review-dialog button[type=submit]');
  await page.waitForFunction(()=>!document.getElementById('institution-review-dialog')).catch(async error=>{
    throw Error(`${error.message}: ${await page.$eval('#institution-review-dialog [role=status]',node=>node.textContent)}`);
  });
  const downloaded=resolve(out,'검토 묶음.zip');
  let zipBytes;
  for(let attempt=0;attempt<50&&!zipBytes;attempt++){
    try{zipBytes=await readFile(downloaded);}
    catch(error){if(error.code!=='ENOENT')throw error;await new Promise(resolve=>setTimeout(resolve,100));}
  }
  assert(zipBytes,'The browser did not download the review bundle');
  const reviewFiles=unzipSync(zipBytes),reviewRecord=JSON.parse(strFromU8(reviewFiles['검토 기록.json']));
  assert.equal(reviewRecord.status,'draft');
  assert.equal(reviewRecord.notes,'붙임을 포함해 검토합니다.');
  assert.deepEqual(Buffer.from(reviewFiles['붙임/reference.xlsx']),await readFile(excel));
  const reviewDoc=new HwpDocument(reviewFiles[reviewRecord.document.path]);
  try{assert.match(JSON.parse(reviewDoc.getTextFileUnicode()),/원본 업무 파일 검수 기관명/u);}
  finally{reviewDoc.free();}
  await writeFile(resolve(out,'institution-review.zip'),zipBytes);
  institutionTemplateProof+='; the local review ZIP reopened with the verified draft and byte-exact selected attachment';
  await page.evaluate(()=>{window.reviewOAuthEnabled=true;});
  await page.click('#connection-settings');await page.click('#new-connection');
  await page.select('#config-adapter','gemini');await page.type('#config-model','gemini-review-fixture');
  await page.waitForSelector('#gemini-oauth-start',{visible:true});
  await page.click('#gemini-oauth-start');await page.waitForSelector('#gemini-oauth-link[href]');
  assert.equal(await page.$eval('#gemini-oauth-link',node=>node.href),'https://accounts.google.com/o/oauth2/v2/auth?state=fixture');
  await page.click('#gemini-oauth-cancel');
  await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('취소'));
  await page.click('#gemini-oauth-start');await page.waitForSelector('#gemini-oauth-link[href]');
  await page.click('#gemini-oauth-finish');
  await page.waitForFunction(()=>document.getElementById('config-status').textContent.includes('다시 확인'));
  await page.click('#gemini-oauth-finish');
  await page.waitForFunction(()=>!document.getElementById('model-dialog').open);
  const selectedOAuth=await page.$eval('#model-select',select=>select.selectedOptions[0]?.textContent);
  assert.match(selectedOAuth,/gemini-review-fixture/u);
  const oauthCalls=await page.evaluate(()=>window.reviewOAuth);
  assert.deepEqual(oauthCalls.map(item=>item.path.split('/').at(-1)),['start','cancel','start','finish','finish']);
  assert.deepEqual(Object.keys(oauthCalls[0].input),['config','remember']);
  assert.equal(oauthCalls[0].input.config.endpoint,'https://generativelanguage.googleapis.com/v1beta');
  const googleAuthProof='Chrome selected an OAuth-only Gemini connection after request, cancellation and confirmation without an API key or document payload';
  await page.close();
  const restarted=await browser.newPage();
  try{
    restarted.on('pageerror',error=>errors.push(String(error)));
    await restarted.goto(origin);
    await restarted.waitForFunction(()=>document.getElementById('app-status')?.textContent.includes('준비 완료')).catch(async error=>{
      throw Error(`${error.message}: ${await restarted.$eval('#app-status',node=>node.textContent)}`);
    });
    const other=await (await restarted.$('.editor-frame:not([hidden])')).contentFrame();
    const openMatching=bytes=>other.evaluate(async bytes=>{
      await window.jueonyEditor.open(new Uint8Array(bytes),'alignment-library.hwpx',undefined,false);
    },bytes);
    await openMatching(fixture(true));
    await restarted.click('#macro-manager');await restarted.waitForSelector('#alignment-library select option');
    await restarted.click('#load-alignment-record');
    await restarted.waitForFunction(()=>document.getElementById('alignment-macro-status').textContent.includes('일치해야'));
    await restarted.click('#close-macros');
    await openMatching(originalManual);
    await restarted.click('#macro-manager');await restarted.click('#load-alignment-record');
    await restarted.waitForFunction(()=>document.getElementById('alignment-macro-status').textContent.includes('2개'));
    await restarted.click('#replay-alignment-macro');
    await restarted.waitForFunction(()=>document.getElementById('app-status').textContent.includes('문단 정렬 매크로를 재생'));
    assert.equal(await other.evaluate(()=>window.jueonyEditor.snapshot().structure.paragraphs[0].paragraph.alignment),'right');
    macroProof.push('persisted manual record survived a fresh application page, refused different bytes and replayed from the matching original without JSON import');
  }finally{await restarted.close();}
  assert.deepEqual(errors,[]);
  assert.deepEqual(externalRequests,[]);
  await writeFile(resolve(out,'result.json'),JSON.stringify({build:{customSourceSha256,engineWasmSha256},audit:'HWPX controls and read-only location jump',layout:'explicit scope report',paperEdges:paperEdgeProof,memo:'HWPX list and location jump, edit, save/reopen, delete and undo',agent:'two local mock calls, checked edit, bound file reopen, and visible request undo',office:officeProof,officeLocal:officeLocalProof,macro:macroProof,localShapeMacro:localShapeMacroProof,localNestedMacro:localNestedMacroProof,localNestedAxisMacro:localNestedAxisMacroProof,longDocument:longProof,toolReplan:replanProof,localToolReplan:localReplanModelPort?localReplanProof:undefined,nativeProviderTools:nativeToolProof,pageNumber:pageNumberProof,storedCharacterStyle:storedStyleProof,styleGallery:styleGalleryProof,borderInclusion:borderInclusionProof,revokedReference:revokedReferenceProof,readOnlyLookup:readOnlyLookupProof,referenceReview:referenceReviewProof,referencePanel:referencePanelProof,workspaceReferenceReader:workspaceReferenceReaderProof,index:'background refresh parsed the selected HWPX once, skipped extraction for the same bytes, reparsed a changed file and cleared the deselected scope',print:printProof,conversion:'PDF text, Korean and English local OCR and DOCX loss notices, verified HWPX body and table, unbound dirty tabs and unchanged source bytes',template:'missing required values refused; two independent HWPX template copies with different filled values and unchanged original tab',templateDraft:templateDraftProof,institutionTemplate:institutionTemplateProof,preferences:preferenceProof,googleAuth:googleAuthProof,calls,errors,externalRequests},null,2));
  console.log('PASS reports, memo editing, tool round trip, source coordinates, table and manual macros, windowed long-document read, output and HWPX copies');
} finally {
  await browser?.close();host.kill();provider.close();
}
