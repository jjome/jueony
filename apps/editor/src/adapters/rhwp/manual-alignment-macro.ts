import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {validateEditProposal,type EditOp,type Snapshot} from '../../modules/document/public/index.ts';
import {SCRIPT_MACRO_BODY_TEXT_COMMAND,validateScriptMacroB142,type ScriptMacroArgumentsB142} from '../../modules/script-macros/public/index.ts';
import {ScriptMacroCommandCatalogB142,ScriptMacroRecorderB142,type RecordableScriptMacroCommandB142,type ScriptMacroRuntimeStateB142} from './script-macro-runtime-b142.ts';

const commands = {
  'format:align-left':'left',
  'format:align-center':'center',
  'format:align-right':'right',
  'format:align-justify':'justify',
  'format:align-distribute':'distribute',
} as const;
const commandIds = Object.keys(commands) as (keyof typeof commands)[];
const hex = /^[a-f0-9]{64}$/u;
const safeIndex = (value: unknown) => typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const digest = (value: string) => bytesToHex(sha256(new TextEncoder().encode(value)));
const textCommand = SCRIPT_MACRO_BODY_TEXT_COMMAND;
const unsupportedText = /[\u0000-\u001f\u007f]/u;

type Target = {section:number;paragraph:number;text:string;alignment:string;format?:string;adjacent?:string;paragraphCount:number;sectionCount:number};
type RecordedEdit = {target:Target;state:ScriptMacroRuntimeStateB142};
type BodyChange = {start:number;count:number;text:string};
type Replay = {base:Snapshot;text:Map<string,string>;operations:(EditOp|string)[]};
type DispatchResult = {ok:boolean};

function address(args: ScriptMacroArgumentsB142) {
  return {section:args.section as number,paragraph:args.paragraph as number,fingerprint:args.fingerprint as string};
}

function bodyChange(before: string, after: string): BodyChange {
  const original=Array.from(before), next=Array.from(after);
  let start=0, oldEnd=original.length, newEnd=next.length;
  while (start<oldEnd && start<newEnd && original[start]===next[start]) start++;
  while (start<oldEnd && start<newEnd && original[oldEnd-1]===next[newEnd-1]) { oldEnd--; newEnd--; }
  return {start,count:oldEnd-start,text:next.slice(start,newEnd).join('')};
}

function resolveTarget(context: Replay, args: ScriptMacroArgumentsB142) {
  const {section,paragraph,fingerprint}=address(args);
  const node=context.base.nodes.find(node=>node.section===section&&node.paragraph===paragraph);
  if(!node?.editable)throw new Error('기록한 문단의 편집 상태가 달라졌습니다.');
  const text=context.text.get(node.id)??node.text;
  if(digest(text)!==fingerprint)throw new Error('기록한 문단 내용이 달라졌습니다.');
  return {node,text};
}

const alignmentCommands: RecordableScriptMacroCommandB142<Replay>[] = commandIds.map(id=>({
  id,recordable:true,
  safety:{deterministic:true,dialogFree:true,selectionIndependent:true,imeIndependent:true},
  validateArguments(value:unknown){
    const args=value as Record<string,unknown>;
    if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==3||
       !safeIndex(args.section)||!safeIndex(args.paragraph)||typeof args.fingerprint!=='string'||!hex.test(args.fingerprint)){
      throw new Error('기록한 문단 위치를 확인할 수 없습니다.');
    }
    return args;
  },
  execute(context,args){
    const {node}=resolveTarget(context,args);
    context.operations.push({kind:'format_paragraph',target:node.id,properties:{alignment:commands[id]}});
  },
}));

const catalog = new ScriptMacroCommandCatalogB142<Replay>([...alignmentCommands,{
  id:textCommand,source:'body-input',recordable:true,
  safety:{deterministic:true,dialogFree:true,selectionIndependent:true,imeIndependent:true},
  validateArguments(value){
    const args=value as Record<string,unknown>;
    if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==6
      || !safeIndex(args.section)||!safeIndex(args.paragraph)||typeof args.fingerprint!=='string'||!hex.test(args.fingerprint)
      || !safeIndex(args.start)||!safeIndex(args.count)||typeof args.text!=='string'||unsupportedText.test(args.text)
      || (!args.count&&!args.text))throw new Error('기록한 본문 편집 범위나 입력값을 확인할 수 없습니다.');
    return args;
  },
  execute(context,args){
    const {node,text}=resolveTarget(context,args);
    const {start,count,text:replacement}=args as BodyChange;
    const chars=Array.from(text);
    if(start+count>chars.length)throw new Error('기록한 본문 편집 범위가 문단을 벗어났습니다.');
    const next=chars.slice(0,start).join('')+replacement+chars.slice(start+count).join('');
    if(Array.from(next).length>4000||next===text)throw new Error('기록한 본문 변경을 재생할 수 없습니다.');
    if(!context.text.has(node.id))context.operations.push(node.id);
    context.text.set(node.id,next);
  },
}]);

