import assert from 'node:assert/strict';
import {test} from 'node:test';
import {nativeSchema, parseGeneration} from '../../launcher/providers/native-common.mjs';
import {generationSchema} from '../src/modules/document/public/wire-schema.mjs';
import {tableSubdivisionPlan} from '../src/modules/document/public/engine-integration.ts';
import type {AgentTableSubdivisionOp, Snapshot} from '../src/modules/document/public/types.ts';

const target='s0p1t0';
const command:AgentTableSubdivisionOp={kind:'split_table_cell_into',target,row:0,column:0,rows:2,columns:2};
function source():Snapshot {
  const positions=[[0,0],[0,2],[1,2],[2,0],[2,1],[2,2]];
  const cells=positions.map(([row,column],index)=>{
    const span=index===0 ? 2 : 1;
    return {index,row,column,rowSpan:span,columnSpan:span,text:index===0 ? '첫째\n\n셋째' : '이웃',editable:index!==0,
      properties:{width:4000*span,height:6000*span,isHeader:false,cellProtect:false}};
  });
  const fingerprint='1'.repeat(64), frame={page:0,x:0,y:0,w:120,h:180,cells:[]};
  return {name:'양식.hwpx',structure:{tables:[{id:target,rows:3,columns:3,editable:true,cells}]},
    tableSplitSources:{[target]:{editable:true,fingerprint,widths:[4000,4000,4000],heights:[6000,6000,6000]}},
    tableSubdivisionSources:{[target]:{editable:true,fingerprint,frame,paragraphFormats:[fingerprint,fingerprint,fingerprint],cells:[{row:0,column:0,minimumWidth:200,minimumHeight:200}]}}
  } as unknown as Snapshot;
}
const divided=(op:AgentTableSubdivisionOp)=>tableSubdivisionPlan(op,source()).cells.filter(c=>c.row<2&&c.column<2).map(c=>c.text);

test('explicit distribution keeps empty source paragraphs and fills cells in reading order',()=>{
  assert.deepEqual(divided({...command,distributeParagraphs:true}),['첫째','','셋째','']);
  for (const flag of [undefined,false,null]) assert.deepEqual(divided({...command,distributeParagraphs:flag}),['첫째\n\n셋째','','','']);
});
test('reject incomplete paragraph capability and insufficient slots',()=>{
  assert.throws(()=>divided({...command,rows:1,distributeParagraphs:true}),/문단/);
  const s=source();delete s.tableSubdivisionSources![target].paragraphFormats;
  assert.throws(()=>tableSubdivisionPlan({...command,distributeParagraphs:true},s),/문단/);
});
test('all provider schemas keep one wire kind; strict null retains legacy first-cell content',()=>{
  const variant=(schema:any)=>schema.properties.operations.items.anyOf.filter((v:any)=>v.properties.kind.enum.includes(command.kind));
  const plain=variant(generationSchema()), strict=variant(nativeSchema([],true));
  assert.equal(plain.length,1);assert.equal(strict.length,1);
  assert.equal(plain[0].required.includes('distributeParagraphs'),false);
  assert.ok(strict[0].required.includes('distributeParagraphs'));
  assert.deepEqual(strict[0].properties.distributeParagraphs.anyOf,[{type:'boolean'},{type:'null'}]);
  const {operations}=parseGeneration(JSON.stringify({message:'분할',sourceIds:[],operations:[{...command,distributeParagraphs:null}]}),true);
  assert.deepEqual(divided(operations[0]),divided(command));
});
