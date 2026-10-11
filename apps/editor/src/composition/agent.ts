import {createAgentFacade} from '../modules/agent/public/index.ts';
import {references} from './references.ts';
export const agent=createAgentFacade(references);
