import {assertTemplate,type CommandMacro,type MacroRepositoryPort} from '../../modules/automation/public/index.ts';
import type {SavedAlignmentMacro} from '../../modules/script-macros/public/index.ts';
import {workspaceOf} from '../../modules/workspace/public/index.ts';
import type {AppState} from './legacy-records.ts';
import {createSerializedWriter} from './serialized-writer.ts';

type MacroState=Pick<AppState,'workspaces'|'chats'|'activeWorkspaceId'|'macros'|'alignmentMacros'>;
type OwnedRecord={id:string;workspaceId:string};

/** Keep command and manual macro writes in the existing workspace envelope. */
export function workspaceMacroRepository(current:()=>MacroState,persist:()=>Promise<void>,writes=createSerializedWriter()) {
  function collection<T extends OwnedRecord>(get:(state:MacroState)=>T[]|undefined,set:(state:MacroState,value:T[]|undefined)=>void){
    function change(workspaceId:string,edit:(records:T[])=>T[]){
      return writes.run(async()=>{
        const state=current();
        workspaceOf(state,workspaceId);
        const previous=get(state);
        set(state,edit(previous??[]));
        try{await persist();}
        catch(error){set(state,previous);throw error;}
      });
    }
    return {
      list(workspaceId:string){
        const state=current();
        workspaceOf(state,workspaceId);
        return (get(state)??[]).filter(item=>item.workspaceId===workspaceId);
      },
      append(record:T){
        const copy=structuredClone(record);
        return change(copy.workspaceId,records=>{
          if(records.some(item=>item.id===copy.id))throw new Error('같은 반복 작업이 이미 있습니다.');
          return [...records,copy];
        });
      },
      update(workspaceId:string,id:string,replace:(record:T)=>T|undefined){
        return change(workspaceId,records=>{
          const index=records.findIndex(item=>item.workspaceId===workspaceId&&item.id===id);
          if(index<0)throw new Error('이 업무에서 반복 작업을 찾지 못했습니다.');
          const next=[...records],replacement=replace(next[index]);
          if(replacement)next[index]=replacement;
          else next.splice(index,1);
          return next;
        });
      },
    };
  }
  const commands=collection<CommandMacro>(state=>state.macros,(state,value)=>{state.macros=value;});
  const manual=collection<SavedAlignmentMacro>(state=>state.alignmentMacros,(state,value)=>{state.alignmentMacros=value;});
  const macroName=(name:string)=>{
    const cleaned=name.trim();
    if(!cleaned)throw new Error('반복 작업 이름을 입력해 주세요.');
    return cleaned;
  };
  const commandRepository:MacroRepositoryPort={
    list:commands.list,
    async append(macro){
      assertTemplate(macro.template);
      await commands.append({...macro,name:macroName(macro.name)});
    },
    async rename(workspaceId,id,name){
      const nextName=macroName(name);
      await commands.update(workspaceId,id,record=>({...record,name:nextName}));
    },
    remove(workspaceId,id){return commands.update(workspaceId,id,()=>undefined);},
  };
  return {persist:()=>writes.run(persist),commands:commandRepository,manual:{list:manual.list,append:manual.append,
    remove:(workspaceId:string,id:string)=>manual.update(workspaceId,id,()=>undefined)}};
}
