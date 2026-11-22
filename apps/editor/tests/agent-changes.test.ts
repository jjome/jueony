import assert from 'node:assert/strict';
import test from 'node:test';
import {describeAgentChanges} from '../src/ui/agent-changes.ts';
import {describeReferenceOperation} from '../src/ui/reference-change-details.ts';
import type {AgentMasterPage,Receipt,Structure,Table} from '../src/modules/document/public/types.ts';

const table=(paragraph:number,text:string):Table=>({id:`s0p${paragraph}t0`,section:0,paragraph,control:0,rows:1,columns:1,editable:true,
 cells:[{index:0,row:0,column:0,rowSpan:1,columnSpan:1,text,editable:true,properties:{width:1000,height:1000}}]});
const structure=(tables:Table[]):Structure=>({sections:[],paragraphs:[],tables,unsupportedControls:[]});
const receipt=(before:Table[],after:Table[]):Receipt=>({runId:'run',beforeRevision:'a',afterRevision:'b',before:'표',after:'표',
 operationCount:1,beforeStructure:structure(before),afterStructure:structure(after)});

test('table change comparison retains identical tables at their original addresses before considering moves',()=>{
 const result=describeAgentChanges(receipt([table(0,'같은 내용'),table(1,'같은 내용')],[table(0,'수정'),table(1,'같은 내용')]));
 assert.deepEqual(result,['1구역 1문단 표 (1번) (1행 × 1열) · 내용 1셀 · 1행 1열 변경','1구역 1문단 표 (1번) · 1행 1열 “같은 내용” → “수정”']);
 assert.deepEqual(describeAgentChanges(receipt([table(0,'같은 내용'),table(1,'같은 내용')],[table(1,'같은 내용'),table(2,'같은 내용')])),[]);
});

test('configured split shows the new section settings and preserves shifted section identities',()=>{
 const base=receipt([],[]),source={index:0,page:{width:59528,landscape:false},pageBorderInclusion:{editable:true,entries:[]}};
 const later={index:1,page:{width:41953,landscape:false}};
 base.sectionSplit={sourceSection:0};
 base.beforeStructure!.sections=[source,later];
 base.afterStructure!.sections=[source,{...source,index:1,page:{width:59528,landscape:true},
  pageBorderInclusion:{editable:true,entries:[{kind:'both',headerInside:true,footerInside:false}]}},{...later,index:2}];
 assert.deepEqual(describeAgentChanges(base),['구역 수 2개 → 3개','새 구역 2 추가 · 용지·여백, 쪽 테두리 머리말·꼬리말 포함 변경','2구역 · 방향 세로 → 가로']);
});

test('merged or removed sections do not appear as unrelated page changes',()=>{
 const base=receipt([],[]),first={index:0,page:{width:59528,landscape:false}},second={index:1,page:{width:41953,landscape:false}},third={index:2,page:{width:39000,landscape:true}};
 base.sectionRemoval={removedSection:1,reason:'merge'};
 base.beforeStructure!.sections=[first,second,third];
 base.afterStructure!.sections=[first,{...third,index:1}];
 assert.deepEqual(describeAgentChanges(base),['구역 수 3개 → 2개','2구역을 1구역에 합침']);
});

test('section comparison shows the whole table move and its inherited tab spacing', () => {
  const original = { ...table(1, '보존할 셀'), section: 1, id: 's1p1t0' };
  const moved = table(2, '보존할 셀');
  original.cells[0].paragraphProperties = { defaultTabSpacing: 12000 };
  moved.cells[0].paragraphProperties = { defaultTabSpacing: 4000 };
  const result = receipt([original], [moved]);
  const first = { index: 0, page: {}, defaultTabSpacingPt: 20 };
  const second = { index: 1, page: {}, defaultTabSpacingPt: 60 };
  result.beforeStructure!.sections = [first, second];
  result.beforeStructure!.paragraphs = ['s0p0', 's0p1', 's1p0', 's1p1']
    .map(id => ({ id, characters: {}, paragraph: {} }));
  result.afterStructure!.sections = [first];
  result.sectionRemoval = { removedSection: 1, reason: 'merge' };
  assert.deepEqual(describeAgentChanges(result), [
    '구역 수 2개 → 1개',
    '2구역을 1구역에 합침',
    '2구역 2문단 표 (1번) → 1구역 3문단 표 (1번) 이동 (1행 × 1열)',
    '1구역 3문단 표 (1번) · 기본 탭 60 → 20pt',
  ]);
});

