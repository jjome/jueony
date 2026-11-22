import type {RunRepository} from '../../modules/agent/public/index.ts';
import {chatOf} from '../../modules/workspace/public/index.ts';
import type {AppState, Run} from './legacy-records.ts';

/** Share the current workspace state and its existing serialized persistence. */
export function workspaceRunRepository(current:()=>Pick<AppState,'workspaces'|'chats'|'activeWorkspaceId'|'runs'>):RunRepository<Run> {
  return {
    append(run){
      const state=current();
      chatOf(state,run.workspaceId,run.chatId);
      if(state.runs.some(item=>item.id===run.id))throw new Error('같은 실행 기록이 이미 있습니다.');
      state.runs.push(run);
    },
    list({workspaceId,chatId}){
      const state=current();
      chatOf(state,workspaceId,chatId);
      return state.runs.filter(run=>run.workspaceId===workspaceId&&run.chatId===chatId);
    },
  };
}
