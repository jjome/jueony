import {inspectShortcutStoryContextN021} from '../../shortcuts/special-story-context-n021.ts';

export type SymbolInsertionPlanB090 = Readonly<{
  symbol: string;
  revision: string;
  position: Readonly<{sectionIndex:number;paragraphIndex:number;charOffset:number}>;
  document: Record<string,unknown>;
  paragraphText: string;
  controls: string;
}>;

export type SymbolRecentStoreB090 = Readonly<{
  read(): unknown;
  write(value: string): void;
}>;

const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
const exact=(value:unknown)=>JSON.stringify(value);
const scalarLength=(value:string)=>Array.from(value).length;
const method=(target:Record<string,unknown>,name:string):((...args:any[])=>any)=>{
  const value=target[name];
  if(typeof value!=='function')throw new Error('이 편집 엔진은 검증 가능한 문자 삽입을 지원하지 않습니다.');
  return value.bind(target);
};

/** Keeps old-Hangul jamo sequences byte-for-byte; character-map input is not normalized. */
export function validateSymbolB090(value:unknown):string{
  if(typeof value!=='string')throw new Error('넣을 문자를 확인하지 못했습니다.');
  const scalars=Array.from(value);
  if(scalars.length<1||scalars.length>8)throw new Error('문자표에서는 한 번에 1~8개 유니코드 문자만 넣을 수 있습니다.');
  for(const scalar of scalars){
    const point=scalar.codePointAt(0)!;
    if((point>=0xd800&&point<=0xdfff)||(point<=0x1f)||(point>=0x7f&&point<=0x9f)
      ||(point>=0x202a&&point<=0x202e)||(point>=0x2066&&point<=0x2069)
      ||point===0x2028||point===0x2029||point===0xfffc||point===0xfeff)
      throw new Error('제어 문자나 문서 내부 표식은 문자표로 넣을 수 없습니다.');
  }
  return value;
}

function parseRecents(value:unknown):string[]{
  if(typeof value!=='string'||value.length>8192)return [];
  try{
    const parsed=JSON.parse(value);
    if(!Array.isArray(parsed))return [];
    const result:string[]=[];
    for(const item of parsed){
      try{const symbol=validateSymbolB090(item);if(!result.includes(symbol))result.push(symbol);}catch{/* discard corrupt entries */}
      if(result.length===20)break;
    }
    return result;
  }catch{return [];}
}

export function readRecentSymbolsB090(store:SymbolRecentStoreB090):readonly string[]{
  try{return Object.freeze(parseRecents(store.read()));}catch{return Object.freeze([]);}
}

/** Recent-character persistence is best effort and never changes edit success. */
export function rememberRecentSymbolB090(store:SymbolRecentStoreB090|undefined,value:string):boolean{
  if(!store)return false;
  const symbol=validateSymbolB090(value),next=[symbol,...readRecentSymbolsB090(store).filter(item=>item!==symbol)].slice(0,20);
  try{store.write(JSON.stringify(next));return true;}catch{return false;}
}

function documentOf(input:Record<string,unknown>):Record<string,unknown>{
  if(!record(input.wasm)||typeof input.wasm.borrowDocumentHandle!=='function')throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  const document=input.wasm.borrowDocumentHandle.call(input.wasm);
  if(!record(document))throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  return document;
}

function positionOf(input:Record<string,unknown>){
  if(typeof input.getPosition!=='function'||typeof input.getCursorPosition!=='function')throw new Error('문자를 넣을 위치를 확인하지 못했습니다.');
  const a=input.getPosition.call(input),b=input.getCursorPosition.call(input);
  for(const value of[a,b])if(!record(value)||!integer(value.sectionIndex)||!integer(value.paragraphIndex)||!integer(value.charOffset))throw new Error('문자를 넣을 위치를 확인하지 못했습니다.');
  if(!record(a)||!record(b)||a.sectionIndex!==b.sectionIndex||a.paragraphIndex!==b.paragraphIndex||a.charOffset!==b.charOffset
    ||b.parentParaIndex!==undefined||(Array.isArray(b.cellPath)&&b.cellPath.length>0)||b.isTextBox===true)throw new Error('최상위 본문 캐럿에서만 문자표를 사용할 수 있습니다.');
  return Object.freeze({sectionIndex:a.sectionIndex as number,paragraphIndex:a.paragraphIndex as number,charOffset:a.charOffset as number});
}

function assertInput(input:Record<string,unknown>,context:unknown){
  if(!record(context)||context.hasDocument!==true||context.isEditable!==true||context.isFormMode!==false||context.inTable===true
    ||context.inCellSelectionMode===true||context.inPictureObjectSelection===true||context.inTableObjectSelection===true||context.inField===true)
    throw new Error('현재 선택이나 문서 상태에서는 문자표를 사용할 수 없습니다.');
  if(input.active!==true||input.isComposing!==false||!record(input.wasm)||input.wasm.requiresPasswordForSave===true)
    throw new Error('입력 조합 중이거나 보호된 문서에는 문자를 넣을 수 없습니다.');
  if(typeof input.isFormMode!=='function'||input.isFormMode.call(input)!==false)throw new Error('양식 모드에서는 문자를 넣을 수 없습니다.');
  if(!record(input.cursor)||typeof input.cursor.hasSelection!=='function'||input.cursor.hasSelection.call(input.cursor)!==false)
    throw new Error('선택을 해제한 본문 캐럿에서 문자표를 사용해 주세요.');
  const story=inspectShortcutStoryContextN021(input);
  if(story.kind!=='body'||!story.exact)throw new Error('최상위 본문에서만 문자표를 사용할 수 있습니다.');
  return positionOf(input);
}

