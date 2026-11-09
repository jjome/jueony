import {inspectShortcutStoryContextN021} from '../../shortcuts/special-story-context-n021.ts';

export type TableCreateRequestB067 = Readonly<{
  source: 'grid' | 'keyboard';
  rows: number;
  columns: number;
}>;

export type TableCreatePlanB067 = Readonly<{
  request: TableCreateRequestB067;
  revision: string;
  position: Readonly<{sectionIndex:number;paragraphIndex:number;charOffset:number}>;
  document: object;
  controls: string;
  paragraphCount: number;
}>;

const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
const parsed=(value:unknown,label:string):unknown=>{
  if(typeof value!=='string')return value;
  if(value.length>4*1024*1024)throw new Error(`${label} 응답이 너무 큽니다.`);
  try{return JSON.parse(value);}catch{throw new Error(`${label} 응답을 읽지 못했습니다.`);}
};
const exact=(value:unknown):string=>JSON.stringify(value);
const method=(target:Record<string,unknown>,name:string):((...args:any[])=>any)=>{
  const value=target[name];
  if(typeof value!=='function')throw new Error('이 편집 엔진은 검증 가능한 표 만들기를 지원하지 않습니다.');
  return value.bind(target);
};

/** The visible picker is exactly 8 rows by 10 columns in pinned Studio. */
export function gridTableRequestB067(rows:unknown,columns:unknown):TableCreateRequestB067{
  if(!integer(rows)||!integer(columns)||rows<1||rows>8||columns<1||columns>10)
    throw new Error('빠른 표 격자는 1~8줄, 1~10칸만 지원합니다.');
  return Object.freeze({source:'grid',rows,columns});
}

/**
 * Studio accepts 1..256 per axis. This boundary additionally caps the product
 * to 4096 cells so a malformed dialog cannot allocate a 65,536-cell document.
 */
export function keyboardTableRequestB067(rows:unknown,columns:unknown):TableCreateRequestB067{
  if(!integer(rows)||!integer(columns)||rows<1||rows>256||columns<1||columns>256)
    throw new Error('표 줄·칸 수는 각각 1~256의 정수여야 합니다.');
  if(rows*columns>4096)throw new Error('한 번에 만들 수 있는 표는 4,096칸 이하입니다.');
  return Object.freeze({source:'keyboard',rows,columns});
}

function position(input:Record<string,unknown>){
  if(typeof input.getPosition!=='function'||typeof input.getCursorPosition!=='function')
    throw new Error('표를 만들 본문 위치를 확인하지 못했습니다.');
  const a=input.getPosition.call(input),b=input.getCursorPosition.call(input);
  for(const value of[a,b])if(!record(value)||!integer(value.sectionIndex)||!integer(value.paragraphIndex)||!integer(value.charOffset))
    throw new Error('표를 만들 본문 위치를 확인하지 못했습니다.');
  if(!record(a)||!record(b)||a.sectionIndex!==b.sectionIndex||a.paragraphIndex!==b.paragraphIndex||a.charOffset!==b.charOffset
    ||b.parentParaIndex!==undefined||(Array.isArray(b.cellPath)&&b.cellPath.length>0)||b.isTextBox===true)
    throw new Error('최상위 본문 캐럿에서만 표를 만들 수 있습니다.');
  return Object.freeze({sectionIndex:a.sectionIndex as number,paragraphIndex:a.paragraphIndex as number,charOffset:a.charOffset as number});
}

function documentOf(input:Record<string,unknown>):Record<string,unknown>{
  if(!record(input.wasm)||typeof input.wasm.borrowDocumentHandle!=='function')throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  const document=input.wasm.borrowDocumentHandle.call(input.wasm);
  if(!record(document))throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
  return document;
}

function controls(document:Record<string,unknown>):readonly Record<string,unknown>[] {
  if(typeof document.getControls!=='function')throw new Error('표 생성 결과를 확인할 수 없는 엔진입니다.');
  const value=parsed(document.getControls.call(document),'컨트롤 목록');
  if(!Array.isArray(value)||value.some(item=>!record(item)))throw new Error('컨트롤 목록이 올바르지 않습니다.');
  return value as readonly Record<string,unknown>[];
}

function safeContext(value:unknown):boolean{
  return record(value)&&value.hasDocument===true&&value.isEditable===true&&value.isFormMode===false
    &&value.inTable===false&&value.inCellSelectionMode===false&&value.inPictureObjectSelection===false
    &&value.inTableObjectSelection===false&&value.inField===false;
}

function assertInput(input:Record<string,unknown>,context:unknown){
  if(!safeContext(context))throw new Error('현재 선택이나 문서 상태에서는 표를 만들 수 없습니다.');
  if(input.active!==true||input.isComposing!==false)throw new Error('입력 조합 중이거나 비활성 편집기에서는 표를 만들 수 없습니다.');
  if(!record(input.wasm)||input.wasm.requiresPasswordForSave===true)throw new Error('암호 문서에는 표를 만들 수 없습니다.');
  if(typeof input.isFormMode!=='function'||input.isFormMode.call(input)!==false)throw new Error('양식 모드에서는 표를 만들 수 없습니다.');
  const story=inspectShortcutStoryContextN021(input);
  if(story.kind!=='body'||!story.exact)
    throw new Error('최상위 본문에서만 표를 만들 수 있습니다.');
  if(!record(input.cursor)||typeof input.cursor.hasSelection!=='function'||input.cursor.hasSelection.call(input.cursor)!==false)
    throw new Error('선택을 해제하고 표를 만들어 주세요.');
  return position(input);
}

