import {sha256} from '@noble/hashes/sha2.js';
import type {Cell,CellPicturePlacement} from '../../modules/document/public/types.ts';

const json=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const digest=(bytes:Uint8Array)=>Array.from(sha256(bytes),v=>v.toString(16).padStart(2,'0')).join('');

function picturePage(doc:any) {
 if(doc.pageCount()!==1)return null;
 const layout=json(doc.getPageControlLayout(0)).controls;
 const pictures=layout.filter((c:any)=>c.type==='image');
 const canvas=doc.canvasMetricsActive?.()===true;
 // Export paint operations require portable font metrics. Retain the actual
 // screen frames separately and match the stored control path in both layouts.
 try{
  if(canvas)doc.selectCanvasMetrics(false);
  if(doc.canvasMetricsActive?.()===true||doc.pageCount()!==1)return null;
  const portablePictures=canvas?json(doc.getPageControlLayout(0)).controls.filter((c:any)=>c.type==='image'):pictures;
  const painted=json(doc.getPageFlowImageOps(0)),resources=json(doc.getPageSourceImageKeys(0));
  if(portablePictures.length!==pictures.length||painted.cacheable!==true||!Array.isArray(painted.images)||
     resources.cacheable!==true||!Array.isArray(resources.keys))return null;
  return {layout,pictures,portablePictures,painted:painted.images as any[],keys:new Set<string>(resources.keys),
   fields:json(doc.getFieldList()),assets:new Map<string,string>()};
 }finally{
  if(canvas){
   doc.selectCanvasMetrics(true);
   if(doc.canvasMetricsActive()!==true)throw Error('그림 검사 후 화면 측정 환경을 복원하지 못했습니다.');
  }
 }
}

// Layout rounds to tenths of a pixel and paint ops to thousandths. Accept only
// a unique match in both sets at the precision of these two native queries.
function sameBounds(picture:any,box:any) {
 return box && Math.abs(picture.x-box.x)<=.051 && Math.abs(picture.y-box.y)<=.051 &&
  Math.abs(picture.w-box.width)<=.051 && Math.abs(picture.h-box.height)<=.051;
}

function assetHash(bytes:Uint8Array,mime:string) {
 if(!(bytes instanceof Uint8Array)||bytes.length<8||bytes.length>8*1024*1024)return;
 const png=mime==='image/png' && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const jpeg=mime==='image/jpeg' && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
 if(png||jpeg)return digest(bytes);
}

/** Layout and asset keys are local to one read-only snapshot. An edit or reopen
 * gets a fresh reader, even if the engine reuses the same native handle. */
export function axisPictureReader(doc:any) {
 let page:ReturnType<typeof picturePage>|undefined;
 return (section:number,paragraph:number,control:number,cell:Cell,paragraphCount:number,children:any[]):Cell['axisPicture']=>{
  if(!Number.isSafeInteger(paragraphCount)||paragraphCount<1||paragraphCount>50||cell.text.length>4000||
     !children.length||cell.properties.fieldName!==''||cell.properties.cellProtect!==false)return;
  if(page===undefined)page=picturePage(doc);
  if(!page)return;
  if(page.fields.some((f:any)=>{
   const loc=f.location,first=loc?.path?.[0];
   return f.listId===children[0].list || loc?.sectionIndex===section && loc?.paraIndex===paragraph &&
    first?.type==='cell' && first.controlIndex===control && first.cellIndex===cell.index;
  }))return;
  const inCell=page.pictures.filter((c:any)=>c.secIdx===section && c.parentParaIdx===paragraph &&
    c.cellPath?.length===1 && c.cellPath[0].controlIndex===control && c.cellPath[0].cellIndex===cell.index);
  if(inCell.length!==children.length)return;
  const tables=page.layout.filter((c:any)=>c.type==='table' && c.secIdx===section && c.paraIdx===paragraph &&
    c.controlIdx===control && !c.cellPath?.length);
  const owners=tables.length===1?tables[0].cells.filter((c:any)=>c.cellIdx===cell.index&&c.row===cell.row&&c.col===cell.column):[];
  if(owners.length!==1)return;
  const pictures=[];
  for(const [i,child] of children.entries()){
   const previous=children[i-1],para=child.para;
   const nextIndex=previous?.para===para?previous.controlIndex+1:0;
   if(child.list!==children[0].list || !Number.isSafeInteger(para) || para<0 || para>=paragraphCount ||
      previous && para<previous.para || child.controlIndex!==nextIndex || !Number.isSafeInteger(child.pos) ||
      child.pos<0 || previous?.para===para && child.pos<=previous.pos)return;
   const path=JSON.stringify([{controlIndex:control,cellIndex:cell.index,cellParaIndex:para}]);
   const matches=inCell.filter((c:any)=>c.controlIdx===nextIndex && JSON.stringify(c.cellPath)===path);
   if(matches.length!==1)return;
   const picture=matches[0];
   if(picture.outerTableControlIdx!==control || picture.cellIdx!==cell.index || picture.cellParaIdx!==para)return;
   const placement=readPicture(doc,page,section,paragraph,path,child,picture,owners[0]);
   if(!placement)return;
   pictures.push({...placement,cellParaIndex:para,controlIndex:nextIndex});
  }
  const {left,top,signature}=pictures[0];
  if(pictures.length===1)return {signature,left,top};
  return {signature:digest(new TextEncoder().encode(JSON.stringify(pictures.map(p=>p.signature)))),left,top,pictures};
 };
}

