import {sha256} from '@noble/hashes/sha2.js';
import type {Cell} from '../../modules/document/public/types.ts';

const json=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const digest=(bytes:Uint8Array)=>Array.from(sha256(bytes),v=>v.toString(16).padStart(2,'0')).join('');

/** Bind one inline picture to its exact cell path, visible source bytes and
 * position inside the cell. A page with two image resources is ambiguous. */
export function readAxisPicture(doc:any,section:number,paragraph:number,control:number,cell:Cell,child:any):Cell['axisPicture'] {
 if(doc.pageCount()!==1 || child.ctrlId!=='gso' || child.ctrlCh!==11 || child.userDesc!=='그림' ||
    child.controlIndex!==0 || child.para!==0 || child.props?.Lock!==0 || child.props.TreatAsChar!==1 ||
    cell.properties.fieldName!=='' || cell.properties.cellProtect!==false)return;
 const path=[{controlIndex:control,cellIndex:cell.index,cellParaIndex:0}];
 if(json(doc.getFieldList()).some((f:any)=>{
  const loc=f.location,first=loc?.path?.[0];
  return f.listId===child.list || loc?.sectionIndex===section && loc?.paraIndex===paragraph &&
   first?.type==='cell' && first.controlIndex===control && first.cellIndex===cell.index;
 }))return;
 const p=json(doc.getCellPicturePropertiesByPath(section,paragraph,JSON.stringify(path),0));
 if(p.treatAsChar!==true || p.hasCaption!==false || p.sizeProtect!==false || p.allowOverlap!==false ||
    'externalPath' in p || p.horzFlip!==false || p.vertFlip!==false || p.effect!=='RealPic' ||
    [p.cropLeft,p.cropRight,p.cropTop,p.cropBottom,p.rotationAngle,p.transparency,p.brightness,p.contrast].some(v=>v!==0) ||
    ![p.width,p.height].every(v=>Number.isSafeInteger(v)&&v>0) ||
    p.width!==child.props.Width || p.height!==child.props.Height)return;
 const layout=json(doc.getPageControlLayout(0)).controls;
 const pictures=layout.filter((c:any)=>c.type==='image'),picture=pictures[0];
 if(pictures.length!==1 || picture.secIdx!==section || picture.parentParaIdx!==paragraph ||
    picture.outerTableControlIdx!==control || picture.controlIdx!==0 || picture.cellIdx!==cell.index ||
    picture.cellParaIdx!==0 || JSON.stringify(picture.cellPath)!==JSON.stringify(path))return;
 const tables=layout.filter((c:any)=>c.type==='table' && c.secIdx===section && c.paraIdx===paragraph &&
   c.controlIdx===control && !c.cellPath?.length);
 const owners=tables.length===1?tables[0].cells.filter((c:any)=>c.cellIdx===cell.index&&c.row===cell.row&&c.col===cell.column):[];
 if(owners.length!==1)return;
 const owner=owners[0], left=picture.x-owner.x,top=picture.y-owner.y;
 if(![left,top,picture.w,picture.h,owner.w,owner.h].every(Number.isFinite) || left<0 || top<0 ||
    Math.abs(picture.w-p.width/75)>.2 || Math.abs(picture.h-p.height/75)>.2 ||
    left+picture.w>owner.w+.2 || top+picture.h>owner.h+.2)return;
 const resources=json(doc.getPageSourceImageKeys(0));
 if(resources.cacheable!==true || resources.keys?.length!==1)return;
 const key=resources.keys[0],asset=typeof key==='string'&&/^bin:\d+:([1-9]\d*):src$/.exec(key);
 if(!asset)return;
 const bytes=doc.getSourceImageBytes(key);
 if(!(bytes instanceof Uint8Array)||bytes.length<8||bytes.length>8*1024*1024)return;
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!png&&!jpeg)return;
 const {list:slot,...record}=child;
 const signature=digest(new TextEncoder().encode(JSON.stringify([record,p,asset[1],digest(bytes),picture.plane,picture.zOrder,picture.w,picture.h,owner.w,owner.h])));
 return {signature,left,top};
}

export function sameAxisPicture(a:Cell['axisPicture'],b:Cell['axisPicture']):boolean {
 if(!a||!b)return a===b;
 return a.signature===b.signature && Math.abs(a.left-b.left)<=.2 && Math.abs(a.top-b.top)<=.2;
}
