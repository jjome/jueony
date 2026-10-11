/** Compatibility entry for the Preferences facade and the native blank-document adapter. */
export { DOCUMENT_DEFAULTS_KEY, defaultDocumentDefaults, validateDocumentDefaults, readDocumentDefaults, saveDocumentDefaults, resetDocumentDefaults } from '../modules/preferences/public/index.ts';
export type { DocumentDefaults, PageDefaults } from '../modules/preferences/public/index.ts';
export { applyNewDocumentDefaults } from '../adapters/rhwp/document-defaults.ts';
export type { BlankDocumentDefaultsPort } from '../adapters/rhwp/document-defaults.ts';
