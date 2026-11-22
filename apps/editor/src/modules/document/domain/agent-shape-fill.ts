import type {EditOp,Snapshot} from '../public/types.ts';

export type ShapeFillSource={section:number;paragraph:number;control:number;color:string;fingerprint:string;templateFingerprint:string};
export type SetShapeFill={kind:'set_shape_fill';target:string;originalFingerprint:string;color:string};
export const shapeFillId=/^s[0-9]+p[0-9]+o[0-9]+$/u;
export const shapeFillColor=/^#[0-9a-f]{6}$/iu;
export const shapeFillDigest=/^[0-9a-f]{64}$/u;

export function shapeFillTarget(op:EditOp,base:Snapshot):ShapeFillSource{
 if(op.kind!=='set_shape_fill'||Object.keys(op).length!==4||typeof op.target!=='string'||!shapeFillId.test(op.target)||
    typeof op.originalFingerprint!=='string'||!shapeFillDigest.test(op.originalFingerprint)||
    typeof op.color!=='string'||!shapeFillColor.test(op.color)){
  throw new Error('확인한 도형 주소와 #RRGGBB 채우기 색을 지정하세요.');
 }
 const source=base.shapeFillSources?.[op.target];
 if(!source||source.fingerprint!==op.originalFingerprint||source.color.toLowerCase()===op.color.toLowerCase()){
  throw new Error('조회한 도형의 현재 색이나 주소를 확인해 주세요.');
 }
 return source;
}
