import type {EditOp} from '../../document/public/index.ts';
type TemplateBody={operations:EditOp[];anchors:Record<string,string>};
export type CommandTemplate=TemplateBody&({version:1}|{version:2;sectionRefs:number[]});
export type SectionTargets=Record<string,number>;
export type CommandMacro={id:string;workspaceId:string;name:string;createdAt:number;template:CommandTemplate};
export type AutomationProposal={message:string;operations:EditOp[];sourceIds:string[]};
