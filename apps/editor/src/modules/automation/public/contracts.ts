import type {EditOp} from '../../document/public/index.ts';
export type CommandTemplate={version:1;operations:EditOp[];anchors:Record<string,string>};
export type CommandMacro={id:string;workspaceId:string;name:string;createdAt:number;template:CommandTemplate};
export type AutomationProposal={message:string;operations:EditOp[];sourceIds:string[]};
