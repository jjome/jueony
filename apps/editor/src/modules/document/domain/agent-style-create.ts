import {normalizedAgentStyleName} from './agent-style-name.ts';
import type {Snapshot,AgentCreateParagraphStyleOp} from '../public/types.ts';
export function agentCreateParagraphStyleName(op:AgentCreateParagraphStyleOp,s:Snapshot){
 const styles=s.structure?.styles;
 if(!/^[a-f0-9]{64}$/u.test(s.styleCreationSources?.[String(op.sourceStyleId)]?.fingerprint??''))throw new Error('현재 저장 스타일 모양의 검증 정보가 없습니다.');
 if(!styles||styles.length>=256||!Number.isInteger(op.sourceStyleId)||op.sourceStyleId<0||!styles.some(v=>v.id===op.sourceStyleId&&v.type===0)||s.styleCreationSources?.[String(op.sourceStyleId)]?.editable!==true)throw new Error('생성 가능한 저장 문단 스타일과 256개 미만의 목록이 필요합니다.');
 const name=normalizedAgentStyleName(op.name);
 if(styles.some(v=>v.name.normalize('NFC')===name))throw new Error('이미 있는 스타일 이름입니다. 다른 이름을 지정하세요.');
 return name;
}
