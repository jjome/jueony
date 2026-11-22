import {captureTemplate,materializeTemplate,templateVariables,templateSections,shapeTargetOptions,draftTemplate,assertTemplate} from '../domain/commands.ts';
import {describeTemplate} from './describe-template.ts';
import {tableTargetOptions} from '../domain/table-template-targets.ts';
import type {AutomationProposal} from '../public/contracts.ts';
import type {Snapshot,Receipt} from '../../document/public/index.ts';
/** The same document command boundary used by AI; no macro-specific engine or undo. */
export interface AutomationEditorPort {
 snapshot():Snapshot;
 apply(runId:string,base:Snapshot,proposal:AutomationProposal):Promise<Receipt>;
}
export function createAutomationFacade(){
 return {
  capture:captureTemplate,prepare:materializeTemplate,variables:templateVariables,sections:templateSections,
  tables:(template:Parameters<typeof tableTargetOptions>[0],base:Snapshot)=>{assertTemplate(template);return tableTargetOptions(template,base);},
  shapes:shapeTargetOptions,
  describe:describeTemplate,draft:draftTemplate,validate:assertTemplate,
  async apply(options:{runId:string;base:Snapshot;proposal:AutomationProposal;editor:AutomationEditorPort;createDocument:()=>Promise<AutomationEditorPort>}){
   let editor=options.editor,base=options.base;
   if(options.proposal.operations[0]?.kind==='create_document'){editor=await options.createDocument();base=editor.snapshot();}
   return editor.apply(options.runId,base,options.proposal);
  },
 };
}
export type AutomationFacade=ReturnType<typeof createAutomationFacade>;
