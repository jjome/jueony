export type {CommandTemplate,CommandMacro,AutomationProposal} from './contracts.ts';
export {captureTemplate,materializeTemplate,templateVariables,draftTemplate,assertTemplate} from '../domain/commands.ts';
export {createAutomationFacade} from '../application/facade.ts';
export type {AutomationFacade,AutomationEditorPort} from '../application/facade.ts';
