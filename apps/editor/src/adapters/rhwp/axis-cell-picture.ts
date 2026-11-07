import {sha256} from '@noble/hashes/sha2.js';
import type {Cell,CellPicturePlacement} from '../../modules/document/public/types.ts';

const json=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const digest=(bytes:Uint8Array)=>Array.from(sha256(bytes),v=>v.toString(16).padStart(2,'0')).join('');

type PicturePage={screen:any[];portable:any[];pictures:any[];portablePictures:any[];painted:any[];keys:Set<string>;assets:Map<string,string>};
type OwnerFrame={page:number;screen:any;portable:any};

function picturePages(doc:any) {
 const count=doc.pageCount();
 if(!Number.isSafeInteger(count)||count<1||count>200)return null;
 const screen=Array.from({length:count},(_,i)=>json(doc.getPageControlLayout(i)).controls as any[]);
 const canvas=doc.canvasMetricsActive?.()===true;
 const assets=new Map<string,string>();
 // Export paint operations require portable font metrics. Retain the actual
 // screen frames separately and match the stored control path in both layouts.
 try{
  if(canvas)doc.selectCanvasMetrics(false);
  if(doc.canvasMetricsActive?.()===true||doc.pageCount()!==count)return null;
  const pages:PicturePage[]=[];
  for(const [i,layout] of screen.entries()){
   const portable=canvas?json(doc.getPageControlLayout(i)).controls:layout;
   const pictures=layout.filter(c=>c.type==='image'),portablePictures=portable.filter((c:any)=>c.type==='image');
   const painted=json(doc.getPageFlowImageOps(i)),resources=json(doc.getPageSourceImageKeys(i));
   if(portablePictures.length!==pictures.length||painted.cacheable!==true||!Array.isArray(painted.images)||
      resources.cacheable!==true||!Array.isArray(resources.keys))return null;
   pages.push({screen:layout,portable,pictures,portablePictures,painted:painted.images,keys:new Set(resources.keys),assets});
  }
  return {pages,fields:json(doc.getFieldList()),tables:new Map<string,Map<number,OwnerFrame>|null>()};
 }finally{
  if(canvas){
   doc.selectCanvasMetrics(true);
   if(doc.canvasMetricsActive()!==true)throw Error('그림 검사 후 화면 측정 환경을 복원하지 못했습니다.');
  }
 }
}

// On continuation pages each table frame numbers its visible cells from zero.
// Picture paths use the physical index in the stored table. Join the complete
// ordered frame set to stored owners by logical address and exact span.
function tableFrames(doc:any,pages:PicturePage[],section:number,paragraph:number,control:number){
 const base=[section,paragraph,control];
 const dimensions=json(doc.getTableDimensions(...base));
 if(!Number.isSafeInteger(dimensions.cellCount)||dimensions.cellCount<1||dimensions.cellCount>200)return null;
 const address=(c:any)=>JSON.stringify([c.row,c.col,c.rowSpan,c.colSpan]);
 const stored=new Map<string,number>();
 for(let i=0;i<dimensions.cellCount;i++)stored.set(address(json(doc.getCellInfo(...base,i))),i);
 if(stored.size!==dimensions.cellCount)return null;
 const isTable=(c:any)=>c.type==='table'&&c.secIdx===section&&c.paraIdx===paragraph&&c.controlIdx===control&&!c.cellPath?.length;
 const owners=new Map<number,OwnerFrame>();
 let nextRow=0,lastPage=-1,frameCount=0;
 for(const [pageNumber,page] of pages.entries()){
  const live=page.screen.filter(isTable),portable=page.portable.filter(isTable);
  if(live.length!==portable.length||live.length>1)return null;
  if(!live.length)continue;
  const a=live[0],b=portable[0];
  if(lastPage!==-1&&pageNumber!==lastPage+1)return null;
  lastPage=pageNumber;frameCount++;
  if(a.rowCount!==dimensions.rowCount||a.colCount!==dimensions.colCount||a.rowCount!==b.rowCount||a.colCount!==b.colCount||
     !Array.isArray(a.cells)||!Array.isArray(b.cells)||!a.cells.length||a.cells.length!==b.cells.length)return null;
  if(Math.min(...a.cells.map((c:any)=>c.row))!==nextRow)return null;
  for(const [slot,c] of a.cells.entries()){
   const other=b.cells[slot],key=address(c),index=stored.get(key);
   if(index===undefined||owners.has(index)||key!==address(other)||c.cellIdx!==slot||other.cellIdx!==slot)return null;
   owners.set(index,{page:pageNumber,screen:c,portable:other});
  }
  nextRow=Math.max(...a.cells.map((c:any)=>c.row+c.rowSpan));
 }
 if(owners.size!==stored.size||nextRow!==dimensions.rowCount)return null;
 if(frameCount>1){
  const settings=json(doc.getTableProperties(...base));
  if(settings.pageBreak!==2||settings.repeatHeader!==false)return null;
  // A frame may be clipped at the page edge even though its last logical row
  // is listed. Every surviving row must fit both published metric profiles.
  for(const [index,owner] of owners){
   const {width,height}=json(doc.getCellProperties(...base,index));
   if(!Number.isSafeInteger(width)||width<=0||!Number.isSafeInteger(height)||height<=0)return null;
   for(const box of [owner.screen,owner.portable]){
    if(!Number.isFinite(box.w)||!Number.isFinite(box.h)||box.w+.2<width/75||box.h+.2<height/75)return null;
   }
  }
 }
 return owners;
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
 let snapshot:ReturnType<typeof picturePages>|undefined;
 return (section:number,paragraph:number,control:number,cell:Cell,paragraphCount:number,children:any[]):Cell['axisPicture']=>{
  if(!Number.isSafeInteger(paragraphCount)||paragraphCount<1||paragraphCount>50||cell.text.length>4000||
     !children.length||cell.properties.fieldName!==''||cell.properties.cellProtect!==false)return;
  if(snapshot===undefined){snapshot=null;snapshot=picturePages(doc);}
  if(!snapshot)return;
  if(snapshot.fields.some((f:any)=>{
   const loc=f.location,first=loc?.path?.[0];
   return f.listId===children[0].list || loc?.sectionIndex===section && loc?.paraIndex===paragraph &&
    first?.type==='cell' && first.controlIndex===control && first.cellIndex===cell.index;
  }))return;
  const tableKey=JSON.stringify([section,paragraph,control]);
  if(!snapshot.tables.has(tableKey))snapshot.tables.set(tableKey,tableFrames(doc,snapshot.pages,section,paragraph,control));
  const owner=snapshot.tables.get(tableKey)?.get(cell.index);
  if(!owner||owner.screen.row!==cell.row||owner.screen.col!==cell.column||
     owner.screen.rowSpan!==cell.rowSpan||owner.screen.colSpan!==cell.columnSpan)return;
  const page=snapshot.pages[owner.page];
  const inOwner=(c:any)=>c.secIdx===section && c.parentParaIdx===paragraph &&
    c.cellPath?.length===1 && c.cellPath[0].controlIndex===control && c.cellPath[0].cellIndex===cell.index;
  const inCell=page.pictures.filter(inOwner);
  if(inCell.length!==children.length||page.portablePictures.filter(inOwner).length!==children.length||
     snapshot.pages.some(p=>p!==page&&(p.pictures.some(inOwner)||p.portablePictures.some(inOwner))))return;
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
   const placement=readPicture(doc,page,section,paragraph,path,child,picture,owner);
   if(!placement)return;
   pictures.push({...placement,cellParaIndex:para,controlIndex:nextIndex});
  }
  const {left,top,signature}=pictures[0];
  if(pictures.length===1)return {signature,left,top};
  return {signature:digest(new TextEncoder().encode(JSON.stringify(pictures.map(p=>p.signature)))),left,top,pictures};
 };
}