test('section comparison reports millimeter differences and ignores view-time editability',()=>{
 const base=receipt([],[]),page={width:59528,height:84189,landscape:false,marginTop:4252};
 base.beforeStructure!.sections=[{index:0,page,pageBorderInclusion:{editable:false,entries:[]}}];
 base.afterStructure!.sections=[{index:0,page:{...page,marginTop:6236},pageBorderInclusion:{editable:true,entries:[]}}];
 assert.deepEqual(describeAgentChanges(base),['1구역 · 위 여백 15 → 22 mm']);
});

test('page-border comparison groups identical changes and names the changed parity otherwise',()=>{
 const compare=(next:(entry:{kind:'both'|'even'|'odd';headerInside:boolean;footerInside:boolean})=>typeof entry)=>{
  const result=receipt([],[]);
  const entries=(['both','even','odd'] as const).map(kind=>({kind,headerInside:false,footerInside:true}));
  result.beforeStructure!.sections=[{index:0,page:{},pageBorderInclusion:{editable:true,entries}}];
  result.afterStructure!.sections=[{index:0,page:{},pageBorderInclusion:{editable:true,entries:entries.map(next)}}];
  return describeAgentChanges(result);
 };
 assert.deepEqual(compare(entry=>({...entry,headerInside:true,footerInside:false})),[
  '1구역 · 쪽 테두리 머리말·꼬리말 포함 (양쪽) · 머리말 제외 → 포함, 꼬리말 포함 → 제외',
 ]);
 assert.deepEqual(compare(entry=>entry.kind==='odd'?{...entry,headerInside:true}:entry),[
  '1구역 · 쪽 테두리 머리말·꼬리말 포함 (홀수 쪽) · 머리말 제외 → 포함',
 ]);
});

test('stored master comparison reports verified text, position, color and first-page visibility',()=>{
 const result=receipt([],[]);
 const old:AgentMasterPage={kind:'both',text:'초안',textTruncated:false,xMm:6.22,yMm:7.43,fontSizePt:18,color:'#996633',
  bold:true,italic:false,underline:null,editable:true,paragraphCount:1,controlCount:0};
 const odd={...old,kind:'odd' as const,text:'홀수 쪽 원문'};
 result.beforeStructure!.sections=[{index:0,page:{},masterPages:{editable:true,pages:[old,odd],hiddenOnFirstPage:false}}];
 result.afterStructure!.sections=[{index:0,page:{},masterPages:{editable:true,pages:[{...old,text:'확정\n검토',xMm:8,color:'#334455'}],hiddenOnFirstPage:true}}];
 assert.deepEqual(describeAgentChanges(result),[
  '1구역 · 저장된 바탕쪽 (양쪽 기본) · 문구 “초안” → “확정↵검토”, 가로 위치 6.22 → 8 mm, 글자색 #996633 → #334455',
  '1구역 · 저장된 바탕쪽 (홀수 쪽) 삭제 · “홀수 쪽 원문”',
  '1구역 · 첫 쪽 바탕쪽 표시 → 숨김',
 ]);
});

test('reference review identifies both source tables and shows unit values instead of wire properties',()=>{
 const review={request:'검수',document:{name:'test.hwpx',nodes:[]},tableLocations:[table(0,'앞'),table(1,'뒤')],shapeFills:{},referenceNames:['근거'],operations:[]};
 assert.deepEqual(describeReferenceOperation({kind:'attach_table',target:'s0p0t0',nextTarget:'s0p1t0'},review),{
  heading:'1구역 1문단 표 (1번)에 다음 표 붙이기',description:'붙일 표 · 1구역 2문단 표 (1번)',
 });
 assert.deepEqual(describeReferenceOperation({kind:'set_page_setup',section:0,properties:{landscape:true,marginTopMm:22}},review),
  {heading:'1구역 · 용지·여백',description:'방향 가로\n위 여백 22 mm'});
});
