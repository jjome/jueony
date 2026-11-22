import type {Run} from '../adapters/storage/legacy-records.ts';
import type {AgentFacade, AgentFilePort, Generation} from '../modules/agent/public/index.ts';
import type {Snapshot} from '../modules/document/public/index.ts';
import type {RetrievalMode, Source} from '../modules/references/public/index.ts';
import type {WorkspaceState} from '../modules/workspace/public/index.ts';
import type {DocumentFrameClient} from '../adapters/iframe/document-client.ts';

type ContextInput = {
  agent: Pick<AgentFacade,'context'|'contextWithRetrieval'>;
  editor: Pick<DocumentFrameClient,'snapshot'|'inspectDocumentToolOutline'|'readDocumentToolWindow'|'captureDocumentToolEditBase'>;
  filePort: Pick<AgentFilePort,'snapshot'>;
  state: WorkspaceState;
  run: Pick<Run,'workspaceId'|'chatId'|'sources'|'retrieval'|'events'>;
  request: string;
  useTools: boolean;
  allowToolEdits: boolean;
  alignment?: {revision: string; generation: Generation; requestPrefix: string};
  readReferences: () => Promise<Source[]>;
  retrievalMode: () => RetrievalMode|undefined;
  signal: AbortSignal;
};

export async function prepareAgentContext(input: ContextInput) {
  const {agent,editor,filePort,state,run,request,alignment,signal}=input;
  const {workspaceId,chatId}=run;
  const readWindow=input.useTools?editor.readDocumentToolWindow:undefined;
  const outline=readWindow?editor.inspectDocumentToolOutline?.():undefined;
  const captureEditBase=input.allowToolEdits?editor.captureDocumentToolEditBase:undefined;
  const longDocument=outline&&readWindow?{
    outline,
    async read(section:number,paragraph:number,start:number,count:number){
      return readWindow.call(editor,outline.revision,section,paragraph,start,count,Boolean(captureEditBase));
    },
    ...(captureEditBase?{captureEditBase:async(target:string)=>captureEditBase.call(editor,outline.revision,target)}:{}),
  }:undefined;
  const snapshot:Snapshot=outline?{revision:outline.revision,name:outline.name,nodes:[],limitations:['장문 문서는 본문을 나눠 읽습니다.']}
    :{...editor.snapshot(),fileContext:filePort.snapshot()};
  if(alignment&&alignment.revision!==snapshot.revision)throw new Error('편집 기록을 확인한 뒤 문서가 바뀌었습니다.');
  const references=alignment?[]:await input.readReferences();
  run.sources=references.map(({text,...source})=>source);
  const contextArgs=[state,workspaceId,chatId,snapshot,references,request] as const;
  const retrievalMode=alignment?undefined:input.retrievalMode();
  const retrieved=retrievalMode?await agent.contextWithRetrieval([...contextArgs],signal,retrievalMode):undefined;
  const context=retrieved?.context??agent.context(...contextArgs);
  run.sources=context.references.map(({text,...source})=>source);
  run.retrieval=retrieved?.retrieval;
  run.events=[];
  return {context,snapshot,longDocument,alignmentPlan:alignment?buildAlignmentPlan(alignment,snapshot,request):undefined};
}

function buildAlignmentPlan(alignment: NonNullable<ContextInput['alignment']>,snapshot: Snapshot,request: string) {
  const operations=alignment.generation.operations;
  const textEdits=operations.some(operation=>operation.kind==='replace_body_text'||operation.kind==='delete_body_text');
  const targets=new Set(operations.flatMap(operation=>'target' in operation?[operation.target]:[]));
  const nodes=snapshot.nodes.filter(node=>targets.has(node.id)).map(({id,section,paragraph})=>({
    id,section,paragraph,text:textEdits?'편집 대상 문단':'정렬 대상 문단',editable:true,
  }));
  const note=request.slice(alignment.requestPrefix.length).trim();
  const modelOperations=operations.map((operation,index)=>operation.kind==='replace_body_text'
    ?{...operation,text:`[[RECORDED_TEXT_${index+1}]]`}:operation);
  const instruction=textEdits
    ?'불러온 편집 기록의 아래 명령과 입력값 표식을 동일한 순서와 값으로 돌려주세요. 실제 본문과 입력값은 편집기가 적용합니다. 다른 편집이나 인용은 포함하지 마세요.'
    :'불러온 정렬 기록의 아래 명령을 동일한 순서로 제안하세요. 다른 편집이나 인용은 포함하지 마세요.';
  return {operations,...(textEdits?{modelOperations}:{}),modelInput:{
    request:instruction+'\n'+JSON.stringify({operations:modelOperations,...(note?{replyNotes:note}:{})}),
    document:{revision:'alignment-record',name:textEdits?'불러온 본문 편집 기록':'불러온 문단 정렬 기록',nodes,limitations:[]},
    references:[],history:[],
  }};
}
