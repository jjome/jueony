import type {SessionTab} from '../public/contracts.ts';

/** Choose within the displayed order of one workspace without changing state. */
export function documentTabCycleTarget(tabs:readonly SessionTab[],workspaceId:string,activeId:string,direction:1|-1):string|undefined {
 if(!workspaceId||!activeId||(direction!==1&&direction!==-1))return;
 const eligible=tabs.filter(tab=>tab.workspaceId===workspaceId&&!tab.closed);
 if(eligible.length<2||eligible.some(tab=>!tab.id)||new Set(eligible.map(tab=>tab.id)).size!==eligible.length)return;
 const index=eligible.findIndex(tab=>tab.id===activeId);if(index<0)return;
 // A duplicate ID in another workspace is also an ambiguous session address.
 if(tabs.filter(tab=>!tab.closed&&tab.id===activeId).length!==1)return;
 const target=eligible[(index+direction+eligible.length)%eligible.length];
 return tabs.filter(tab=>!tab.closed&&tab.id===target.id).length===1?target.id:undefined;
}
