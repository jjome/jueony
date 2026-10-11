import {agent} from '../composition/agent.ts';
export const buildContext=agent.context;
export const buildRetrievedContext=(...args:[...Parameters<typeof buildContext>,AbortSignal?])=>{
 const [state,workspaceId,chatId,document,references,request,signal]=args;
 return agent.contextWithRetrieval([state,workspaceId,chatId,document,references,request],signal);
};
