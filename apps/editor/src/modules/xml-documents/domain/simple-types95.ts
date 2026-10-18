import type {XmlElementValue} from '../public/contracts.ts';

const XSD='http://www.w3.org/2001/XMLSchema';
export type XmlPrimitive95='string'|'integer'|'decimal'|'boolean';
interface Bound {value:string;exclusive:boolean}
export interface XmlSimpleType95 {
 primitive:XmlPrimitive95;enumeration?:string[];minLength:number;maxLength:number;derivationDepth:number;
 minimum?:Bound;maximum?:Bound;
}
type Fail=(message:string)=>never;
const ncname=(name:string)=>/^[\p{L}_][\p{L}\p{N}_.\-\p{M}]*$/u.test(name);
const collapse=(value:string)=>value.replace(/[\t\r\n ]+/g,' ').replace(/^ | $/g,'');

/** Numeric values remain decimal strings: never round large integers/fractions through Number. */
function valueKey(type:XmlPrimitive95,raw:string):string|undefined {
 if(type==='string')return raw;
 const value=collapse(raw);
 if(type==='boolean')return value==='true'||value==='1'?'true':value==='false'||value==='0'?'false':undefined;
 if(!(type==='integer'?/^[+-]?[0-9]+$/:/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/).test(value))return;
 const negative=value[0]==='-',unsigned=value.replace(/^[+-]/,''),parts=unsigned.split('.');
 const whole=parts[0].replace(/^0+/,'')||'0',fraction=(parts[1]??'').replace(/0+$/,'');
 return(negative&&(whole!=='0'||fraction)?'-':'')+whole+(fraction?'.'+fraction:'');
}
function compareNumeric(a:string,b:string):number {
 const negativeA=a[0]==='-',negativeB=b[0]==='-';if(negativeA!==negativeB)return negativeA?-1:1;
 const [aw,af='']=a.replace(/^-/,'').split('.'),[bw,bf='']=b.replace(/^-/,'').split('.');
 let order=aw.length-bw.length;if(!order)order=aw===bw?0:aw<bw?-1:1;
 if(!order){const length=Math.max(af.length,bf.length),aa=af.padEnd(length,'0'),bb=bf.padEnd(length,'0');order=aa===bb?0:aa<bb?-1:1;}
 return negativeA?-order:order;
}
function withinBounds(key:string,type:XmlSimpleType95):boolean {
 if(type.primitive==='string'){const length=Array.from(key).length;if(length<type.minLength||length>type.maxLength)return false;}
 if(type.minimum){const order=compareNumeric(key,type.minimum.value);if(order<0||order===0&&type.minimum.exclusive)return false;}
 if(type.maximum){const order=compareNumeric(key,type.maximum.value);if(order>0||order===0&&type.maximum.exclusive)return false;}
 return true;
}
export function validSimpleValue95(raw:string,type:XmlSimpleType95):boolean {
 const key=valueKey(type.primitive,raw);return key!==undefined&&withinBounds(key,type)&&(!type.enumeration||type.enumeration.includes(key));
}

