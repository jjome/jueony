import type {XmlCodecPort,XmlElementValue} from '../../modules/xml-documents/public/index.ts';
import {XmlContractError} from '../../modules/xml-documents/public/index.ts';
const XMLNS='http://www.w3.org/2000/xmlns/';
function parse(source:string):XMLDocument{
 if(typeof source!=='string'||new TextEncoder().encode(source).length>2_000_000)throw new XmlContractError('XML 파일은 UTF-8 2MB 이하여야 합니다.');
 if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new XmlContractError('DTD·외부 엔티티가 있는 XML은 지원하지 않습니다.');
 if(/<\?(?!xml\s)/i.test(source))throw new XmlContractError('외부 스타일시트 등 처리 명령이 있는 XML은 지원하지 않습니다.');
 const decl=/^\uFEFF?\s*<\?xml\s[^?]*\?>/.exec(source)?.[0];
 if(decl&&(/version\s*=\s*['"](?!1\.0['"])/.test(decl)||/encoding\s*=\s*['"](?!utf-8['"])/i.test(decl)))throw new XmlContractError('XML 1.0 UTF-8 문서만 지원합니다.');
 const doc=new DOMParser().parseFromString(source,'application/xml');
 if(doc.getElementsByTagNameNS('http://www.mozilla.org/newlayout/xml/parsererror.xml','parsererror').length||!doc.documentElement)throw new XmlContractError('XML 문법이 올바르지 않습니다.');
 let count=0;function bounds(node:Element,depth:number){if(++count>5000||depth>32)throw new XmlContractError('XML 요소 수 또는 깊이 제한을 초과했습니다.');for(const c of node.children)bounds(c,depth+1);}bounds(doc.documentElement,0);return doc;
}
function tree(element:Element,inherited:Record<string,string>={}):XmlElementValue{
 const namespaces:Record<string,string>=Object.assign(Object.create(null),inherited);for(const a of element.attributes)if(a.namespaceURI===XMLNS)namespaces[a.name==='xmlns'?'':a.localName]=a.value;
 return{namespace:element.namespaceURI??'',name:element.localName,namespaces,attributes:[...element.attributes].filter(a=>a.namespaceURI!==XMLNS).map(a=>({namespace:a.namespaceURI??'',name:a.localName,value:a.value})),text:[...element.childNodes].filter(n=>n.nodeType===3||n.nodeType===4).map(n=>n.textContent??'').join(''),children:[...element.children].map(c=>tree(c,namespaces))};
}
function at(doc:XMLDocument,path:readonly number[]):Element{let node:Element=doc.documentElement;for(const i of path){const next=node.children.item(i);if(!next)throw new XmlContractError('XML 요소가 없습니다.');node=next;}return node;}
function serialize(doc:XMLDocument):string{const result=new XMLSerializer().serializeToString(doc);parse(result);return result;}
export const browserXmlCodec:XmlCodecPort={
 parse:source=>tree(parse(source).documentElement),
 replaceText(source,path,text){const doc=parse(source),node=at(doc,path);if(node.children.length)throw new XmlContractError('복합 요소의 전체 내용은 교체할 수 없습니다.');const texts=[...node.childNodes].filter(n=>n.nodeType===3||n.nodeType===4);if(texts.length){texts[0].replaceWith(doc.createTextNode(text));for(const n of texts.slice(1))n.remove();}else node.append(doc.createTextNode(text));const result=serialize(doc);if(tree(at(parse(result),path)).text!==text)throw new XmlContractError('이 XML 문자 값은 손실 없이 저장할 수 없습니다.');return result;},
 repeat(source,path){const doc=parse(source),node=at(doc,path);if(!path.length||!node.parentNode)throw new XmlContractError('루트 요소는 반복할 수 없습니다.');node.parentNode.insertBefore(node.cloneNode(true),node.nextSibling);return serialize(doc);},
 remove(source,path){const doc=parse(source),node=at(doc,path);if(!path.length)throw new XmlContractError('루트 요소는 삭제할 수 없습니다.');node.remove();return serialize(doc);},
};
export function decodeXmlUtf8(bytes:Uint8Array):string{if(bytes.byteLength>2_000_000)throw new XmlContractError('XML 파일은 2MB 이하여야 합니다.');try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new XmlContractError('UTF-8 인코딩이 올바르지 않습니다.');}}
