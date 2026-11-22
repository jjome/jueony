export {
  SCRIPT_MACRO_B142_LIMITS,
  SCRIPT_MACRO_B142_SCHEMA,
  SCRIPT_MACRO_B142_VERSION,
  SCRIPT_MACRO_BODY_TEXT_COMMAND,
  ScriptMacroValidationErrorB142,
  assertScriptMacroCommandIdB142,
  assertScriptMacroDocumentVersionB142,
  normalizeScriptMacroArgumentsB142,
  parseScriptMacroB142,
  serializeScriptMacroB142,
  validateScriptMacroB142,
} from '../domain/script-macro-b142.ts';

export type {
  ScriptMacroArgumentsB142,
  ScriptMacroB142,
  ScriptMacroDocumentVersionB142,
  ScriptMacroJsonScalarB142,
  ScriptMacroJsonValueB142,
  ScriptMacroStepB142,
} from '../domain/script-macro-b142.ts';

export type SavedAlignmentMacro = {id:string;workspaceId:string;createdAt:number;json:string};
