import {WorkspaceStore} from '../adapters/storage/indexeddb-workspace.ts';
import {LocalModelGateway} from '../adapters/http/local-model-gateway.ts';
import type {ConnectionFacade,ModelGatewayPort} from '../modules/connections/public/index.ts';
export function createWorkbenchServices(){
 const gateway=new LocalModelGateway();
 return {store:new WorkspaceStore(),connections:gateway as ConnectionFacade,modelGateway:gateway as ModelGatewayPort};
}
