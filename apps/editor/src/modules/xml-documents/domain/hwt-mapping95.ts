import type {XmlElementValue} from '../public/contracts.ts';

const XSD='http://www.w3.org/2001/XMLSchema';
export class HwtMappingError95 extends Error {constructor(message:string){super(message);this.name='HwtMappingError95';}}
export interface HwtMappingEntry95 {
 name:string;schemaXPath:string;mappingPath:number[];schemaElementPath:number[];
 /** A schema address proves no HWP field/control address. */
 bodyBinding:'unverified';
}
export interface HwtMappingRead95 {profile:'hwt-schema-addresses-v1';readOnly:true;entries:HwtMappingEntry95[];limitations:readonly string[]}
const fail=(message:string):never=>{throw new HwtMappingError95(message);};
const key=(path:readonly number[])=>JSON.stringify(path);

/**
 * Read the observed literal SchemaXPath dialect, never execute arbitrary XPath.
 * This resolves schema addresses only. It cannot grant HWP document write rights.
 */
export function readHwtMapping95(schema:XmlElementValue,mapping:XmlElementValue):HwtMappingRead95 {
 if(schema.name!=='schema'||schema.namespace!==XSD)fail('HWT Schema 스트림은 XML Schema 문서여야 합니다.');
 const seen=new Set<string>(),entries:HwtMappingEntry95[]=[],positions=new Map<XmlElementValue,Map<string,number[]>>();
 function childIndexes(node:XmlElementValue,name:string):readonly number[]{
  let byName=positions.get(node);if(!byName){byName=new Map();node.children.forEach((n,i)=>{if(n.namespace===XSD){const list=byName!.get(n.name)??[];list.push(i);byName!.set(n.name,list);}});positions.set(node,byName);}
  return byName.get(name)??[];
 }
 function address(raw:string):{node:XmlElementValue;path:number[];elementAncestors:number[][]}{
  if(raw.length>4096||!raw.startsWith('/xs:schema/'))return fail('지원하지 않는 HWT SchemaXPath 문법입니다.');
  const steps=raw.slice('/xs:schema/'.length).split('/');if(steps.length>64)return fail('HWT 스키마 주소 깊이 제한을 초과했습니다.');
  let node=schema;const path:number[]=[],elementAncestors:number[][]=[];
  for(const step of steps){
   const match=/^xs:(element|complexType|sequence)\[position\(\)=([1-9][0-9]{0,5})\]$/.exec(step);
   if(!match)return fail('지원하지 않는 HWT SchemaXPath 단계입니다.');
   const index=childIndexes(node,match[1])[Number(match[2])-1];if(index===undefined)return fail('HWT 스키마 주소가 존재하지 않습니다.');
   node=node.children[index];path.push(index);if(node.name==='element')elementAncestors.push([...path]);
  }
  if(node.name!=='element'||node.namespace!==XSD)return fail('HWT 매핑 주소가 element 선언을 가리키지 않습니다.');
  return{node,path,elementAncestors};
 }
 function visit(node:XmlElementValue,path:number[],parent?:HwtMappingEntry95):void{
  if(entries.length>=4096||path.length>32)fail('HWT 매핑 수 또는 깊이 제한을 초과했습니다.');
  if(node.namespace||node.name!=='XMLELEMENT'||!/^[\t\r\n ]*$/.test(node.text))fail('지원하지 않는 HWT 매핑 구조입니다.');
  if(Object.hasOwn(node.namespaces,'xs')&&node.namespaces.xs!==XSD)fail('HWT 스키마 주소의 xs 네임스페이스가 다릅니다.');
  const attrs=new Map<string,string>();
  for(const a of node.attributes){if(a.namespace||!['Name','SchemaXPath'].includes(a.name)||attrs.has(a.name))fail('지원하지 않거나 중복된 HWT 매핑 속성입니다.');attrs.set(a.name,a.value);}
  const name=attrs.get('Name'),xpath=attrs.get('SchemaXPath');if(!name||!xpath||name.length>512)return fail('HWT 매핑의 Name과 SchemaXPath가 필요합니다.');
  const target=address(xpath),names=target.node.attributes.filter(a=>!a.namespace&&a.name==='name');
  if(names.length!==1||names[0].value!==name)fail('HWT 매핑 Name이 실제 스키마 선언과 다릅니다.');
  const owner=key(target.path);if(seen.has(owner))fail('HWT 매핑의 스키마 주소가 중복됩니다.');seen.add(owner);
  const ancestors=target.elementAncestors;
  if(parent?ancestors.length<2||key(ancestors.at(-2)!)!==key(parent.schemaElementPath):ancestors.length!==1)fail('HWT 매핑 부모와 스키마 요소 소유가 다릅니다.');
  const entry:HwtMappingEntry95={name,schemaXPath:xpath,mappingPath:[...path],schemaElementPath:[...target.path],bodyBinding:'unverified'};
  entries.push(entry);const siblingNames=new Set<string>();
  node.children.forEach((child,i)=>{const childName=child.attributes.find(a=>!a.namespace&&a.name==='Name')?.value;if(childName&&siblingNames.has(childName))fail('같은 부모의 HWT 매핑 이름이 모호합니다.');if(childName)siblingNames.add(childName);visit(child,[...path,i],entry);});
 }
 visit(mapping,[]);
 return{profile:'hwt-schema-addresses-v1',readOnly:true,entries,limitations:['SchemaXPath는 XSD 선언 위치만 증명합니다. HWP 본문 필드와의 연결·값 편집·HWT 재저장은 지원하지 않습니다.','일반 XSD 유효성·XSL 지면 변환을 검증한 결과가 아닙니다.']};
}