/** Explicit local atomic restriction subset. Regex/list/union/import/fixed remain unsupported. */
export function simpleTypes95(root:XmlElementValue,target:string,fail:Fail){
 const definitions=new Map<string,XmlElementValue>(),compiled=new Map<string,XmlSimpleType95>(),visiting=new Set<string>();
 function attrs(node:XmlElementValue,allowed:readonly string[]):Record<string,string>{
  const result:Record<string,string>={};
  for(const a of node.attributes){if(a.namespace||!allowed.includes(a.name)||Object.hasOwn(result,a.name))fail(`지원하지 않는 XSD 자료형 속성: ${a.name}`);result[a.name]=a.value;}
  if(!/^[\t\r\n ]*$/.test(node.text))fail('XSD 자료형 선언에 예상하지 않은 텍스트가 있습니다.');return result;
 }
 for(const node of root.children){
  if(node.namespace!==XSD||node.name!=='simpleType')continue;
  const a=attrs(node,['name']);if(!a.name||!ncname(a.name)||definitions.has(a.name))fail('XSD 단순 자료형의 이름이 없거나 중복되었습니다.');
  if(definitions.size>=128||target===XSD)fail('XSD 단순 자료형 수 또는 네임스페이스 지원 범위를 벗어났습니다.');definitions.set(a.name,node);
 }
 function resolve(node:XmlElementValue,qname:string,depth=0):XmlSimpleType95{
  const parts=qname.split(':');if(parts.length>2||parts.some(p=>!ncname(p)))return fail('XSD 자료형 QName이 올바르지 않습니다.');
  const prefix=parts.length===2?parts[0]:'',name=parts.at(-1)!;
  const namespace=Object.hasOwn(node.namespaces,prefix)?node.namespaces[prefix]:prefix?'!unbound':'';
  if(namespace===XSD&&['string','integer','decimal','boolean'].includes(name))return{primitive:name as XmlPrimitive95,minLength:0,maxLength:Infinity,derivationDepth:0};
  if(namespace!==target||!definitions.has(name))return fail(`지원하지 않거나 정의되지 않은 XSD 자료형: ${qname}`);
  if(depth>32||visiting.has(name))return fail('XSD 자료형 참조가 순환하거나 깊이 제한을 초과했습니다.');
  const cached=compiled.get(name);if(cached)return cached;
  visiting.add(name);const result=restriction(definitions.get(name)!,true,depth+1);visiting.delete(name);compiled.set(name,result);return result;
 }
 function restriction(node:XmlElementValue,named:boolean,depth=0):XmlSimpleType95 {
  if(node.namespace!==XSD||node.name!=='simpleType')return fail('인라인 simpleType 선언이 필요합니다.');attrs(node,named?['name']:[]);
  if(node.children.length!==1||node.children[0].namespace!==XSD||node.children[0].name!=='restriction')return fail('이 프로필의 simpleType은 restriction 한 개만 지원합니다. list/union은 지원하지 않습니다.');
  const r=node.children[0],a=attrs(r,['base']);if(!a.base)return fail('XSD restriction의 base 자료형이 필요합니다.');
  const base=resolve(r,a.base,depth),result:XmlSimpleType95={...base,derivationDepth:base.derivationDepth+1,enumeration:base.enumeration?[...base.enumeration]:undefined};
  if(result.derivationDepth>32)fail('XSD 자료형 참조 깊이 제한을 초과했습니다.');
  const facets=new Map<string,string>(),enumeration:string[]=[];
  for(const f of r.children){
   if(f.namespace!==XSD||!['enumeration','length','minLength','maxLength','minInclusive','minExclusive','maxInclusive','maxExclusive'].includes(f.name))fail(`지원하지 않는 XSD 제한: ${f.name}`);
   const a=attrs(f,['value']);if(a.value===undefined||f.children.length)fail('XSD 제한에는 값 한 개만 지정할 수 있습니다.');
   if(f.name==='enumeration'){if(base.primitive==='boolean')fail('XML Schema 1.0의 boolean 자료형은 enumeration 제한을 허용하지 않습니다.');const key=valueKey(base.primitive,a.value);if(key===undefined||!validSimpleValue95(a.value,base))fail('열거 값이 기본 자료형의 값 범위를 벗어났습니다.');enumeration.push(key);}
   else{if(facets.has(f.name))fail(`중복된 XSD 제한: ${f.name}`);facets.set(f.name,a.value);}
  }
  if(facets.has('minInclusive')&&facets.has('minExclusive')||facets.has('maxInclusive')&&facets.has('maxExclusive'))fail('같은 경계에 포함·제외 제한을 함께 지정할 수 없습니다.');
  if(facets.has('length')&&(facets.has('minLength')||facets.has('maxLength')))fail('이 프로필은 같은 restriction의 length와 minLength/maxLength 조합을 지원하지 않습니다.');
  for(const [name,raw]of facets){
   if(['length','minLength','maxLength'].includes(name)){
    if(base.primitive!=='string'||!/^[+]?[0-9]+$/.test(collapse(raw))||!Number.isSafeInteger(Number(raw)))fail('문자열 길이 제한은 음수가 아닌 안전한 정수여야 합니다.');
    const n=Number(raw);
    if(name==='length'){if(n<base.minLength||n>base.maxLength)fail('상속한 문자열 길이 범위를 넓힐 수 없습니다.');result.minLength=result.maxLength=n;}
    else if(name==='minLength'){if(n<base.minLength)fail('상속한 최소 길이를 줄일 수 없습니다.');result.minLength=n;}
    else{if(n>base.maxLength)fail('상속한 최대 길이를 늘릴 수 없습니다.');result.maxLength=n;}
   }else{
    if(base.primitive!=='integer'&&base.primitive!=='decimal')fail('수치 경계는 integer/decimal 자료형에만 지정할 수 있습니다.');
    const key=valueKey(base.primitive,raw);if(key===undefined)fail('수치 경계 값이 자료형에 맞지 않습니다.');
    const bound={value:key,exclusive:name.endsWith('Exclusive')};
    const old=name.startsWith('min')?base.minimum:base.maximum;
    // W3C 4.3.7–4.3.10: the facet value belongs to the base value
    // space. Exclusive facets additionally permit the exact inherited value.
    if(!validSimpleValue95(raw,base)&&!(bound.exclusive&&old?.exclusive&&key===old.value))fail('수치 경계 값이 상속한 기본 자료형의 값 범위를 벗어났습니다.');
    if(old){const order=compareNumeric(key,old.value);if(name.startsWith('min')?order<0||order===0&&old.exclusive&&!bound.exclusive:order>0||order===0&&old.exclusive&&!bound.exclusive)fail('상속한 수치 범위를 넓힐 수 없습니다.');}
    if(name.startsWith('min'))result.minimum=bound;else result.maximum=bound;
   }
  }
  if(result.minLength>result.maxLength)fail('문자열 최소 길이가 최대 길이보다 큽니다.');
  if(result.minimum&&result.maximum){const order=compareNumeric(result.minimum.value,result.maximum.value);if(order>0||order===0&&(result.minimum.exclusive||result.maximum.exclusive))fail('수치 경계의 값 범위가 비어 있습니다.');}
  if(enumeration.length)result.enumeration=[...new Set(enumeration)];
  // Facets combine by intersection. A derived range may remove inherited enum
  // members; even an empty intersection is a valid type with no valid instance.
  if(result.enumeration)result.enumeration=result.enumeration.filter(key=>withinBounds(key,result));
  return result;
 }
 // Invalid unused definitions cannot be hidden behind an unrelated root type.
 for(const[name,node]of definitions){if(!compiled.has(name)){visiting.add(name);compiled.set(name,restriction(node,true,0));visiting.delete(name);}}
 return{resolve,inline:(node:XmlElementValue)=>restriction(node,false)};
}
