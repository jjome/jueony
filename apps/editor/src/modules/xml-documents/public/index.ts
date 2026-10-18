export type {XmlAttributeValue,XmlElementValue,XmlValidationIssue,XmlFieldValue,XmlWorkspaceSnapshot,XmlEditRequest,XmlExportArtifact,XmlRecoveryState,XmlRecoveryCheckpoint,XmlRecoveryPort} from './contracts.ts';
export type {XmlCodecPort} from '../ports/xml-codec.ts';
export {compileXmlSchema,validateXmlInstance,XmlContractError} from '../domain/schema.ts';
export {assertXmlRecoveryState} from '../domain/recovery.ts';
export {createXmlWorkspace,restoreXmlWorkspace,XML_LIMITATIONS} from '../application/workspace.ts';
export type {XmlWorkspace} from '../application/workspace.ts';
