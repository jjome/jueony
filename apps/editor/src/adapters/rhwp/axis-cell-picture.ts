import {sha256} from '@noble/hashes/sha2.js';
import type {Cell,CellPicturePlacement} from '../../modules/document/public/types.ts';

const json=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const digest=(bytes:Uint8Array)=>Array.from(sha256(bytes),v=>v.toString(16).padStart(2,'0')).join('');

type HeaderLayout={runs:any[];width:number;height:number};
type PicturePage={screen:any[];portable:any[];pictures:any[];portablePictures:any[];painted:any[];keys:Set<string>;assets:Map<string,string>;screenHeader?:HeaderLayout;portableHeader?:HeaderLayout};
type OwnerFrame={page:number;screen:any;portable:any;headerSignature?:string;titleSignature?:string;titleScreenSignature?:string;copies?:OwnerFrame[]};

function repeatedPages(screen:any[][]){
 const occurrences=new Map<string,number[]>();
 for(const [page,controls] of screen.entries())for(const frame of controls){
  if(frame.type!=='table'||frame.cellPath?.length||!frame.cells.some((c:any)=>c.row===0))continue;
  const id=JSON.stringify([frame.secIdx,frame.paraIdx,frame.controlIdx]);
  const found=occurrences.get(id)??[];found.push(page);occurrences.set(id,found);
 }
 return new Set([...occurrences.values()].filter(pages=>pages.length>1).flat());
}

function headerLayout(doc:any,page:number):HeaderLayout{
 const {width,height}=json(doc.getPageInfo(page)),{runs}=json(doc.getPageTextLayout(page));
 return {width,height,runs};
}

function picturePages(doc:any) {
 const count=doc.pageCount();
 if(!Number.isSafeInteger(count)||count<1||count>200)return null;
 const screen=Array.from({length:count},(_,i)=>json(doc.getPageControlLayout(i)).controls as any[]);
 const repeats=repeatedPages(screen);
 const headerViews=screen.map((_,page)=>repeats.has(page)?headerLayout(doc,page):undefined);
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
   const screenHeader=headerViews[i],portableHeader=canvas&&screenHeader?headerLayout(doc,i):screenHeader;
   pages.push({screen:layout,portable,pictures,portablePictures,painted:painted.images,keys:new Set(resources.keys),assets,screenHeader,portableHeader});
  }
  return {pages,fields:json(doc.getFieldList()),tables:new Map<string,Map<number,OwnerFrame>|null>()};
 }finally{
  if(canvas){
   doc.selectCanvasMetrics(true);
   if(doc.canvasMetricsActive()!==true)throw Error('그림 검사 후 화면 측정 환경을 복원하지 못했습니다.');
  }
 }
}

