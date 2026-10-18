import test from 'node:test';
import assert from 'node:assert/strict';
import {compileXmlSchema,validateXmlInstance,createXmlWorkspace,restoreXmlWorkspace} from '../src/modules/xml-documents/public/index.ts';
import type {XmlElementValue,XmlCodecPort} from '../src/modules/xml-documents/public/index.ts';

const XS='http://www.w3.org/2001/XMLSchema';
function element(name:string,children:XmlElementValue[]=[],attributes:Record<string,string>={},text='',namespace=''):XmlElementValue{return{name,namespace,children,text,namespaces:{xs:XS,t:'urn:own95'},attributes:Object.entries(attributes).map(([name,value])=>({namespace:'',name,value}))};}
const xs=(name:string,children:XmlElementValue[]=[],attributes:Record<string,string>={})=>element(name,children,attributes,'',XS);
const facet=(name:string,value:string)=>xs(name,[],{value});
function simple(name:string,base:string,facets:XmlElementValue[]){return xs('simpleType',[xs('restriction',facets,{base})],{name});}
function schema(definitions:XmlElementValue[],type:string,target=''){const s=xs('schema',[xs('element',[xs('complexType',[xs('sequence',[xs('element',[],{name:'value',type})])])],{name:'report'}),...definitions],target?{targetNamespace:target,elementFormDefault:'qualified'}:{});return s;}
function instance(value:string,target=''){return element('report',[element('value',[],{},value,target)],{},'',target);}
const valid=(s:XmlElementValue,value:string,target='')=>validateXmlInstance(instance(value,target),compileXmlSchema(s)).length===0;
function at(root:XmlElementValue,path:readonly number[]){for(const i of path)root=root.children[i];return root;}
// Domain orchestration uses a tree codec here; the independent raw-XML test is separate.
const codec:XmlCodecPort={parse:JSON.parse,replaceText(s,path,text){const tree=JSON.parse(s);at(tree,path).text=text;return JSON.stringify(tree);},repeat(){throw Error('unused');},remove(){throw Error('unused');}};

