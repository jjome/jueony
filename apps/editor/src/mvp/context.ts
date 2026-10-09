import type { AppState, Snapshot, Source } from './model.ts';
import { chatOf } from './model.ts';
import type { LLMInput } from './llm.ts';
export function buildContext(state:AppState,workspaceId:string,chatId:string,document:Snapshot,references:Source[],request:string):LLMInput{
 const chat=chatOf(state,workspaceId,chatId);
 if(document.nodes.reduce((sum,n)=>sum+n.text.length,0)>120000)throw new Error('현재 문서는 전체 본문 문맥 한도 120,000자를 넘습니다.');
 const history=chat.messages.slice(-20).map(m=>({...m}));
 if(history.reduce((n,m)=>n+m.text.length,0)>40000)throw new Error('최근 대화가 너무 깁니다. 새 채팅에서 요청해 주세요.');
 if(references.reduce((n,s)=>n+s.text.length,0)>120000)throw new Error('참고 자료 한도 120,000자를 넘습니다. 자료를 줄여 주세요.');
 return {request,document,references,history};
}