type HeaderCell={index:number;row:number;col:number;rowSpan:number;colSpan:number;paragraphs:string[];properties:any;children:any[];anchors:number[][]};
function plainHeader(doc:any,base:number[],dimensions:any,fields:any[]):HeaderCell[]|null{
 const [section,paragraph,control]=base;
 const lists=json(doc.getCursorModel()).lists,children=json(doc.getControls());
 const header:HeaderCell[]=[];
 let firstBodyRow=dimensions.rowCount;
 for(let i=0;i<dimensions.cellCount;i++){
  const info=json(doc.getCellInfo(...base,i)),properties=json(doc.getCellProperties(...base,i));
  const {row,col,rowSpan,colSpan}=info;
  if(![row,col,rowSpan,colSpan].every(Number.isSafeInteger)||row<0||col<0||rowSpan<1||colSpan<1||
     row+rowSpan>dimensions.rowCount||col+colSpan>dimensions.colCount||typeof properties.isHeader!=='boolean')return null;
  if(!properties.isHeader){firstBodyRow=Math.min(firstBodyRow,row);continue;}
  if(properties.fieldName!==''||properties.cellProtect!==false)return null;
  const paths=lists.filter((l:any)=>l.hostListId===0&&l.isCell&&l.sectionIndex===section&&l.hostPara===paragraph&&l.controlIndex===control&&l.cellIndex===i);
  if(paths.length!==1||!Number.isSafeInteger(paths[0].paraCount)||paths[0].paraCount<1||paths[0].paraCount>50||
     fields.some(f=>f.listId===paths[0].listId||f.location?.sectionIndex===section&&f.location?.paraIndex===paragraph&&
      f.location.path?.[0]?.type==='cell'&&f.location.path[0].controlIndex===control&&f.location.path[0].cellIndex===i))return null;
  const owned=children.filter((c:any)=>c.list===paths[0].listId);
  if(owned.some((c:any)=>c.ctrlId!=='gso'))return null;
  const paragraphs:string[]=[],anchors:number[][]=[];
  let total=0;
  for(let p=0;p<paths[0].paraCount;p++){
   const length=doc.getCellParagraphLength(...base,i,p);
   if(!Number.isSafeInteger(length)||length<0||(total+=length)>4000)return null;
   const text=doc.getTextInCell(...base,i,p,0,length);
   if(typeof text!=='string'||Array.from(text).length!==length)return null;
   paragraphs.push(text);
   const pictures=owned.filter((c:any)=>c.para===p);
   const slots=pictures.length?Array.from<number>(doc.getCellPictureTextAnchors(...base,i,p)??[]):[];
   if(slots.length!==pictures.length||slots.some((v,j)=>!Number.isSafeInteger(v)||v<0||v>length||j>0&&v<slots[j-1]))return null;
   anchors.push(slots);
  }
  header.push({index:i,row,col,rowSpan,colSpan,paragraphs,properties,children:owned,anchors});
 }
 // Every slot above the first body row must belong to exactly one header.
 // Use rectangle areas so a large merged span never allocates a dense grid.
 if(!header.length || firstBodyRow===dimensions.rowCount ||
    header.some((h,i)=>h.row+h.rowSpan>firstBodyRow || header.slice(i+1).some(k=>
      h.row<k.row+k.rowSpan && k.row<h.row+h.rowSpan && h.col<k.col+k.colSpan && k.col<h.col+h.colSpan)) ||
    header.reduce((area,h)=>area+h.rowSpan*h.colSpan,0)!==firstBodyRow*dimensions.colCount)return null;
 return header.sort((a,b)=>a.row-b.row || a.col-b.col);
}

const near=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=.2;
function inside(box:any,parent:any){
 return [box.x,box.y,box.w,box.h,parent.x,parent.y,parent.w,parent.h].every(Number.isFinite)&&box.w>0&&box.h>0&&
  box.x>=parent.x-.2&&box.y>=parent.y-.2&&box.x+box.w<=parent.x+parent.w+.2&&box.y+box.h<=parent.y+parent.h+.2;
}
function overlaps(a:any,b:any){
 return Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.2&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.2;
}
type HeaderRun={x:number;y:number;record:string;owner:number};
function renderedHeader(view:HeaderLayout|undefined,controls:any[],frame:any,header:HeaderCell[],base:number[]){
 if(!view||!Array.isArray(view.runs)||!inside(frame,{x:0,y:0,w:view.width,h:view.height})||frame.cells.length<=header.length)return null;
 const [section,paragraph,control]=base;
 const evidence:HeaderRun[]=[];
 for(const [slot,source] of header.entries()){
  const cell=frame.cells[slot];
  if(cell.row!==source.row||cell.col!==source.col||cell.rowSpan!==source.rowSpan||cell.colSpan!==source.colSpan||
     cell.cellIdx!==slot||!inside(cell,frame)||frame.cells.slice(0,slot).some((c:any)=>overlaps(c,cell)))return null;
  if(frame.cells.slice(header.length).some((c:any)=>c.y<cell.y+cell.h-.2))return null;
  if(!near(cell.w,source.properties.width/75))return null;
  evidence.push({owner:source.index,x:0,y:0,record:JSON.stringify([cell.w,cell.h])});
  const images=controls.filter(c=>c.type==='image'&&c.secIdx===section&&c.parentParaIdx===paragraph&&
   c.cellPath?.length===1&&c.cellPath[0].controlIndex===control&&c.cellPath[0].cellIndex===source.index);
  if(images.length!==source.children.length||images.some((image,i)=>!inside(image,cell)||images.slice(0,i).some(p=>overlaps(p,image))))return null;
  const runs=view.runs.filter(r=>r.secIdx===section&&r.parentParaIdx===paragraph&&
   r.cellPath?.[0]?.controlIndex===control&&r.cellPath[0].cellIndex===source.index);
  if(controls.some(c=>c!==frame&&!images.includes(c)&&overlaps(c,cell))||view.runs.filter(r=>overlaps(r,cell)).length!==runs.length||
     runs.some(r=>images.some(image=>overlaps(image,r))))return null;
  let cursor=0;
  for(const [paragraph,expected] of source.paragraphs.entries()){
   let offset=0,text='';
   const first=cursor;
   while(cursor<runs.length && runs[cursor].cellParaIdx===paragraph){
    const {x,y,...r}=runs[cursor++];
    if(r.cellPath.length!==1||r.cellPath[0].cellParaIndex!==paragraph||r.controlIdx!==control||r.cellIdx!==source.index||
       r.paraIdx!==paragraph||r.charStart!==offset+source.anchors[paragraph].filter(a=>a<=offset).length||typeof r.text!=='string'||(!r.text && (expected!==''||cursor!==first+1))||
       !inside({x,y,w:r.w,h:r.h},cell))return null;
    offset+=Array.from(r.text).length;text+=r.text;
    // Physical cell indices can move during an axis edit. Validate them above,
    // then retain the run's source paragraph/style and relative placement.
    const {cellIdx,cellPath,...record}=r;
    evidence.push({owner:source.index,x:x-cell.x,y:y-cell.y,
     record:JSON.stringify({...record,cellPath:cellPath.map(({cellIndex,...p}:any)=>p)})});
   }
   // The renderer publishes a line box even for an empty paragraph.
   // Without it we cannot distinguish a blank cell from missing content.
   if(cursor===first || text!==expected)return null;
  }
  if(cursor!==runs.length)return null;
 }
 // A repeated heading must fill each logical row without gaps or overlap.
 // This preserves the logical address/geometry link when column indices move.
 const rows=Math.max(...header.map(c=>c.row+c.rowSpan));
 for(let row=0;row<rows;row++){
  let x=frame.x;
  const active=header.map((source,slot)=>({source,slot})).filter(({source})=>source.row<=row&&row<source.row+source.rowSpan).sort((a,b)=>a.source.col-b.source.col);
  for(const {slot} of active){
   const cell=frame.cells[slot];if(!near(cell.x,x))return null;x+=cell.w;
  }
  if(!near(x,frame.x+frame.w))return null;
 }
 return evidence;
}
function sameHeader(a:HeaderRun[],b:HeaderRun[]){
 return a.length===b.length&&a.every((r,i)=>r.record===b[i].record&&near(r.x,b[i].x)&&near(r.y,b[i].y));
}

