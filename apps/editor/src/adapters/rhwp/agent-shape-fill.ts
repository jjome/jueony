import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {shapeFillTarget,type ShapeFillSource,type SetShapeFill} from '../../modules/document/public/engine-integration.ts';
import type {Snapshot} from '../../modules/document/public/index.ts';

const parsed=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const hash=(value:unknown)=>bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(value))));
const colorRef=(value:string)=>parseInt(value.slice(1,3),16)+parseInt(value.slice(3,5),16)*256+parseInt(value.slice(5,7),16)*65536;
const colorHex=(value:number)=>'#'+[value&255,(value>>>8)&255,(value>>>16)&255].map(v=>v.toString(16).padStart(2,'0')).join('');

export function readShapeFillSources(doc:any,enabled:boolean):Record<string,ShapeFillSource>|undefined{
 if(!enabled||typeof doc.getShapeProperties!=='function'||typeof doc.setShapeProperties!=='function')return;
 try{
  const controls=parsed(doc.getControls());
  const shapes=controls.filter((control:any)=>control.list===0&&control.ctrlId==='gso'&&control.props?.Lock===0);
  if(!shapes.length||shapes.length>32)return;
  const objects=parsed(doc.getObjects()),lists=parsed(doc.getCursorModel()).lists;
  if(!Array.isArray(objects)||!Array.isArray(lists))return;
  const locations:{section:number;paragraph:number}[]=[];
  for(let section=0;section<doc.getSectionCount();section++){
   for(let paragraph=0;paragraph<doc.getParagraphCount(section);paragraph++)locations.push({section,paragraph});
  }
  const sources:Record<string,ShapeFillSource>=Object.create(null);
  for(const control of shapes){
   const location=locations[control.para],index=control.controlIndex;
   if(!location||!Number.isSafeInteger(index)||index<0)continue;
   const {section,paragraph}=location;
   const object=objects.find(item=>item.para===control.para&&item.controlIndex===index&&item.kind==='shape'&&item.listId===null&&item.anchored===true);
   if(!object||lists.some(list=>list.hostListId===0&&list.sectionIndex===section&&list.hostPara===paragraph&&list.controlIndex===index))continue;
   const properties=parsed(doc.getShapeProperties(section,paragraph,index));
   const {instanceId,scInstId,fillType,fillBgColor,fillAlpha,fillPatType,hasCaption,sizeProtect,...attributes}=properties;
   if(!Number.isInteger(instanceId)||instanceId<=0||!Number.isInteger(scInstId)||scInstId<=0||
      hasCaption!==false||sizeProtect!==false||fillType!=='solid'||!Number.isInteger(fillPatType)||fillPatType>=0||fillAlpha!==0||
      !Number.isInteger(fillBgColor)||fillBgColor<0||fillBgColor>0xffffff)continue;
   const type=object.shapeType??control.userDesc;
   if(typeof type!=='string'||type.length>80)continue;
   const templateFingerprint=hash([type,fillBgColor,attributes]);
   const id=`s${section}p${paragraph}o${index}`;
   sources[id]={section,paragraph,control:index,color:colorHex(fillBgColor),templateFingerprint,
    fingerprint:hash([id,instanceId,scInstId,object,control,properties])};
  }
  return Object.keys(sources).length?sources:undefined;
 }catch{return;}
}

export function executeShapeFill(doc:any,base:Snapshot,op:SetShapeFill):void{
 const source=shapeFillTarget(op,base),live=readShapeFillSources(doc,true);
 if(live?.[op.target]?.fingerprint!==source.fingerprint)throw new Error('현재 도형의 위치 또는 속성이 바뀌었습니다.');
 const {section,paragraph,control}=source;
 const previous=parsed(doc.getShapeProperties(section,paragraph,control));
 const expected={...previous,fillBgColor:colorRef(op.color)};
 const result=parsed(doc.setShapeProperties(section,paragraph,control,JSON.stringify({fillBgColor:expected.fillBgColor})));
 const next=parsed(doc.getShapeProperties(section,paragraph,control));
 if(result?.ok!==true||JSON.stringify(next)!==JSON.stringify(expected))throw new Error('다른 도형 속성과 채우기 색을 대조하지 못했습니다.');
}