test('named restrictions resolve forward declarations and namespace-qualified references',()=>{
 const s=schema([simple('Small','t:Label',[facet('maxLength','3')]),simple('Label','xs:string',[facet('minLength','1')])],'t:Small','urn:own95');
 assert.equal(valid(s,'가😀','urn:own95'),true);assert.equal(valid(s,'','urn:own95'),false);assert.equal(valid(s,'네글자임','urn:own95'),false);
});
test('numeric restriction comparisons retain decimal precision beyond Number safe range',()=>{
 const s=schema([simple('Precise','xs:decimal',[facet('minExclusive','9007199254740992.000000000000000001'),facet('maxInclusive','9007199254740992.000000000000000003')])],'Precise');
 for(const n of['9007199254740992.000000000000000002','9007199254740992.000000000000000003'])assert.equal(valid(s,n),true,n);
 for(const n of['9007199254740992.000000000000000001','9007199254740992.000000000000000004','1e30'])assert.equal(valid(s,n),false,n);
});
test('enumeration follows typed value equality without normalizing exported source text',()=>{
 for(const[type,enumerated,accepted,rejected]of[['xs:integer','+0002','2','3'],['xs:decimal','-0.0','+0.00','0.01'],['xs:string',' A ',' A ','A']]){
  const s=schema([simple('Choice',type,[facet('enumeration',enumerated)])],'Choice');assert.equal(valid(s,accepted),true);assert.equal(valid(s,rejected),false);
 }
 assert.throws(()=>compileXmlSchema(schema([simple('Bool','xs:boolean',[facet('enumeration','1')])],'Bool')));
 const bool=schema([simple('Bool','xs:boolean',[])],'Bool');assert.equal(valid(bool,'1'),true);assert.equal(valid(bool,'false'),true);assert.equal(valid(bool,'TRUE'),false);
});
test('string length counts XML characters and preserves whitespace and combining marks',()=>{
 const s=schema([simple('Two','xs:string',[facet('length','2')])],'Two');for(const value of['가😀','e\u0301',' A'])assert.equal(valid(s,value),true,value);for(const value of['😀','가😀나',' A '])assert.equal(valid(s,value),false,value);
});
test('derived restrictions cannot widen an inherited range, length or enumeration',()=>{
 for(const defs of[
  [simple('Base','xs:integer',[facet('minInclusive','3')]),simple('Child','Base',[facet('minInclusive','2')])],
  [simple('Base','xs:string',[facet('maxLength','2')]),simple('Child','Base',[facet('maxLength','3')])],
  [simple('Base','xs:string',[facet('enumeration','a')]),simple('Child','Base',[facet('enumeration','b')])],
 ])assert.throws(()=>compileXmlSchema(schema(defs,'Child')));
 const s=schema([simple('Base','xs:integer',[facet('minInclusive','-9'),facet('maxInclusive','9')]),simple('Child','Base',[facet('minExclusive','0'),facet('enumeration','2')])],'Child');assert.equal(valid(s,'+02'),true);assert.equal(valid(s,'0'),false);
});
test('derived facets intersect inherited enumerations, including a valid empty value space',()=>{
 const base=simple('Base','xs:integer',[facet('enumeration','1'),facet('enumeration','2')]);
 const s=schema([base,simple('Child','Base',[facet('minInclusive','2')])],'Child');assert.equal(valid(s,'2'),true);assert.equal(valid(s,'1'),false);
 const empty=schema([simple('Empty','xs:integer',[facet('minInclusive','2'),facet('enumeration','1')])],'Empty');assert.equal(valid(empty,'1'),false);assert.equal(valid(empty,'2'),false);
});
test('numeric facet values belong to the base value space with the primary same-exclusive exception',()=>{
 const base=simple('Base','xs:integer',[facet('enumeration','1'),facet('enumeration','2')]);
 for(const [name,value]of[['minInclusive','0'],['minInclusive','3'],['maxInclusive','0'],['maxExclusive','3'],['minExclusive','0']])assert.throws(()=>compileXmlSchema(schema([base,simple('Child','Base',[facet(name,value)])],'Child')));
 const empty=schema([base,simple('Child','Base',[facet('minExclusive','2')])],'Child');assert.equal(valid(empty,'1'),false);assert.equal(valid(empty,'2'),false);
 // W3C 4.3.8/4.3.9 allow the same inherited exclusive value, even though
 // libxml2 rejects this declaration. Do not match that reader by over-rejecting.
 for(const facetName of['minExclusive','maxExclusive']){
  const fs=[facet('minExclusive','1'),facet('maxExclusive','5')],value=facetName==='minExclusive'?'1':'5';
  const s=schema([simple('Base','xs:integer',fs),simple('Child','Base',[facet(facetName,value)])],'Child');assert.equal(valid(s,'2'),true);assert.equal(valid(s,'1'),false);assert.equal(valid(s,'5'),false);
 }
});
test('contradictory facets, duplicate facets and invalid facet values refuse schema compilation',()=>{
 for(const fs of[[facet('minInclusive','2'),facet('maxExclusive','2')],[facet('minInclusive','1'),facet('minExclusive','2')],[facet('maxLength','2'),facet('maxLength','3')],[facet('minLength','2'),facet('maxLength','1')],[facet('length','-1')],[facet('minInclusive','NaN')],[facet('enumeration','not-an-integer')]])assert.throws(()=>compileXmlSchema(schema([simple('Bad',fs[0].name.includes('Length')||fs[0].name==='length'?'xs:string':'xs:integer',fs)],'Bad')));
});
test('unknown and cyclic type references, spoofed prefixes and duplicate declarations fail closed',()=>{
 for(const defs of[[simple('A','B',[]),simple('B','A',[])],[simple('A','Missing',[])],[simple('A','xs:string',[]),simple('A','xs:string',[])]])assert.throws(()=>compileXmlSchema(schema(defs,'A')));
 const s=schema([simple('A','xs:string',[])],'t:A','urn:own95');s.children[0].children[0].children[0].children[0].namespaces.t='urn:spoof';assert.throws(()=>compileXmlSchema(s));
});
test('unsupported regex, unions, lists, fixed facets and external composition are never ignored',()=>{
 for(const f of['pattern','whiteSpace','fractionDigits','totalDigits'])assert.throws(()=>compileXmlSchema(schema([simple('A','xs:string',[facet(f,'1')])],'A')));
 for(const kind of['list','union']){const s=schema([xs('simpleType',[xs(kind,[],{})],{name:'A'})],'A');assert.throws(()=>compileXmlSchema(s));}
 const fixed=facet('maxLength','4');fixed.attributes.push({namespace:'',name:'fixed',value:'true'});assert.throws(()=>compileXmlSchema(schema([simple('A','xs:string',[fixed])],'A')));
});
test('all unused declarations are validated and bounded before a workspace is exposed',()=>{
 assert.throws(()=>compileXmlSchema(schema([simple('Unused','xs:unknown',[])],'xs:string')));
 const chain=Array.from({length:34},(_,i)=>simple(`T${i}`,i===33?'xs:string':`T${i+1}`,[]));assert.throws(()=>compileXmlSchema(schema(chain,'T0')));assert.throws(()=>compileXmlSchema(schema(chain.reverse(),'T0')));
});
test('restricted edits validate atomically and Undo/Redo recovery retains exact schema and history',()=>{
 const s=JSON.stringify(schema([simple('Choice','xs:string',[facet('enumeration','대기'),facet('enumeration','완료')])],'Choice')),source=JSON.stringify(instance('대기')),w=createXmlWorkspace(codec,source,s);
 const before=w.snapshot(),artifact=w.exportArtifact();assert.throws(()=>w.edit({kind:'replace',revision:0,path:[0],originalText:'대기',text:'잘못된 값'}));assert.deepEqual(w.snapshot(),before);assert.deepEqual(w.exportArtifact(),artifact);
 w.edit({kind:'replace',revision:0,path:[0],originalText:'대기',text:'완료'});w.undo();const recovered=restoreXmlWorkspace(codec,w.captureRecovery());assert.equal(recovered.snapshot().dirty,false);assert.equal(recovered.exportArtifact().schema,s);recovered.redo();assert.equal(recovered.snapshot().fields[1].value,'완료');recovered.undo();assert.equal(recovered.exportArtifact().xml,source);
 const invalid=w.captureRecovery();invalid.future=[JSON.stringify(instance('not enumerated'))];assert.throws(()=>restoreXmlWorkspace(codec,invalid));
});
