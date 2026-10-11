export type SaveSnapshot = {expectedRevision: unknown; bytes: Uint8Array};
export type RecoveryRecord = {id:string;workspaceId:string;name:string;bytes:Uint8Array;dirty:boolean;updatedAt:number};
export type RecoveryArtifact={bytes:Uint8Array;contentLoss:{schemaVersion:number;outputFormat:string;count:number;losses:unknown[]}};
export type DocumentFormat='hwp'|'hwpx';
