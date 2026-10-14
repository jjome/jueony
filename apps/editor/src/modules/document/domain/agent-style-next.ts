import type {Snapshot,AgentNextParagraphStyleOp} from '../public/types.ts';
export function validateAgentNextParagraphStyle(op:AgentNextParagraphStyleOp,s:Snapshot):void {
 const styles=s.structure?.styles,source=styles?.find(v=>v.id===op.styleId),target=styles?.find(v=>v.id===op.nextStyleId),cap=s.styleNextSources?.[String(op.styleId)],destination=s.styleNextTargets?.[String(op.nextStyleId)];
 if(!styles||styles.length>256||!Number.isInteger(op.styleId)||op.styleId<1||op.styleId>255||source?.type!==0||cap?.editable!==true||!/^[a-f0-9]{64}$/u.test(cap.fingerprint??'')||(!Number.isInteger(cap.currentNextStyleId)||cap.currentNextStyleId<0||cap.currentNextStyleId>255))throw new Error('다음 스타일을 변경할 수 있는 저장 문단 스타일이 필요합니다.');
 if(!Number.isInteger(op.nextStyleId)||op.nextStyleId<0||op.nextStyleId>255||target?.type!==0||!/^[a-f0-9]{64}$/u.test(destination?.fingerprint??''))throw new Error('조회된 변경 가능 문단 스타일을 다음 스타일로 선택하세요.');
 if(cap.currentNextStyleId===op.nextStyleId)throw new Error('현재 다음 문단 스타일과 같습니다.');
}
