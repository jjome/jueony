import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEditOperations,describeStructure} from '../src/modules/document/public/index.ts';
import type {Snapshot} from '../src/modules/document/public/index.ts';
import {generationSchema} from '../src/modules/document/public/wire-schema.mjs';
import {executeAgentSectionOperation} from '../src/adapters/rhwp/agent-section-settings.ts';
const base=():Snapshot=>({revision:'r1',name:'review.hwpx',limitations:[],nodes:[{id:'s0p0',section:0,paragraph:0,text:'본문',editable:true}],structure:{sections:[{index:0,page:{width:59528,height:84188,marginLeft:8504,marginRight:8504,marginTop:5668,marginBottom:4252,landscape:false},columns:{sameWidth:true,columnCount:1,spacing:0},defaultTabSpacingPt:40,lineNumbers:{enabled:false,restart:'page',countBy:1,startNumber:1,distanceMm:5,editable:true}}],paragraphs:[],tables:[],unsupportedControls:[]}});
const numbering=()=>({kind:'set_line_numbers' as const,section:0,enabled:true,restart:'page' as const,countBy:1,startNumber:1,distanceMm:5});
test('section tool wire uses explicit physical units and restart names across 24 supported commands',()=>{
 const options=generationSchema().properties.operations.items.anyOf;
 assert.equal(options.length,25);
 const line=options.find(v=>v.properties.kind.enum[0]==='set_line_numbers')!;
 assert.deepEqual(line.properties.restart.enum,['page','section','continuous']);assert.ok(line.required.includes('distanceMm'));assert.ok(!('distance' in line.properties));
 const before=base(),operations=[{kind:'set_section_tabs',section:0,spacingPt:24},numbering()];assert.deepEqual(validateEditOperations(operations,before),operations);
});
test('default tabs reject invalid units, absent capability, unknown fields and section indices without changing input',()=>{
 const before=base(),saved=structuredClone(before);
 for(const op of [{kind:'set_section_tabs',section:0,spacingPt:0},{kind:'set_section_tabs',section:0,spacingPt:10000},{kind:'set_section_tabs',section:0,spacingPt:NaN},{kind:'set_section_tabs',section:0,spacingPt:'20'},{kind:'set_section_tabs',section:1,spacingPt:20},{kind:'set_section_tabs',section:0,spacingPt:20,script:'ignored'}])assert.throws(()=>validateEditOperations([op],before));
 delete before.structure!.sections[0].defaultTabSpacingPt;assert.throws(()=>validateEditOperations([{kind:'set_section_tabs',section:0,spacingPt:20}],before),/조회/);before.structure!.sections[0].defaultTabSpacingPt=40;assert.deepEqual(before,saved);
});
test('line numbering requires queried editable HWPX and refuses disabling unsupported original numbering',()=>{
 for(const state of ['hwp','absent','complex','original-complex']){const before=base();if(state==='hwp')before.name='review.hwp';else if(state==='absent')delete before.structure!.sections[0].lineNumbers;else {before.structure!.sections[0].lineNumbers!.editable=false;before.structure!.sections[0].lineNumbers!.enabled=state==='original-complex';}const saved=structuredClone(before);assert.throws(()=>validateEditOperations([{...numbering(),enabled:state!=='original-complex'}],before));assert.deepEqual(before,saved);}
});
test('line numbering rejects missing, fractional, oversized and arbitrary execution fields',()=>{
 const before=base();for(const change of [{restart:'unknown'},{countBy:0},{countBy:1.5},{startNumber:65536},{distanceMm:-1},{distanceMm:51},{distanceMm:Infinity},{enabled:'true'},{distanceMm:undefined},{extra:1}])assert.throws(()=>validateEditOperations([{...numbering(),...change}],before));
});
test('batch validation tracks enabled lines against later or earlier columns, tables and page margins',()=>{
 const before=base(),pairs=[{kind:'set_columns',section:0,count:2,spacingMm:5},{kind:'create_table',after:'s0p0',resultId:'t',rows:[['셀']]},{kind:'set_page_setup',section:0,properties:{marginLeftMm:5}}];
 for(const op of pairs)for(const operations of [[numbering(),op],[op,numbering()]])assert.throws(()=>validateEditOperations(operations,before));
});
test('explicit line disable permits subsequent section column changes while preserving request order',()=>{
 const before=base();before.structure!.sections[0].lineNumbers!.enabled=true;
 const operations=[{...numbering(),enabled:false},{kind:'set_columns',section:0,count:2,spacingMm:5}];assert.deepEqual(validateEditOperations(operations,before),operations);assert.throws(()=>validateEditOperations([...operations,numbering()],before));
});
test('structure review includes default tabs and numbering so property-only requests have an observable diff',()=>{
 const before=base(),after=structuredClone(before);after.structure!.sections[0].defaultTabSpacingPt=20;after.structure!.sections[0].lineNumbers!.enabled=true;
 assert.match(describeStructure(before.structure),/기본 탭: 40pt/);assert.match(describeStructure(after.structure),/기본 탭: 20pt/);assert.notEqual(describeStructure(before.structure),describeStructure(after.structure));
});
test('native tab adapter detects a lying setter and preserves legacy default-zero no-op',()=>{
 let raw=0,writes=0;const doc={getSectionDef:()=>JSON.stringify({defaultTabSpacing:raw}),setSectionDef:()=>{writes++;return '{"ok":true}';}};
 executeAgentSectionOperation(doc,'review.hwp',{kind:'set_section_tabs',section:0,spacingPt:40});assert.equal(writes,0);
 assert.throws(()=>executeAgentSectionOperation(doc,'review.hwp',{kind:'set_section_tabs',section:0,spacingPt:20}),/결과/);assert.equal(writes,1);assert.equal(raw,0);
});
test('known single-column numbering does not depend on the multi-column equal-width flag',()=>{
 const before=base();before.structure!.sections[0].columns!.sameWidth=false;assert.deepEqual(validateEditOperations([numbering()],before),[numbering()]);
});