function readPicture(doc:any,page:PicturePage,
 section:number,paragraph:number,storedPath:string,child:any,picture:any,frame:OwnerFrame):CellPicturePlacement|undefined {
 if(child.ctrlId!=='gso' || child.ctrlCh!==11 || child.userDesc!=='그림' ||
    child.props?.Lock!==0 || child.props.TreatAsChar!==1)return;
 const p=json(doc.getCellPicturePropertiesByPath(section,paragraph,storedPath,child.controlIndex));
 if(p.treatAsChar!==true || p.hasCaption!==false || p.sizeProtect!==false || p.allowOverlap!==false ||
    'externalPath' in p || p.horzFlip!==false || p.vertFlip!==false || p.effect!=='RealPic' ||
    [p.cropLeft,p.cropRight,p.cropTop,p.cropBottom,p.rotationAngle,p.transparency,p.brightness,p.contrast].some(v=>v!==0) ||
    ![p.width,p.height].every(v=>Number.isSafeInteger(v)&&v>0) ||
    p.width!==child.props.Width || p.height!==child.props.Height)return;
 const owner=frame.screen,left=picture.x-owner.x,top=picture.y-owner.y;
 if(![left,top,picture.w,picture.h,owner.w,owner.h].every(Number.isFinite) || left<0 || top<0 ||
    Math.abs(picture.w-p.width/75)>.2 || Math.abs(picture.h-p.height/75)>.2 ||
    left+picture.w>owner.w+.2 || top+picture.h>owner.h+.2)return;
 const portable=page.portablePictures.filter((c:any)=>c.secIdx===section&&c.parentParaIdx===paragraph&&
  c.controlIdx===child.controlIndex&&JSON.stringify(c.cellPath)===storedPath);
 if(portable.length!==1||portable[0].cellIdx!==picture.cellIdx||portable[0].cellParaIdx!==picture.cellParaIdx||
    portable[0].outerTableControlIdx!==picture.outerTableControlIdx||portable[0].w!==picture.w||portable[0].h!==picture.h||
    portable[0].plane!==picture.plane||portable[0].zOrder!==picture.zOrder)return;
 const portableLeft=portable[0].x-frame.portable.x,portableTop=portable[0].y-frame.portable.y;
 if(![portableLeft,portableTop,frame.portable.w,frame.portable.h].every(Number.isFinite)||portableLeft<0||portableTop<0||
    portableLeft+picture.w>frame.portable.w+.2||portableTop+picture.h>frame.portable.h+.2)return;
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