function inspectTarget(document:Record<string,unknown>,position:ReturnType<typeof positionOf>){
  for(const name of['getSectionCount','getParagraphCount','getParagraphLength','getTextRange','getControls','insertText'])
    if(typeof document[name]!=='function')throw new Error('이 편집 엔진은 검증 가능한 문자 삽입을 지원하지 않습니다.');
  const sections=method(document,'getSectionCount')(),paragraphs=method(document,'getParagraphCount')(position.sectionIndex);
  if(!integer(sections)||position.sectionIndex>=sections||!integer(paragraphs)||position.paragraphIndex>=paragraphs)throw new Error('문자 삽입 위치가 문서 범위를 벗어났습니다.');
  const length=method(document,'getParagraphLength')(position.sectionIndex,position.paragraphIndex);
  if(!integer(length)||position.charOffset>length||length>100000)throw new Error('문자 삽입 위치나 문단 크기가 올바르지 않습니다.');
  const text=method(document,'getTextRange')(position.sectionIndex,position.paragraphIndex,0,length);
  if(typeof text!=='string'||scalarLength(text)!==length)throw new Error('대상 문단 원문을 정확히 읽지 못했습니다.');
  const raw=method(document,'getControls')();let controls:unknown;
  try{controls=typeof raw==='string'&&raw.length<=4*1024*1024?JSON.parse(raw):raw;}catch{throw new Error('문단 컨트롤을 확인하지 못했습니다.');}
  if(!Array.isArray(controls)||controls.some(item=>!record(item)))throw new Error('문단 컨트롤을 확인하지 못했습니다.');
  const flat=Array.from({length:position.sectionIndex},(_,section)=>method(document,'getParagraphCount')(section) as unknown).reduce<number>((sum,value)=>sum+Number(value),0)+position.paragraphIndex;
  if(controls.some(item=>item.list===0&&item.para===flat&&!['secd','cold'].includes(String(item.ctrlId))))
    throw new Error('필드나 개체가 있는 문단은 아직 문자표 삽입을 지원하지 않습니다.');
  return {text,controls:exact(controls)};
}

export function captureSymbolInsertionB090(inputValue:unknown,context:unknown,revision:unknown,value:unknown):SymbolInsertionPlanB090{
  if(!record(inputValue)||typeof revision!=='string'||revision.length<1||revision.length>256)throw new Error('편집기 문서 버전을 확인하지 못했습니다.');
  const symbol=validateSymbolB090(value),position=assertInput(inputValue,context),document=documentOf(inputValue),target=inspectTarget(document,position);
  return Object.freeze({symbol,revision,position,document,paragraphText:target.text,controls:target.controls});
}

export function applySymbolInsertionB090(inputValue:unknown,context:unknown,revision:unknown,plan:SymbolInsertionPlanB090,store?:SymbolRecentStoreB090):Readonly<{recentStored:boolean}>{
  if(!record(inputValue)||typeof inputValue.executeOperation!=='function')throw new Error('편집기 명령 연결을 확인하지 못했습니다.');
  const position=assertInput(inputValue,context),document=documentOf(inputValue),target=inspectTarget(document,position);
  if(revision!==plan.revision||document!==plan.document||exact(position)!==exact(plan.position)||target.text!==plan.paragraphText||target.controls!==plan.controls)
    throw new Error('문서나 캐럿이 바뀌었습니다. 문자표를 다시 열어 주세요.');
  inputValue.executeOperation.call(inputValue,{kind:'snapshot',operationType:'jueonyInsertSymbolB090',operation(wasm:unknown){
    if(!record(wasm)||typeof wasm.borrowDocumentHandle!=='function')throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
    const live=wasm.borrowDocumentHandle.call(wasm);
    if(live!==plan.document||revision!==plan.revision||exact(assertInput(inputValue,context))!==exact(plan.position))throw new Error('문서가 바뀌었습니다. 문자를 넣지 않았습니다.');
    const current=inspectTarget(plan.document,plan.position);
    if(current.text!==plan.paragraphText||current.controls!==plan.controls)throw new Error('대상 문단이 바뀌었습니다. 문자를 넣지 않았습니다.');
    const result=method(plan.document,'insertText')(plan.position.sectionIndex,plan.position.paragraphIndex,plan.position.charOffset,plan.symbol);
    let receipt:unknown=result;
    if(typeof result==='string'&&result.length<=4096){try{receipt=JSON.parse(result);}catch{/* invalid below */}}
    const accepted=result===true||(record(receipt)&&receipt.ok===true);
    if(!accepted)throw new Error('문서 엔진이 문자를 넣지 못했습니다.');
    const next=inspectTarget(plan.document,plan.position).text,characters=Array.from(plan.paragraphText),expected=[...characters.slice(0,plan.position.charOffset),plan.symbol,...characters.slice(plan.position.charOffset)].join('');
    if(next!==expected)throw new Error('문자 삽입 결과가 원문과 다릅니다.');
    return {...plan.position,charOffset:plan.position.charOffset+scalarLength(plan.symbol)};
  },meta:Object.freeze({actionId:'insert:symbols',domain:'text',refresh:'full',dirtyScope:'document'})});
  return Object.freeze({recentStored:rememberRecentSymbolB090(store,plan.symbol)});
}