function readPicture(doc:any,page:NonNullable<ReturnType<typeof picturePage>>,
 section:number,paragraph:number,storedPath:string,child:any,picture:any,owner:any):CellPicturePlacement|undefined {
 if(child.ctrlId!=='gso' || child.ctrlCh!==11 || child.userDesc!=='그림' ||
    child.props?.Lock!==0 || child.props.TreatAsChar!==1)return;
 const p=json(doc.getCellPicturePropertiesByPath(section,paragraph,storedPath,child.controlIndex));
 if(p.treatAsChar!==true || p.hasCaption!==false || p.sizeProtect!==false || p.allowOverlap!==false ||
    'externalPath' in p || p.horzFlip!==false || p.vertFlip!==false || p.effect!=='RealPic' ||
    [p.cropLeft,p.cropRight,p.cropTop,p.cropBottom,p.rotationAngle,p.transparency,p.brightness,p.contrast].some(v=>v!==0) ||
    ![p.width,p.height].every(v=>Number.isSafeInteger(v)&&v>0) ||
    p.width!==child.props.Width || p.height!==child.props.Height)return;
 const left=picture.x-owner.x,top=picture.y-owner.y;
 if(![left,top,picture.w,picture.h,owner.w,owner.h].every(Number.isFinite) || left<0 || top<0 ||
    Math.abs(picture.w-p.width/75)>.2 || Math.abs(picture.h-p.height/75)>.2 ||
    left+picture.w>owner.w+.2 || top+picture.h>owner.h+.2)return;
 const portable=page.portablePictures.filter((c:any)=>c.secIdx===section&&c.parentParaIdx===paragraph&&
  c.controlIdx===child.controlIndex&&JSON.stringify(c.cellPath)===storedPath);
 if(portable.length!==1||portable[0].w!==picture.w||portable[0].h!==picture.h||
    portable[0].plane!==picture.plane||portable[0].zOrder!==picture.zOrder)return;
 const screenBox={x:picture.x,y:picture.y,width:picture.w,height:picture.h};
 if(page.pictures.filter((c:any)=>sameBounds(c,screenBox)).length!==1)return;
 const ops=page.painted.filter(op=>sameBounds(portable[0],op.bbox));
 if(ops.length!==1||page.portablePictures.filter((c:any)=>sameBounds(c,ops[0].bbox)).length!==1)return;
 const {sourceImageKey:key,mime}=ops[0];
 const asset=typeof key==='string' && /^bin:\d+:([1-9]\d*):src$/.exec(key);
 if(!asset || !page.keys.has(key))return;
 let renderedHash=page.assets.get(key);
 if(!renderedHash){
  renderedHash=assetHash(doc.getSourceImageBytes(key),mime);
  if(!renderedHash)return;
  page.assets.set(key,renderedHash);
 }
 // This API resolves the stored Picture at that exact path, then loads its
 // own image_attr.bin_data_id. Array order and image appearance are irrelevant.
 const storedHash=assetHash(doc.getControlImageData(section,paragraph,storedPath,child.controlIndex),mime);
 if(storedHash!==renderedHash)return;
 const {list:slot,...record}=child;
 const signature=digest(new TextEncoder().encode(JSON.stringify([record,p,asset[1],storedHash,picture.plane,picture.zOrder,picture.w,picture.h,owner.w,owner.h])));
 return {signature,left,top};
}

function samePlacement(a:CellPicturePlacement,b:CellPicturePlacement) {
 return a.signature===b.signature && Math.abs(a.left-b.left)<=.2 && Math.abs(a.top-b.top)<=.2;
}

export function sameAxisPicture(a:Cell['axisPicture'],b:Cell['axisPicture']):boolean {
 if(!a||!b)return a===b;
 if(!samePlacement(a,b) || a.pictures?.length!==b.pictures?.length)return false;
 return !a.pictures || a.pictures.every((p,i)=>{
  const q=b.pictures![i];
  return p.cellParaIndex===q.cellParaIndex && p.controlIndex===q.controlIndex && samePlacement(p,q);
 });
}
