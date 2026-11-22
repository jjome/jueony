import {WorkspaceStore} from '../adapters/storage/indexeddb-workspace.ts';
import {workspaceRunRepository} from '../adapters/storage/workspace-run-repository.ts';
import {workspaceMacroRepository} from '../adapters/storage/workspace-macro-repository.ts';
import {LocalModelGateway} from '../adapters/http/local-model-gateway.ts';
import type {ConnectionFacade,ModelGatewayPort} from '../modules/connections/public/index.ts';
import {createReferenceFacade} from '../modules/references/public/index.ts';
import {browserContentHash} from '../adapters/browser/content-hash.ts';
import {createAgentFacade} from '../modules/agent/public/index.ts';
export function createWorkbenchServices(){
 const gateway=new LocalModelGateway();
 const references=createReferenceFacade(browserContentHash,gateway);
 return {store:new WorkspaceStore(),connections:gateway as ConnectionFacade,modelGateway:gateway as ModelGatewayPort,references,agent:createAgentFacade(references),runRepository:workspaceRunRepository,macroRepository:workspaceMacroRepository};
}
