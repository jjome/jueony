import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureTemplate,materializeTemplate,templateVariables,draftTemplate} from '../src/macros/commands.ts';
const base:any={revision:'a',name:'a.hwp',nodes:[{id:'s0p0',section:0,paragraph:0,text:'제목',editable:true}],limitations:[]};
test('recorded edit resolves original text after paragraphs move and validates variables',()=>{
 const template=captureTemplate({message:'test',sourceIds:[],operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:2,text:'{{연도}} 계획'}]},base);
 const current={...base,nodes:[{...base.nodes[0],id:'s0p4',paragraph:4}]};
 assert.deepEqual(templateVariables(template),['연도']);
 const result=materializeTemplate(template,current,{'연도':'2027'});
 assert.deepEqual(result.operations,[{kind:'replace_body_text',target:'s0p4',start:0,count:2,text:'2027 계획'}]);
 assert.equal(template.operations[0].kind,'replace_body_text');assert.equal((template.operations[0] as any).target,'s0p0');
});
test('replay rejects ambiguous, deleted, protected and forged anchors',()=>{
 const t=captureTemplate({message:'test',sourceIds:[],operations:[{kind:'delete_body_text',target:'s0p0',start:0,count:2}]},base);
 assert.throws(()=>materializeTemplate(t,{...base,nodes:[base.nodes[0],{...base.nodes[0],id:'s0p1'}]},{}),/여러 개/);
 assert.throws(()=>materializeTemplate(t,{...base,nodes:[]},{}),/사라/);
 assert.throws(()=>materializeTemplate(t,{...base,nodes:[{...base.nodes[0],editable:false}]},{}),/사라/);
 assert.throws(()=>materializeTemplate({...t,anchors:{}},base,{}),/대상 정보/);
});
test('template variables cannot inject commands or invalid control characters',()=>{
 const t=draftTemplate('official-letter');const values=Object.fromEntries(templateVariables(t).map(n=>[n,'입력']));
 assert.throws(()=>materializeTemplate(t,base,{}),/변수를 입력/);
 assert.throws(()=>materializeTemplate(t,base,{...values,'수신':'a\nb'}),/줄바꿈/);
 const result=materializeTemplate(t,base,{...values,'수신':'"}],"kind":"delete"'});
 assert.equal(result.operations.length,1);assert.equal(result.operations[0].kind,'create_document');
});
test('draft templates are explicit editable placeholders and do not make up facts',()=>{
 for(const kind of ['official-letter','plan','report'] as const){const t=draftTemplate(kind);assert.ok(templateVariables(t).length>=5);assert.equal(t.operations[0].kind,'create_document');}
});

test('two original anchors must never collapse into a single current paragraph',()=>{
 const template:any={version:1,anchors:{s0p0:'제목',s0p1:'제목'},operations:[{kind:'format_paragraph',target:'s0p0',properties:{alignment:'left'}},{kind:'format_paragraph',target:'s0p1',properties:{alignment:'right'}}]};
 assert.throws(()=>materializeTemplate(template,base,{}),/서로 다른 기준 문단/);
});
