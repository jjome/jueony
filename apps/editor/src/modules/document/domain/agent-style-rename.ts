import type {Snapshot,AgentRenameParagraphStyleOp} from '../public/types.ts';
import {normalizedAgentStyleName} from './agent-style-name.ts';
export function agentRenameParagraphStyleName(op:AgentRenameParagraphStyleOp,s:Snapshot):string {
 const styles=s.structure?.styles,source=styles?.find(v=>v.id===op.styleId),cap=s.styleRenameSources?.[String(op.styleId)];
 if(!styles||styles.length>256||!Number.isInteger(op.styleId)||op.styleId<1||op.styleId>255||source?.type!==0||cap?.editable!==true||!/^[a-f0-9]{64}$/u.test(cap.fingerprint??''))throw new Error('이름 변경 가능한 저장 문단 스타일이 필요합니다. 바탕글·글자·잠금·확장 원본은 보호합니다.');
 const name=normalizedAgentStyleName(op.name);
 if(source.name.normalize('NFC')===name)throw new Error('현재 스타일 이름과 같습니다.');
 if(styles.some(v=>v.id!==op.styleId&&v.name.normalize('NFC')===name))throw new Error('이미 있는 스타일 이름입니다. 다른 이름을 지정하세요.');
 return name;
}
