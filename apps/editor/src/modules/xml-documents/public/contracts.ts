/** Standalone schema-bound XML. This is neither HWPML nor an HWT document. */
export interface XmlAttributeValue { namespace:string; name:string; value:string }
export interface XmlElementValue {
 namespace:string; name:string; attributes:XmlAttributeValue[];
 namespaces:Record<string,string>; text:string; children:XmlElementValue[];
}
export interface XmlValidationIssue { path:string; message:string }
export interface XmlFieldValue { path:number[]; name:string; namespace:string; value:string; simple:boolean }
export interface XmlWorkspaceSnapshot {
 revision:number; dirty:boolean; canUndo:boolean; canRedo:boolean;
 fields:XmlFieldValue[]; profile:'local-sequence-restrictions-v2';
 limitations:readonly string[];
}
export type XmlEditRequest =
 | {kind:'replace';revision:number;path:readonly number[];originalText:string;text:string}
 | {kind:'repeat'|'remove';revision:number;path:readonly number[]};
export interface XmlExportArtifact { xml:string; schema:string; profile:'local-sequence-restrictions-v2' }
/** Recovery preserves exact source strings and both sides of Undo/Redo. */
export interface XmlRecoveryState {
 version:1; source:string; schema:string; current:string;
 past:string[]; future:string[]; revision:number;
}
export interface XmlRecoveryCheckpoint {
 token:string; updatedAt:number; xmlName:string; xsdName:string; state:XmlRecoveryState;
}
/** A compare-and-swap store; a stale window must never overwrite another checkpoint. */
export interface XmlRecoveryPort {
 read():Promise<XmlRecoveryCheckpoint|null>;
 write(value:Pick<XmlRecoveryCheckpoint,'xmlName'|'xsdName'|'state'>,expectedToken:string|null):Promise<XmlRecoveryCheckpoint>;
 discard(expectedToken:string):Promise<void>;
}
