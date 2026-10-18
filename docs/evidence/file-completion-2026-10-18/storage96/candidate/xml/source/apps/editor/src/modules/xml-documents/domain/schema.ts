import type {XmlElementValue,XmlValidationIssue} from '../public/contracts.ts';
import {simpleTypes95,validSimpleValue95} from './simple-types95.ts';
import type {XmlSimpleType95,XmlPrimitive95} from './simple-types95.ts';
const XSD='http://www.w3.org/2001/XMLSchema';
export interface XmlSchemaElement {name:string;namespace:string;min:number;max:number;type?:XmlPrimitive95;simple?:XmlSimpleType95;children?:XmlSchemaElement[]}
export class XmlContractError extends Error {constructor(message:string){super(message);this.name='XmlContractError';}}
const fail=(message:string):never=>{throw new XmlContractError(message);};
function attrs(node:XmlElementValue,allowed:readonly string[]):Record<string,string>{
 const found:Record<string,string>={};
 for(const a of node.attributes){if(a.namespace||!allowed.includes(a.name)||Object.hasOwn(found,a.name))fail(`지원하지 않는 XSD 속성: ${a.name}`);found[a.name]=a.value;}
 if(!/^[\t\r\n ]*$/.test(node.text))fail('XSD 선언에 예상하지 않은 텍스트가 있습니다.');return found;
}
function is(node:XmlElementValue,name:string):boolean{return node.namespace===XSD&&node.name===name;}
function occurs(value:string|undefined,unbounded:boolean):number{
 if(value===undefined)return 1;if(unbounded&&value==='unbounded')return Infinity;
 if(!/^(0|[1-9][0-9]*)$/.test(value)||!Number.isSafeInteger(Number(value)))return fail('XSD 발생 횟수가 올바르지 않습니다.');
 return Number(value);
}
/** An explicit, fail-closed profile, not a general XSD conformance claim. */
export function compileXmlSchema(root:XmlElementValue):XmlSchemaElement{
 if(!is(root,'schema'))return fail('XML Schema 네임스페이스의 schema 문서가 필요합니다.');
 const a=attrs(root,['targetNamespace','elementFormDefault','version']);
 if(a.elementFormDefault!==undefined&&!['qualified','unqualified'].includes(a.elementFormDefault))fail('elementFormDefault 값이 올바르지 않습니다.');
 const roots=root.children.filter(n=>is(n,'element'));
 if(roots.length!==1||root.children.some(n=>!is(n,'element')&&!is(n,'simpleType')))return fail('이 프로필은 전역 루트 요소 한 개와 로컬 simpleType 선언만 지원합니다. include/import·외부 형식은 지원하지 않습니다.');
 const target=a.targetNamespace??'';
 if(a.targetNamespace!==undefined&&!/^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(target))fail('이 프로필의 targetNamespace는 공백 없는 절대 URI여야 합니다.');
 const types=simpleTypes95(root,target,fail);
 function element(node:XmlElementValue,global:boolean,depth:number):XmlSchemaElement{
  if(depth>32) return fail('XSD 구조 깊이 제한을 초과했습니다.');
  if(!is(node,'element'))return fail('이 프로필은 sequence 안의 명시적 element 선언만 지원합니다.');
  const a=attrs(node,global?['name','type']:['name','type','minOccurs','maxOccurs']);
  if(!a.name||a.name.includes(':')||!/^[\p{L}_][\p{L}\p{N}_.\-\p{M}]*$/u.test(a.name))return fail('지원하는 명시적 XSD 요소 이름이 필요합니다.');
  const min=global?1:occurs(a.minOccurs,false),max=global?1:occurs(a.maxOccurs,true);if(min>max)fail('minOccurs가 maxOccurs보다 큽니다.');
  const result:XmlSchemaElement={name:a.name,namespace:global||root.attributes.some(x=>x.name==='elementFormDefault'&&x.value==='qualified')?target:'',min,max};
  if(a.type!==undefined){if(node.children.length)fail('type과 인라인 자료형을 함께 지정할 수 없습니다.');result.simple=types.resolve(node,a.type);result.type=result.simple.primitive;return result;}
  if(node.children.length===1&&is(node.children[0],'simpleType')){result.simple=types.inline(node.children[0]);result.type=result.simple.primitive;return result;}
  if(node.children.length!==1||!is(node.children[0],'complexType'))return fail('명시적 기본 자료형 또는 인라인 complexType/sequence가 필요합니다.');
  const complex=node.children[0];attrs(complex,[]);
  if(complex.children.length!==1||!is(complex.children[0],'sequence'))return fail('choice/all/혼합 내용·속성 선언은 이 프로필에서 지원하지 않습니다.');
  const sequence=complex.children[0];attrs(sequence,[]);
  const children=sequence.children.map(c=>element(c,false,depth+1));
  const names=children.map(c=>c.namespace+'\0'+c.name);if(new Set(names).size!==names.length)fail('이 프로필은 같은 sequence 안의 중복 요소 선언을 지원하지 않습니다.');
  result.children=children;return result;
 }
 return element(roots[0],true,0);
}
export function validateXmlInstance(root:XmlElementValue,schema:XmlSchemaElement):XmlValidationIssue[]{
 const issues:XmlValidationIssue[]=[];const add=(path:string,message:string)=>{if(issues.length<100)issues.push({path,message});};
 function check(node:XmlElementValue,decl:XmlSchemaElement,path:string):void{
  if(issues.length>=100)return;
  if(node.name!==decl.name||node.namespace!==decl.namespace){add(path,'요소의 이름 또는 네임스페이스가 스키마와 다릅니다.');return;}
  if(node.attributes.length)add(path,'이 프로필은 XML 인스턴스의 일반 속성·xsi 속성을 지원하지 않습니다.');
  if(decl.type){
   if(node.children.length)add(path,'단순 자료형 요소에 자식 요소가 있습니다.');
   const valid=Boolean(decl.simple&&validSimpleValue95(node.text,decl.simple));
   if(!valid)add(path,`${decl.type} 자료형에 맞지 않는 값입니다.`);return;
  }
  if(!/^[\t\r\n ]*$/.test(node.text))add(path,'sequence 요소에는 혼합 텍스트를 넣을 수 없습니다.');
  let index=0;
  for(const child of decl.children??[]){let count=0;while(index<node.children.length&&node.children[index].name===child.name&&node.children[index].namespace===child.namespace){check(node.children[index],child,`${path}/${child.name}[${count+1}]`);index++;count++;}if(count<child.min||count>child.max)add(path,`${child.name} 발생 횟수가 스키마 범위를 벗어났습니다.`);}
  if(index!==node.children.length)add(path,'스키마에 없는 요소 또는 순서가 다른 요소가 있습니다.');
 }
 check(root,schema,`/${schema.name}`);return issues;
}