export function createManualAlignmentMacro(
  state:()=>ScriptMacroRuntimeStateB142,
  target:(allowSelection?:boolean)=>Target|undefined,
  onInvalid:(message:string)=>void,
){
  const recorder=new ScriptMacroRecorderB142(catalog);
  let composition:RecordedEdit|undefined;
  let alignments=0;
  const textTargets=new Set<string>();
  function invalidate(error:unknown){
    composition=undefined;recorder.cancel();onInvalid(error instanceof Error?error.message:String(error));
  }
  function capture():RecordedEdit|undefined{
    const anchor=target(true);
    return anchor?{target:anchor,state:{...state(),hasSelection:false,composing:false}}:undefined;
  }
  function recordText(before:RecordedEdit|undefined,observed:ScriptMacroRuntimeStateB142){
    const after=state();
    if(observed.revision===after.revision&&observed.documentIdentity===after.documentIdentity)return;
    const anchor=before?.target,next=target(true);
    if(!before||!anchor||!next||anchor.section!==next.section||anchor.paragraph!==next.paragraph
      ||anchor.sectionCount!==next.sectionCount||anchor.paragraphCount!==next.paragraphCount
      ||!anchor.format||anchor.format!==next.format||anchor.adjacent!==next.adjacent||anchor.text===next.text){
      throw new Error('한 일반 본문 문단 안의 입력이나 삭제만 기록할 수 있습니다.');
    }
    const {section,paragraph,text}=anchor;
    const id=`s${section}p${paragraph}`;
    if(!textTargets.has(id)&&textTargets.size+alignments>=30)throw new Error('재생할 편집 명령은 최대 30개입니다.');
    recorder.recordSuccessfulCommand({source:'body-input',outcome:'success',commandId:textCommand,
      arguments:{section,paragraph,fingerprint:digest(text),...bodyChange(text,next.text)},before:before.state,after});
    textTargets.add(id);
  }
  return {
    get recording(){return recorder.recording;},
    start(){recorder.start(state());alignments=0;textTargets.clear();},
    stop(name:string){
      try{return recorder.stop(name,state());}
      finally{composition=undefined;recorder.cancel();}
    },
    cancel(){composition=undefined;recorder.cancel();},
    text(edit:()=>void){
      if(!recorder.recording||state().composing){edit();return;}
      const observed=state();
      let before:RecordedEdit|undefined;
      try{before=capture();}catch(error){invalidate(error);}
      edit();
      if(!recorder.recording)return;
      try{recordText(before,observed);}catch(error){invalidate(error);}
    },
    startComposition(){
      if(!recorder.recording)return;
      try{
        composition=capture();
        if(!composition)throw new Error('일반 본문의 같은 문단 안에서만 한글 입력을 기록할 수 있습니다.');
      }catch(error){invalidate(error);}
    },
    endComposition(){
      const before=composition;
      composition=undefined;
      if(!recorder.recording||!before)return;
      try{recordText(before,before.state);}catch(error){invalidate(error);}
    },
    dispatch<T extends DispatchResult>(id:string,execute:()=>T):T{
      if(!recorder.recording||!Object.hasOwn(commands,id))return execute();
      let before:ScriptMacroRuntimeStateB142,anchor:Target|undefined;
      try{before=state();anchor=target();}
      catch(error){invalidate(error);return execute();}
      const result=execute();
      if(!result.ok)return result;
      try{
        const after=state();
        if(before.revision===after.revision)return result;
        const next=target();
        if(!anchor||!next||anchor.section!==next.section||anchor.paragraph!==next.paragraph||anchor.text!==next.text||
           anchor.alignment===next.alignment||next.alignment!==commands[id as keyof typeof commands]){
          throw new Error('선택 영역이나 특수 문단의 정렬은 기록할 수 없습니다.');
        }
        if(textTargets.size+alignments>=30)throw new Error('재생할 편집 명령은 최대 30개입니다.');
        recorder.recordSuccessfulCommand({source:'command-dispatcher',outcome:'success',commandId:id,
          arguments:{section:anchor.section,paragraph:anchor.paragraph,fingerprint:digest(anchor.text)},before,after});
        alignments++;
      }catch(error){invalidate(error);}
      return result;
    },
    prepare(macroValue:unknown,base:Snapshot){
      const current=state(),macro=validateScriptMacroB142(macroValue);
      if(recorder.recording||!current.active||!current.editable||current.busy||current.composing||current.hasSelection||
        macro.recordedFrom.documentIdentity!==current.documentIdentity||base.revision!==current.revision){
        throw new Error('기록한 문서의 편집 가능한 본문에서 매크로를 재생해 주세요.');
      }
      const plan:Replay={base,text:new Map(),operations:[]};
      for(const step of macro.steps)catalog.execute(plan,step);
      const operations=plan.operations.flatMap((operation):EditOp[]=>{
        if(typeof operation!=='string')return [operation];
        const original=base.nodes.find(node=>node.id===operation)!.text;
        const change=bodyChange(original,plan.text.get(operation)!);
        if(change.text)return [{kind:'replace_body_text',target:operation,...change}];
        return change.count?[{kind:'delete_body_text',target:operation,start:change.start,count:change.count}]:[];
      });
      if(!operations.length)throw new Error('기록의 시작과 끝에 적용할 변경이 없습니다.');
      return validateEditProposal({message:'기록한 편집을 재생했습니다.',operations,sourceIds:[]},base,[]);
    },
  };
}

type ManualEditObserver = Pick<ReturnType<typeof createManualAlignmentMacro>, 'text'|'startComposition'|'endComposition'>;
const observers = new WeakMap<object,ManualEditObserver>();

export function bindManualEditObserver(wasm:object, observer:ManualEditObserver) {
  observers.set(wasm,observer);
}

export function observeManualTextEdit(wasm:object, edit:()=>void) {
  const observer=observers.get(wasm);
  if(observer)observer.text(edit);
  else edit();
}

export function beginManualComposition(wasm:object) { observers.get(wasm)?.startComposition(); }
export function endManualComposition(wasm:object) { observers.get(wasm)?.endComposition(); }