// On continuation pages each table frame numbers its visible cells from zero.
// Picture paths use the physical index in the stored table. Join the complete
// ordered frame set to stored owners by logical address and exact span.
function tableFrames(doc:any,pages:PicturePage[],fields:any[],section:number,paragraph:number,control:number){
 const base=[section,paragraph,control];
 const dimensions=json(doc.getTableDimensions(...base));
 if(!Number.isSafeInteger(dimensions.cellCount)||dimensions.cellCount<1||dimensions.cellCount>200)return null;
 const address=(c:any)=>JSON.stringify([c.row,c.col,c.rowSpan,c.colSpan]);
 const stored=new Map<string,number>();
 for(let i=0;i<dimensions.cellCount;i++)stored.set(address(json(doc.getCellInfo(...base,i))),i);
 if(stored.size!==dimensions.cellCount)return null;
 const isTable=(c:any)=>c.type==='table'&&c.secIdx===section&&c.paraIdx===paragraph&&c.controlIdx===control&&!c.cellPath?.length;
 const split=pages.filter(p=>p.screen.some(isTable)).length>1;
 const settings=split?json(doc.getTableProperties(...base)):null;
 if(split&&(settings.pageBreak!==2||typeof settings.repeatHeader!=='boolean'))return null;
 const header=settings?.repeatHeader?plainHeader(doc,base,dimensions,fields):[];
 if(!header)return null;
 const headerSignatures=new Map<number,string>();
 const screenSignatures=new Map<number,string>();
 let headerSignature:string|undefined;
 let firstScreen:HeaderRun[]|undefined,firstPortable:HeaderRun[]|undefined;
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
  if(header.length){
   for(const [slot,source] of header.entries())if(source.children.length){
    const frame={page:pageNumber,screen:a.cells[slot],portable:b.cells[slot]};
    const pictures=readOwnedPictures(doc,page,base,source.index,source.paragraphs.length,source.children,frame);
    if(!pictures)return null;
   }
   const screen=renderedHeader(page.screenHeader,page.screen,a,header,base),portable=renderedHeader(page.portableHeader,page.portable,b,header,base);
   if(!screen||!portable||firstScreen&&!sameHeader(firstScreen,screen)||firstPortable&&!sameHeader(firstPortable,portable))return null;
   if(!firstPortable){
    for(const source of header){
     const title=portable.filter(r=>r.owner===source.index).map(r=>[Math.round(r.x*10),Math.round(r.y*10),r.record]);
     const stored=[source.paragraphs,source.properties,source.children.map(({list,...c})=>c),source.anchors];
     headerSignatures.set(source.index,digest(new TextEncoder().encode(JSON.stringify([stored,title]))));
     const screenTitle=screen.filter(r=>r.owner===source.index).map(r=>[Math.round(r.x*10),Math.round(r.y*10),r.record]);
     screenSignatures.set(source.index,digest(new TextEncoder().encode(JSON.stringify([stored,screenTitle]))));
    }
    // Keep the complete heading proof on public picture evidence for existing
    // paragraph/subdivision callers. Only axis edits compare projected sources.
    const whole=header.map((source,slot)=>[source.index,source.row,source.col,source.rowSpan,source.colSpan,
     b.cells[slot].x-b.x,b.cells[slot].y-b.y,headerSignatures.get(source.index)]);
    headerSignature=digest(new TextEncoder().encode(JSON.stringify(whole)));
   }
   firstScreen??=screen;firstPortable??=portable;
  }
  const repeated=frameCount>1?header.length:0;
  if(Math.min(...a.cells.slice(repeated).map((c:any)=>c.row))!==nextRow)return null;
  for(const [slot,c] of a.cells.entries()){
   const other=b.cells[slot],key=address(c),index=stored.get(key);
   if(index===undefined||key!==address(other)||c.cellIdx!==slot||other.cellIdx!==slot)return null;
   const frame={page:pageNumber,screen:c,portable:other,headerSignature,titleSignature:headerSignatures.get(index),titleScreenSignature:screenSignatures.get(index)};
   if(slot<repeated){
    if(index!==header[slot].index||!owners.has(index))return null;
    const owner=owners.get(index)!;(owner.copies??=[]).push(frame);continue;
   }
   if(owners.has(index))return null;
   owners.set(index,frame);
  }
  nextRow=Math.max(...a.cells.map((c:any)=>c.row+c.rowSpan));
 }
 if(owners.size!==stored.size||nextRow!==dimensions.rowCount)return null;
 if(frameCount>1){
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

/** Per-source title evidence is compared through the axis projection, so an
 * inserted column can move an existing source without duplicating its image. */
export function axisPictureHeaderEvidence(doc:any,table:{section:number;paragraph:number;control:number},profile:'portable'|'screen'='portable') {
 const snapshot=picturePages(doc);
 if(!snapshot)throw Error('반복 제목의 그림 표시 근거를 읽지 못했습니다.');
 const owners=tableFrames(doc,snapshot.pages,snapshot.fields,table.section,table.paragraph,table.control);
 if(!owners)throw Error('반복 제목의 원본 셀과 쪽별 표시를 검증하지 못했습니다.');
 return new Map([...owners].filter(([,owner])=>owner.titleSignature).map(([index,owner])=>[index,
  profile==='screen'?owner.titleScreenSignature!:owner.titleSignature!]));
}

/** Original image/slot/relative-placement proof without the whole heading's
 * address hash. The caller must separately project axisPictureHeaderEvidence. */
export function axisPictureSourceEvidence(doc:any,table:{section:number;paragraph:number;control:number;cells:Cell[]}) {
 const read=pictureReader(doc,false),lists=json(doc.getCursorModel()).lists,controls=json(doc.getControls());
 const result=new Map<number,NonNullable<Cell['axisPicture']>>();
 for(const cell of table.cells.filter(c=>c.axisPicture)){
  const owners=lists.filter((l:any)=>l.hostListId===0&&l.isCell&&l.sectionIndex===table.section&&
   l.hostPara===table.paragraph&&l.controlIndex===table.control&&l.cellIndex===cell.index);
  if(owners.length!==1)throw Error('그림 원본 셀의 저장 경로를 확인하지 못했습니다.');
  const source=read(table.section,table.paragraph,table.control,cell,owners[0].paraCount,controls.filter((c:any)=>c.list===owners[0].listId));
  if(!source)throw Error('그림 원본의 슬롯과 쪽별 표시를 확인하지 못했습니다.');
  result.set(cell.index,source);
 }
 return result;
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

function picturePaintMatches(properties:any,paint:any) {
 const {horzFlip,vertFlip,originalWidth,originalHeight,cropLeft,cropTop,cropRight,cropBottom}=properties;
 if(typeof horzFlip!=='boolean'||typeof vertFlip!=='boolean'||paint.transform?.rotation!==0||
    paint.transform.horzFlip!==horzFlip||paint.transform.vertFlip!==vertFlip)return false;
 const crop=[cropLeft,cropTop,cropRight,cropBottom];
 if(!crop.every(v=>Number.isSafeInteger(v)&&v>=0))return false;
 if(paint.originalSizeHu!==undefined&&(!Array.isArray(paint.originalSizeHu)||paint.originalSizeHu.length!==2||
    !paint.originalSizeHu.every((v:number)=>Number.isSafeInteger(v)&&v>0)))return false;
 if(crop.every(v=>v===0)){
  if(paint.crop==null)return true;
  // With no imgDim, both painters infer the full-source extent from a crop
  // beginning at zero. HWPX imgDim can differ from the resized shape extent.
  const c=paint.crop;
  return c.left===0&&c.top===0&&[c.right,c.bottom].every(v=>Number.isSafeInteger(v)&&v>0)&&
   (!paint.originalSizeHu||(c.right===paint.originalSizeHu[0]&&c.bottom===paint.originalSizeHu[1]));
 }
 if(![originalWidth,originalHeight].every(v=>Number.isSafeInteger(v)&&v>0))return false;
 // Stored properties report removed margins. The paint operation reports
 // retained source coordinates, before applying its horizontal/vertical flip.
 return cropLeft+cropRight<originalWidth&&cropTop+cropBottom<originalHeight&&
  paint.crop?.left===cropLeft&&paint.crop.top===cropTop&&
  paint.crop.right===originalWidth-cropRight&&paint.crop.bottom===originalHeight-cropBottom;
}

/** Layout and asset keys are local to one read-only snapshot. An edit or reopen
 * gets a fresh reader, even if the engine reuses the same native handle. */
export function axisPictureReader(doc:any) {return pictureReader(doc,true);}
/** N004 only: the caller has proved every inline field ID, path and range.
 * The default structural reader continues to reject all field-bearing owners. */
export function cellParagraphPictureReader(doc:any,verifiedFieldLists:ReadonlySet<number>) {
 return pictureReader(doc,false,verifiedFieldLists);
}
function pictureReader(doc:any,includeHeading:boolean,verifiedFieldLists?:ReadonlySet<number>) {
 let snapshot:ReturnType<typeof picturePages>|undefined;
 return (section:number,paragraph:number,control:number,cell:Cell,paragraphCount:number,children:any[]):Cell['axisPicture']=>{
  if(!Number.isSafeInteger(paragraphCount)||paragraphCount<1||paragraphCount>50||cell.text.length>4000||
     !children.length||cell.properties.fieldName!==''||cell.properties.cellProtect!==false)return;
  if(snapshot===undefined){snapshot=null;snapshot=picturePages(doc);}
  if(!snapshot)return;
  const ownedFields=snapshot.fields.filter((f:any)=>{
   const loc=f.location,first=loc?.path?.[0];
   return f.listId===children[0].list || loc?.sectionIndex===section && loc?.paraIndex===paragraph &&
    first?.type==='cell' && first.controlIndex===control && first.cellIndex===cell.index;
  });
  const mixed=verifiedFieldLists?.has(children[0].list)===true;
  if(ownedFields.length&&(!mixed||ownedFields.some((f:any)=>f.cellField!==false||f.fieldType!=='clickhere')))return;
  if(mixed){
   if(!ownedFields.length||children.filter(c=>c.ctrlId===''&&c.ctrlCh===0).length!==ownedFields.length||
      children.some((c,i)=>c.list!==children[0].list||c.ctrlId!=='gso'&&!(c.ctrlId===''&&c.ctrlCh===0)||
       c.controlIndex!==(children[i-1]?.para===c.para?children[i-1].controlIndex+1:0)))return;
   children=children.filter(c=>c.ctrlId==='gso');
   if(!children.length)return;
  }
  const tableKey=JSON.stringify([section,paragraph,control]);
  if(!snapshot.tables.has(tableKey))snapshot.tables.set(tableKey,tableFrames(doc,snapshot.pages,snapshot.fields,section,paragraph,control));
  const owner=snapshot.tables.get(tableKey)?.get(cell.index);
  if(!owner||owner.screen.row!==cell.row||owner.screen.col!==cell.column||
     owner.screen.rowSpan!==cell.rowSpan||owner.screen.colSpan!==cell.columnSpan)return;
  const inOwner=(c:any)=>c.secIdx===section && c.parentParaIdx===paragraph &&
    c.cellPath?.length===1 && c.cellPath[0].controlIndex===control && c.cellPath[0].cellIndex===cell.index;
  const frames=[owner,...owner.copies??[]],pages=new Set(frames.map(f=>f.page));
  if(snapshot.pages.some((p,i)=>!pages.has(i)&&(p.pictures.some(inOwner)||p.portablePictures.some(inOwner))))return;
  let pictures:ReturnType<typeof readOwnedPictures>;
  for(const frame of frames){
   const current=readOwnedPictures(doc,snapshot.pages[frame.page],[section,paragraph,control],cell.index,paragraphCount,children,
    includeHeading?frame:{...frame,headerSignature:undefined},mixed);
   if(!current||pictures&&current.some((p,i)=>!samePlacement(p,pictures![i])))return;
   pictures??=current;
  }
  if(!pictures?.length)return;
  const {left,top,signature}=pictures[0];
  if(pictures.length===1)return {signature,left,top};
  return {signature:digest(new TextEncoder().encode(JSON.stringify(pictures.map(p=>p.signature)))),left,top,pictures};
 };
}

function readOwnedPictures(doc:any,page:PicturePage,base:number[],index:number,paragraphCount:number,children:any[],owner:OwnerFrame,sparseIndices=false){
  const [section,paragraph,control]=base;
  const inOwner=(c:any)=>c.secIdx===section && c.parentParaIdx===paragraph &&
    c.cellPath?.length===1 && c.cellPath[0].controlIndex===control && c.cellPath[0].cellIndex===index;
  const inCell=page.pictures.filter(inOwner);
  if(inCell.length!==children.length||page.portablePictures.filter(inOwner).length!==children.length)return;
  const pictures:Array<CellPicturePlacement&{cellParaIndex:number;controlIndex:number}>=[];
  for(const [i,child] of children.entries()){
   const previous=children[i-1],para=child.para;
   const nextIndex=sparseIndices?child.controlIndex:previous?.para===para?previous.controlIndex+1:0;
   if(child.list!==children[0].list || !Number.isSafeInteger(para) || para<0 || para>=paragraphCount ||
      previous && para<previous.para || !Number.isSafeInteger(nextIndex)||nextIndex<0||
      previous?.para===para&&nextIndex<=previous.controlIndex || child.controlIndex!==nextIndex || !Number.isSafeInteger(child.pos) ||
      child.pos<0 || previous?.para===para && child.pos<=previous.pos)return;
   const path=JSON.stringify([{controlIndex:control,cellIndex:index,cellParaIndex:para}]);
   const matches=inCell.filter((c:any)=>c.controlIdx===nextIndex && JSON.stringify(c.cellPath)===path);
   if(matches.length!==1)return;
   const picture=matches[0];
   if(picture.outerTableControlIdx!==control || picture.cellIdx!==index || picture.cellParaIdx!==para)return;
   const placement=readPicture(doc,page,section,paragraph,path,child,picture,owner);
   if(!placement)return;
   pictures.push({...placement,cellParaIndex:para,controlIndex:nextIndex});
  }
  return pictures;
}

function readPicture(doc:any,page:PicturePage,
 section:number,paragraph:number,storedPath:string,child:any,picture:any,frame:OwnerFrame):CellPicturePlacement|undefined {
 if(child.ctrlId!=='gso' || child.ctrlCh!==11 || child.userDesc!=='그림' ||
    child.props?.Lock!==0 || child.props.TreatAsChar!==1)return;
 const p=json(doc.getCellPicturePropertiesByPath(section,paragraph,storedPath,child.controlIndex));
 if(p.treatAsChar!==true || p.hasCaption!==false || p.sizeProtect!==false || p.allowOverlap!==false ||
    'externalPath' in p || p.effect!=='RealPic' ||
    [p.rotationAngle,p.transparency,p.brightness,p.contrast].some(v=>v!==0) ||
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
 if(ops.length!==1||page.portablePictures.filter((c:any)=>sameBounds(c,ops[0].bbox)).length!==1||
    !picturePaintMatches(p,ops[0]))return;
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
 const evidence=[record,p,asset[1],storedHash,picture.plane,picture.zOrder,picture.w,picture.h,owner.w,owner.h,
  ops[0].crop,ops[0].originalSizeHu,ops[0].transform];
 if(frame.headerSignature)evidence.push(frame.headerSignature);
 const signature=digest(new TextEncoder().encode(JSON.stringify(evidence)));
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
