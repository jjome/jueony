/** Closed, ordinary ClickHere leaf profile. This is not general HWT editing. */
export interface HwtLeafField {name:string;fieldId:number;paragraph:number;value:string}
export interface HwtLeafInspection {version:1;profile:'plain-root-string-clickhere-v1';sourceSha256:string;fields:HwtLeafField[]}
export interface HwtLeafRequest {instance:string;revision:number;sourceSha256:string;fieldId:number;originalText:string;text:string}
export interface HwtLeafEnginePort {
 inspect(bytes:Uint8Array):Promise<HwtLeafInspection>;
 edit(bytes:Uint8Array,request:Pick<HwtLeafRequest,'sourceSha256'|'fieldId'|'originalText'|'text'>):Promise<Uint8Array>;
}
export interface HwtLeafRecoveryState {version:1;source:Uint8Array;current:Uint8Array;past:Uint8Array[];future:Uint8Array[];revision:number;savedSha256:string}
export interface HwtLeafCheckpoint {token:string;updatedAt:number;name:string;state:HwtLeafRecoveryState}
export interface HwtLeafRecoveryPort {
 read():Promise<HwtLeafCheckpoint|null>;
 write(value:Pick<HwtLeafCheckpoint,'name'|'state'>,expectedToken:string|null):Promise<HwtLeafCheckpoint>;
 discard(expectedToken:string):Promise<void>;
}
export type HwtLeafSaveReceipt={status:'saved';name:string}|{status:'cancelled'}|{status:'failed_partial';message:string};
export interface HwtLeafSavePort {saveCopy(bytes:Uint8Array,name:string):Promise<HwtLeafSaveReceipt>}
export {createHwtLeafWorkspace,restoreHwtLeafWorkspace,assertHwtLeafRecovery} from '../application/hwt-leaf-workspace.ts';
export type {HwtLeafWorkspace} from '../application/hwt-leaf-workspace.ts';
