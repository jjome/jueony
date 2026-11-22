import type {EditOp} from '../../document/public/index.ts';
type TemplateBody={operations:EditOp[];anchors:Record<string,string>};
export type TableTemplateAnchor={rows:number;columns:number;evidence:string;kind?:'nested'};
export type CommandTemplate=TemplateBody&({version:1}|{version:2;sectionRefs:number[]}|{version:3;sectionRefs:number[];tableRefs:Record<string,TableTemplateAnchor>}|
 {version:4;shapeFingerprint:string;operations:[Extract<EditOp,{kind:'set_shape_fill'}>]});
export type SectionTargets=Record<string,number>;
export type TableTargets=Record<string,string>;
export type CommandMacro={id:string;workspaceId:string;name:string;createdAt:number;template:CommandTemplate};
export interface MacroRepositoryPort {
  list(workspaceId:string):CommandMacro[];
  append(macro:CommandMacro):Promise<void>;
  rename(workspaceId:string,id:string,name:string):Promise<void>;
  remove(workspaceId:string,id:string):Promise<void>;
}
export type AutomationProposal={message:string;operations:EditOp[];sourceIds:string[]};
