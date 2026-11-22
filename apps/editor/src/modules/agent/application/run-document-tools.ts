import type { DocumentToolCall, DocumentToolInput, DocumentToolResult } from '../../connections/public/index.ts';
import { validateGeneration } from '../domain/generation.ts';
import type { AgentEvent } from '../public/contracts.ts';
import type { LayoutDiagnostics, Snapshot } from '../../document/public/index.ts';
import {DOCUMENT_TOOL_PAGE_SIZE,DOCUMENT_TOOL_READ_LENGTH,type DocumentToolOutline,type DocumentToolWindow} from '../../document/public/document-tool-reading.ts';
import {findSourceTextOffset,findSpreadsheetLocation,parseOfficeTextQuery,sourceLocationsInRange} from '../../references/public/index.ts';
import { awaitRunRead, checkRun, commitGeneration, type RunOptions } from './run-once.ts';

export type DocumentToolRunOptions = RunOptions & {
  readOnly?: true;
  onEvent?: (event: AgentEvent) => void;
  inspectLayout?: () => Promise<LayoutDiagnostics>;
  longDocument?: {outline:DocumentToolOutline;read:(section:number,paragraph:number,start:number,count:number)=>Promise<DocumentToolWindow>;
    captureEditBase?:(target:string)=>Promise<Snapshot>};
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const MAX_CALLS = 4;
const MAX_TOOLS = 8;
const MAX_INPUT = 1_500_000;
const index = (value: unknown): value is number => typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
type ReadRange={start:number;end:number};

function readArguments(text:string):Record<string,unknown>|undefined{
  try{const value:unknown=JSON.parse(text);return record(value)?value:undefined;}
  catch{return undefined;}
}

function rememberRead(ranges:ReadRange[],next:ReadRange):ReadRange[]{
  const merged:ReadRange[]=[];
  for(const range of [...ranges,next].sort((left,right)=>left.start-right.start)){
    const previous=merged.at(-1);
    if(previous&&previous.end>=range.start)previous.end=Math.max(previous.end,range.end);
    else merged.push({...range});
  }
  return merged;
}

function withinReadRange(operation:unknown,observed:Map<string,ReadRange[]>):operation is {kind:'replace_body_text';target:string;start:number;count:number} {
  if(!record(operation)||operation.kind!=='replace_body_text'||typeof operation.target!=='string'||!index(operation.start)||!index(operation.count))return false;
  const {start,count,target}=operation;
  return Boolean(observed.get(target)?.some(range=>range.start<=start&&range.end>=start+count));
}

export async function runDocumentTools(options: DocumentToolRunOptions) {
  const generate = options.port.generateDocumentToolTurn;
  if (!generate) throw new Error('이 연결은 문서 조회 도구를 지원하지 않습니다.');
  const started = Date.now();
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(180_000)]);
  const active = { ...options, signal };
  const longDocument = options.longDocument;
  if(longDocument&&longDocument.outline.revision!==options.context.document.revision){
    throw new Error('장문 조회 목록과 현재 문서 버전이 다릅니다.');
  }
  const input: DocumentToolInput = {
    request: options.context.request,
    paragraphs: options.context.document.nodes.map(({id, editable}) => ({ id, editable:editable&&!options.readOnly })),
    referenceCount: options.context.references.length,
    ...(options.readOnly?{readOnly:true as const}:{}),
    tools: ['read_paragraph', ...(!longDocument||options.context.references.length?['find_reference' as const]:[]),
      ...(longDocument ? ['list_paragraphs' as const] : options.inspectLayout ? ['inspect_layout' as const] : [])],
    ...(longDocument?{documentScope:{mode:longDocument.captureEditBase?'windowed-edit' as const:'windowed-read-only' as const,sectionParagraphs:longDocument.outline.sectionParagraphs}}:{}),
    turns: [],
  };
  const seen = new Map<string,boolean>();
  const callIds = new Set<string>();
  const observedParagraphs = new Map<string,ReadRange[]>();
  const observedSources = new Set<string>();
  let call = 0;
  let toolCount = 0;
  let inputCharacters = 0;
  let consecutiveErrors = 0;
  let readOnlyFinal = false;
  let verifiedLookup = false;
  const recordToolFailure=()=>{
    if(++consecutiveErrors<2)return;
    if(!options.readOnly||!verifiedLookup)throw new Error('도구 요청이 두 번 연속 실패했습니다.');
    readOnlyFinal=true;
  };
  const notify = (phase: AgentEvent['phase'], reason?: string, operationCount?: number) => {
    try { options.onEvent?.({ phase, call, maxCalls: MAX_CALLS, elapsedMs: Date.now() - started, inputCharacters, reason, operationCount }); }
    catch { /* Progress display cannot affect the editing transaction. */ }
  };
  try {
    for (call = 1; call <= MAX_CALLS; call++) {
      checkRun(active);
      const turnInput:DocumentToolInput=readOnlyFinal?{...input,finalize:'read-only'}:call===MAX_CALLS?{...input,finalize:true}:input;
      inputCharacters += JSON.stringify(turnInput).length;
      if (inputCharacters > MAX_INPUT) throw new Error('도구 실행 입력 한도를 넘었습니다.');
      options.state('generating');
      notify(call === 1 ? 'generating' : 'reviewing');
      const turn = await awaitRunRead(generate.call(options.port, turnInput, options.model, signal), signal);
      checkRun(active);
      if (!record(turn)) throw new Error('모델 도구 응답을 읽을 수 없습니다.');
      if (turn.kind === 'final') {
        options.state('validating');
        if(options.readOnly&&record(turn.generation)&&Array.isArray(turn.generation.operations)&&turn.generation.operations.length){
          throw new Error('문서 조회 요청에서 제안한 변경을 적용하지 않았습니다. 조회 범위 편집을 선택하면 본문을 바꿀 수 있습니다.');
        }
        if(readOnlyFinal&&record(turn.generation)&&Array.isArray(turn.generation.operations)&&turn.generation.operations.length){
          throw new Error('같은 도구 요청이 반복되어 마지막 답변에서는 문서를 읽기만 할 수 있습니다.');
        }
        const proposal=turn.generation;
        if(call===1&&(input.readOnly||input.documentScope?.mode==='windowed-read-only')&&record(proposal)&&
          Array.isArray(proposal.operations)&&proposal.operations.length===0&&Array.isArray(proposal.sourceIds)&&
          proposal.sourceIds.length>0&&proposal.sourceIds.every(id=>typeof id==='string')){
          // Check the rest of the proposal without sending any rejected content back to the model.
          validateGeneration({...proposal,sourceIds:[]},options.context.document,[]);
          input.repair='unverified-citation';
          continue;
        }
        let context=options.context;
        if(longDocument&&record(turn.generation)&&Array.isArray(turn.generation.operations)&&turn.generation.operations.length){
          if(!longDocument.captureEditBase)throw new Error('장문 문맥은 문단을 나눠 읽기만 할 수 있습니다.');
          const [operation]=turn.generation.operations;
          if(turn.generation.operations.length!==1||!withinReadRange(operation,observedParagraphs)){
            throw new Error('직접 읽어 확인한 편집 가능한 본문 문단 하나의 범위에서만 수정할 수 있습니다.');
          }
          const document=await awaitRunRead(longDocument.captureEditBase(operation.target),signal);
          checkRun(active);
          if(document.revision!==options.context.document.revision)throw new Error('장문 조회 이후 문서 버전이 바뀌었습니다.');
          context={...context,document};
        }
        const result = validateGeneration(turn.generation, context.document, [...observedSources]);
        if(input.repair&&!verifiedLookup)result.message='문서나 참고자료에서 답을 확인하지 못했습니다.';
        if (result.operations.length > 1 || result.operations.some(operation => !withinReadRange(operation,observedParagraphs))) {
          throw new Error('도구 모드에서는 직접 읽은 본문 문단 하나의 확인한 범위만 수정할 수 있습니다.');
        }
        notify('ready', undefined, result.operations.length);
        const committed = await commitGeneration({ ...active, context, state(status) {
          options.state(status);
          if (status === 'applying') notify('applying', undefined, result.operations.length);
        } }, result);
        let layout: LayoutDiagnostics | undefined;
        if (!longDocument && options.inspectLayout && options.isCurrent()) {
          try { layout = await awaitRunRead(options.inspectLayout(), signal); }
          catch { layout = { status:'unavailable', checkedPages:0, count:0, findings:[], limitations:['편집 후 배치를 확인할 수 없습니다.'] }; }
        }
        notify('completed', undefined, committed.receipt?.operationCount ?? 0);
        return { ...committed, layout };
      }
      if (turn.kind !== 'tools' || !Array.isArray(turn.calls) || !turn.calls.length || toolCount + turn.calls.length > MAX_TOOLS) {
        throw new Error('모델 응답이 허용된 도구 요청 형식이나 실행 한도를 벗어났습니다.');
      }
      if (readOnlyFinal) throw new Error('모델이 같은 도구 요청을 반복해 최종 답변을 받지 못했습니다.');
      if (call === MAX_CALLS) throw new Error('모델 호출 한도 안에 최종 응답을 받지 못했습니다.');
      if(turn.continuation!==undefined&&(typeof turn.continuation!=='string'||!/^turn_[0-9a-f]{32}$/u.test(turn.continuation))){
        throw new Error('모델 도구의 후속 요청을 확인할 수 없습니다.');
      }
      const results: DocumentToolResult[] = [];
      for (const value of turn.calls) {
        checkRun(active);
        if (!record(value) || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/u.test(value.id)
            || callIds.has(value.id) || typeof value.name !== 'string' || !input.tools.includes(value.name as DocumentToolCall['name'])
            || typeof value.arguments !== 'string' || value.arguments.length > 1000) throw new Error('허용되지 않은 도구 요청입니다.');
        const tool = value as DocumentToolCall;
        callIds.add(tool.id);
        toolCount++;
        const parsed=readArguments(tool.arguments);
        if(!parsed){
          recordToolFailure();
          results.push({call:tool,result:JSON.stringify({error:'도구 인자는 JSON 객체여야 합니다. 인자를 고쳐 다른 조회를 요청하세요.'})});
          continue;
        }
        const key = JSON.stringify([options.context.document.revision, tool.name, Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b))]);
        if (seen.has(key)) {
          if(!seen.get(key)&&(!options.readOnly||!verifiedLookup))throw new Error('모델이 실패한 도구 요청을 반복했습니다.');
          readOnlyFinal=true;
          results.push({call:tool,result:JSON.stringify({error:'이미 조회한 대상입니다. 앞서 받은 근거로 답하고 확인하지 못한 내용은 표시하세요. 기존 문서는 수정하지 마세요.'})});
          continue;
        }
        let output: unknown;
        if (tool.name === 'read_paragraph') {
          const start=Object.hasOwn(parsed,'start')?parsed.start:0;
          const count=Object.hasOwn(parsed,'count')?parsed.count:DOCUMENT_TOOL_READ_LENGTH;
          if(Object.keys(parsed).every(key=>['id','start','count'].includes(key))&&typeof parsed.id==='string'&&
            index(start)&&index(count)&&count>0&&count<=DOCUMENT_TOOL_READ_LENGTH){
            if(longDocument){
              const address=parsed.id.match(/^s(0|[1-9][0-9]{0,2})p(0|[1-9][0-9]{0,5})$/u);
              if(address){
                const section=Number(address[1]),paragraph=Number(address[2]);
                if(paragraph<(longDocument.outline.sectionParagraphs[section]??0)){
                  try{
                    const window=await awaitRunRead(longDocument.read(section,paragraph,start,count),signal);
                    if(longDocument.captureEditBase&&window.editable&&window.id===parsed.id&&window.start===start&&index(window.end)&&window.end<=start+count){
                      observedParagraphs.set(window.id,rememberRead(observedParagraphs.get(window.id)??[],{start,end:window.end}));
                    }
                    output=window;
                  }
                  catch(error){if(!record(error)||error.name!=='RangeError')throw error;}
                  checkRun(active);
                }
              }
            }else{
              const node=options.context.document.nodes.find(node=>node.id===parsed.id);
              if(node){
                const characters=Array.from(node.text),length=characters.length;
                if(start<length||start===0&&length===0){
                  const end=Math.min(length,start+count);
                  observedParagraphs.set(node.id,rememberRead(observedParagraphs.get(node.id)??[],{start,end}));
                  output={id:node.id,text:characters.slice(start,end).join(''),editable:node.editable&&!options.readOnly,length,
                    ...(start||end<length?{start,end}:{}),...(end<length?{nextOffset:end}:{})};
                }
              }
            }
          }
        } else if(tool.name==='list_paragraphs'&&longDocument){
          const {section,offset}=parsed;
          if(Object.keys(parsed).length===2&&index(section)&&index(offset)){
            const total=longDocument.outline.sectionParagraphs[section];
            if(total!==undefined&&offset<total){
              const end=Math.min(total,offset+DOCUMENT_TOOL_PAGE_SIZE);
              output={section,total,ids:Array.from({length:end-offset},(_,i)=>`s${section}p${offset+i}`),
                ...(end<total?{nextOffset:end}:{})};
            }
          }
        } else if (tool.name === 'find_reference') {
          if (Object.keys(parsed).length === 1 && typeof parsed.query === 'string' && parsed.query.trim().length > 0 && parsed.query.length <= 120) {
            const query = parsed.query.trim().normalize('NFKC').toLowerCase();
            const office = parseOfficeTextQuery(query);
            output = options.context.references.flatMap(source => {
              const place=office?source.locations?.find(({address})=>office.kind==='pdf'
                ? address.kind==='pdf'&&address.page===office.page
                : address.kind==='docx'&&address.paragraph===office.paragraph)
                : findSpreadsheetLocation(source.locations,query);
              if(office&&!place)return [];
              const match=place?.start??findSourceTextOffset(source.text,query);
              if(match<0&&!source.name.normalize('NFKC').toLowerCase().includes(query))return [];
              const found=Math.max(0,match);
              let start=place?.start??Math.max(0,found-180),end=place?.end??Math.min(source.text.length,found+820);
              if(office&&end-start>2000)end=start+2000;
              if(start>0&&/[\uDC00-\uDFFF]/u.test(source.text[start]))start--;
              if(end<source.text.length&&/[\uDC00-\uDFFF]/u.test(source.text[end]))end++;
              const locations=sourceLocationsInRange(source.locations,start,end);
              return [{ id: source.id, name: source.name, text: source.text.slice(start,end), ...(locations?{locations}:{}) }];
            }).slice(0, 4);
            for (const hit of output as {id:string}[]) observedSources.add(hit.id);
          }
        } else if (!Object.keys(parsed).length && options.inspectLayout) {
          output = await awaitRunRead(options.inspectLayout(), signal);
          checkRun(active);
        }
        seen.set(key,output!==undefined);
        if (output === undefined) {
          recordToolFailure();
          output = { error: '대상이나 인자가 유효하지 않습니다. 다른 조회를 요청하세요.' };
        } else {
          consecutiveErrors = 0;
          if(tool.name!=='find_reference'||(Array.isArray(output)&&output.length>0))verifiedLookup=true;
        }
        results.push({ call: tool, result: JSON.stringify(output) });
      }
      input.turns.push(results);
      input.continuation=turn.continuation as string|undefined;
      notify('validated');
    }
    throw new Error('최종 모델 응답을 받지 못했습니다.');
  } catch (error) {
    notify('stopped', error instanceof Error ? error.name : 'Error');
    throw error;
  }
}
