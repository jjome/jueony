export type {CommandTemplate,CommandMacro,AutomationProposal,SectionTargets} from './contracts.ts';
export {captureTemplate,materializeTemplate,templateVariables,templateSections,draftTemplate,assertTemplate} from '../domain/commands.ts';
export {createAutomationFacade} from '../application/facade.ts';
export type {AutomationFacade,AutomationEditorPort} from '../application/facade.ts';