function assertTarget(document:Record<string,unknown>,at:ReturnType<typeof position>){
  for(const name of['getSectionCount','getParagraphCount','getParagraphLength','createTable','getTableDimensions'])
    if(typeof document[name]!=='function')throw new Error('이 편집 엔진은 검증 가능한 표 만들기를 지원하지 않습니다.');
  if(method(document,'getSectionCount')()!==1||at.sectionIndex!==0)throw new Error('다구역 문서의 표 만들기는 아직 지원하지 않습니다.');
  const count=method(document,'getParagraphCount')(0),length=method(document,'getParagraphLength')(0,at.paragraphIndex);
  if(!integer(count)||at.paragraphIndex>=count||length!==0||at.charOffset!==0)
    throw new Error('현재는 비어 있는 최상위 본문 문단에서만 표를 만들 수 있습니다.');
  const target=controls(document).filter(item=>item.list===0&&item.para===at.paragraphIndex);
  if(target.some(item=>!['secd','cold'].includes(String(item.ctrlId))))throw new Error('필드나 개체가 있는 문단에는 표를 만들 수 없습니다.');
  return count;
}

export function captureTableCreateB067(inputValue:unknown,context:unknown,revision:unknown,request:TableCreateRequestB067):TableCreatePlanB067{
  if(!record(inputValue)||typeof revision!=='string'||revision.length<1||revision.length>256)throw new Error('편집기 문서 버전을 확인하지 못했습니다.');
  const checked=request.source==='grid'?gridTableRequestB067(request.rows,request.columns):keyboardTableRequestB067(request.rows,request.columns);
  const at=assertInput(inputValue,context),document=documentOf(inputValue),paragraphCount=assertTarget(document,at);
  return Object.freeze({request:checked,revision,position:at,document,controls:exact(controls(document)),paragraphCount});
}

export function applyTableCreateB067(inputValue:unknown,context:unknown,revision:unknown,plan:TableCreatePlanB067):void{
  if(!record(inputValue)||typeof inputValue.executeOperation!=='function')throw new Error('편집기 명령 연결을 확인하지 못했습니다.');
  const current=assertInput(inputValue,context),document=documentOf(inputValue);
  if(revision!==plan.revision||document!==plan.document||exact(current)!==exact(plan.position))throw new Error('문서나 캐럿이 바뀌었습니다. 표 만들기를 다시 열어 주세요.');
  if(assertTarget(document,current)!==plan.paragraphCount||exact(controls(document))!==plan.controls)throw new Error('문서 구조가 바뀌었습니다. 표 만들기를 다시 열어 주세요.');
  inputValue.executeOperation.call(inputValue,{kind:'snapshot',operationType:'jueonyCreateTableB067',operation(wasm:unknown){
    if(!record(wasm)||typeof wasm.borrowDocumentHandle!=='function')throw new Error('문서 엔진 연결을 확인하지 못했습니다.');
    const live=wasm.borrowDocumentHandle.call(wasm);
    if(live!==plan.document||revision!==plan.revision||exact(assertInput(inputValue,context))!==exact(plan.position))throw new Error('문서가 바뀌었습니다. 표 만들기를 다시 실행해 주세요.');
    if(!record(live)||assertTarget(live,plan.position)!==plan.paragraphCount||exact(controls(live))!==plan.controls)throw new Error('문서 구조가 바뀌었습니다. 표 만들기를 다시 실행해 주세요.');
    const before=controls(live),raw=method(live,'createTable')(plan.position.sectionIndex,plan.position.paragraphIndex,0,plan.request.rows,plan.request.columns),made=parsed(raw,'표 만들기');
    if(!record(made)||made.ok!==true||!integer(made.paraIdx)||!integer(made.controlIdx))throw new Error('표를 만들지 못했습니다.');
    const dimensions=parsed(method(live,'getTableDimensions')(0,made.paraIdx,made.controlIdx),'표 크기');
    if(!record(dimensions)||dimensions.rowCount!==plan.request.rows||dimensions.colCount!==plan.request.columns||dimensions.cellCount!==plan.request.rows*plan.request.columns)
      throw new Error('만든 표의 크기를 확인하지 못했습니다.');
    const after=controls(live),inserted=after.filter(item=>item.list===0&&item.para===made.paraIdx&&item.controlIndex===made.controlIdx&&item.ctrlId==='tbl');
    if(after.length!==before.length+1||inserted.length!==1)throw new Error('만든 표의 주소를 확인하지 못했습니다.');
    return {sectionIndex:0,paragraphIndex:0,charOffset:0,parentParaIndex:made.paraIdx,controlIndex:made.controlIdx,cellIndex:0,cellParaIndex:0};
  },meta:Object.freeze({actionId:'table:create',domain:'table',refresh:'full',dirtyScope:'document'})});
}
