import type {Snapshot,AgentBasicBulletOp} from '../../modules/document/public/index.ts';
import {validateAgentBasicBullet} from '../../modules/document/public/engine-integration.ts';
import {readAgentParagraphLists} from './agent-paragraph-list.ts';
import {nativeDocument,parsed} from './structure.ts';
import {capturePreservationEvidence} from './preservation.ts';
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const list=(p:any)=>({headType:p.headType,numberingId:p.numberingId,paraLevel:p.paraLevel});
function withoutInferred(values:any){for(const [k,v]of Object.entries(values))if(/^section\/\d+\/paragraph\/\d+$/u.test(k)){const p=(v as any).paragraph;delete p.numberingRestartMode;delete p.numberingStartNum;}return values;}
export function executeAgentBasicBullet(wasm:any,base:Snapshot,op:AgentBasicBulletOp){
 const character=validateAgentBasicBullet(op,base),d=nativeDocument(wasm),n=base.nodes.find(n=>n.id===op.target)!;
 const source=base.structure!.paragraphs.find(p=>p.id===op.target)!.paragraph,current=parsed(d.getParaPropertiesAt(n.section,n.paragraph));
 if(d.getTextRange(n.section,n.paragraph,0,d.getParagraphLength(n.section,n.paragraph))!==n.text||!same(list(source),list(current))||!same(base.listCatalog,readAgentParagraphLists(d,base.nodes).listCatalog))throw new Error('문단 원문·글머리표·번호 정의가 바뀌었습니다. 최신 문서로 다시 요청하세요.');
 const raw=parsed(d.getAgentParagraphList(n.section,n.paragraph));if(raw.editable!==true||typeof raw.token!=='string'||!/^[a-f0-9]{64}$/u.test(raw.token))throw new Error('원본 글머리표 검증 정보가 없습니다.');
 const before=capturePreservationEvidence(d);if(before.issues.length)throw new Error('전체 문서 보존 정보를 확인하지 못했습니다.');
 const expected=structuredClone(before.values) as any,definitions=expected['list-definitions'];if(!Array.isArray(definitions?.bullets)||definitions.bullets.length>=200)throw new Error('원본 글머리표 정의를 확인하지 못했습니다.');const id=definitions.bullets.length+1;
 definitions.bullets.push({attr:8,width_adjust:0,text_distance:50,char_shape_id:0,bullet_char:character,image_bullet:0,image_data:[0,0,0,0],check_bullet_char:String.fromCharCode(0)});
 const target=expected[`section/${n.section}/paragraph/${n.paragraph}`];if(!target?.paragraph)throw new Error('대상 문단 보존 정보가 없습니다.');Object.assign(target.paragraph,{headType:'Bullet',numberingId:id,paraLevel:0});
 const result=parsed(d.setAgentBasicBullet(n.section,n.paragraph,JSON.stringify({token:raw.token,character})));if(result.editable!==true||result.definitionId!==id||result.created!==true)throw new Error('새 글머리표 정의 적용 결과가 다릅니다.');
 const after=capturePreservationEvidence(d);if(after.issues.length||!same(withoutInferred(after.values),withoutInferred(expected)))throw new Error('새 글머리표 적용 뒤 본문·공유 정의·다른 문단이 계획과 다릅니다.');
}
