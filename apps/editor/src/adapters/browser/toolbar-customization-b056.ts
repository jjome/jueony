/**
 * B056 is a user preference. It projects registered commands into toolbars and
 * must never mutate the active document, its undo stack, or an export payload.
 */
export type ToolbarLayoutB056 = Readonly<{
  toolbarId: string;
  commandIds: readonly string[];
}>;

export type ToolbarCustomizationB056 = Readonly<{
  version: 1;
  toolbars: readonly ToolbarLayoutB056[];
}>;

export interface ToolbarCustomizationStorageB056 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ToolbarCustomizationTargetB056 {
  apply(value: ToolbarCustomizationB056): void;
}

export interface ToolbarCommandB056 {
  id: string;
  label: string;
}

export const TOOLBAR_CUSTOMIZATION_KEY_B056 = 'jueony.user.toolbar-customization.v1';

type ErrorCode =
  | 'invalid-defaults'
  | 'invalid-stored-value'
  | 'unknown-toolbar'
  | 'unknown-command'
  | 'required-command'
  | 'invalid-position'
  | 'read'
  | 'write'
  | 'closed';

export class ToolbarCustomizationErrorB056 extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super({
      'invalid-defaults': '기본 도구 상자 구성이 올바르지 않습니다.',
      'invalid-stored-value': '저장된 도구 상자 구성이 올바르지 않습니다.',
      'unknown-toolbar': '등록되지 않은 도구 상자입니다.',
      'unknown-command': '등록되지 않은 편집 명령입니다.',
      'required-command': '필수 편집 명령은 숨길 수 없습니다.',
      'invalid-position': '도구 상자 명령 위치가 올바르지 않습니다.',
      read: '도구 상자 설정을 읽지 못했습니다.',
      write: '도구 상자 설정을 저장하지 못했습니다.',
      closed: '이미 끝난 도구 상자 설정 세션입니다.',
    }[code]);
    this.name = 'ToolbarCustomizationErrorB056';
    this.code = code;
  }
}

const ID = /^[a-z0-9][a-z0-9:_-]{0,79}$/i;
const MAX_TOOLBARS = 16;
const MAX_COMMANDS = 256;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const left = Object.keys(value).sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function clone(value: ToolbarCustomizationB056): ToolbarCustomizationB056 {
  return Object.freeze({
    version: 1,
    toolbars: Object.freeze(value.toolbars.map(toolbar => Object.freeze({
      toolbarId: toolbar.toolbarId,
      commandIds: Object.freeze([...toolbar.commandIds]),
    }))),
  });
}

type Schema = Readonly<{
  defaults: ToolbarCustomizationB056;
  defaultsByToolbar: ReadonlyMap<string, readonly string[]>;
  registeredCommands: ReadonlySet<string>;
  requiredByToolbar: ReadonlyMap<string, ReadonlySet<string>>;
}>;

function buildSchema(
  commands: readonly ToolbarCommandB056[],
  defaults: readonly ToolbarLayoutB056[],
  required: Readonly<Record<string, readonly string[]>>,
): Schema {
  if (commands.length > MAX_COMMANDS) throw new ToolbarCustomizationErrorB056('invalid-defaults');
  const registeredCommands = new Set<string>();
  for (const command of commands) {
    if (!ID.test(command.id) || typeof command.label !== 'string' || !command.label.trim()
      || registeredCommands.has(command.id)) throw new ToolbarCustomizationErrorB056('invalid-defaults');
    registeredCommands.add(command.id);
  }
  if (!defaults.length || defaults.length > MAX_TOOLBARS) {
    throw new ToolbarCustomizationErrorB056('invalid-defaults');
  }
  const defaultsByToolbar = new Map<string, readonly string[]>();
  const requiredByToolbar = new Map<string, ReadonlySet<string>>();
  for (const toolbar of defaults) {
    if (!ID.test(toolbar.toolbarId) || defaultsByToolbar.has(toolbar.toolbarId)
      || !Array.isArray(toolbar.commandIds) || toolbar.commandIds.length > MAX_COMMANDS
      || new Set(toolbar.commandIds).size !== toolbar.commandIds.length
      || toolbar.commandIds.some(command => !registeredCommands.has(command))) {
      throw new ToolbarCustomizationErrorB056('invalid-defaults');
    }
    const requiredCommands = Object.prototype.hasOwnProperty.call(required, toolbar.toolbarId)
      ? required[toolbar.toolbarId]
      : [];
    if (!Array.isArray(requiredCommands)) throw new ToolbarCustomizationErrorB056('invalid-defaults');
    if (new Set(requiredCommands).size !== requiredCommands.length
      || requiredCommands.some(command => !toolbar.commandIds.includes(command))) {
      throw new ToolbarCustomizationErrorB056('invalid-defaults');
    }
    defaultsByToolbar.set(toolbar.toolbarId, Object.freeze([...toolbar.commandIds]));
    requiredByToolbar.set(toolbar.toolbarId, new Set(requiredCommands));
  }
  if (Object.keys(required).some(toolbarId => !defaultsByToolbar.has(toolbarId))) {
    throw new ToolbarCustomizationErrorB056('invalid-defaults');
  }
  return Object.freeze({
    defaults: clone({version: 1, toolbars: defaults}),
    defaultsByToolbar,
    registeredCommands,
    requiredByToolbar,
  });
}

function validate(value: unknown, schema: Schema, code: 'invalid-stored-value' | 'invalid-defaults'): ToolbarCustomizationB056 {
  if (!isRecord(value) || !exactKeys(value, ['version', 'toolbars']) || value.version !== 1
    || !Array.isArray(value.toolbars) || value.toolbars.length !== schema.defaults.toolbars.length) {
    throw new ToolbarCustomizationErrorB056(code);
  }
  const seen = new Set<string>();
  const toolbars: ToolbarLayoutB056[] = [];
  for (const item of value.toolbars) {
    if (!isRecord(item) || !exactKeys(item, ['toolbarId', 'commandIds'])
      || typeof item.toolbarId !== 'string' || seen.has(item.toolbarId)
      || !Array.isArray(item.commandIds) || item.commandIds.length > MAX_COMMANDS
      || item.commandIds.some(command => typeof command !== 'string')) {
      throw new ToolbarCustomizationErrorB056(code);
    }
    const toolbarId = item.toolbarId;
    const allowed = schema.defaultsByToolbar.get(toolbarId);
    const ids = item.commandIds as string[];
    const required = schema.requiredByToolbar.get(toolbarId);
    if (!allowed || !required || new Set(ids).size !== ids.length
      || ids.some(command => !schema.registeredCommands.has(command) || !allowed.includes(command))
      || [...required].some(command => !ids.includes(command))) {
      throw new ToolbarCustomizationErrorB056(code);
    }
    seen.add(toolbarId);
    toolbars.push({toolbarId, commandIds: ids});
  }
  if ([...schema.defaultsByToolbar.keys()].some(toolbarId => !seen.has(toolbarId))) {
    throw new ToolbarCustomizationErrorB056(code);
  }
  return clone({version: 1, toolbars});
}

export function parseStoredToolbarCustomizationB056(
  raw: string,
  commands: readonly ToolbarCommandB056[],
  defaults: readonly ToolbarLayoutB056[],
  required: Readonly<Record<string, readonly string[]>> = {},
): ToolbarCustomizationB056 {
  const schema = buildSchema(commands, defaults, required);
  if (raw.length > 128 * 1024) throw new ToolbarCustomizationErrorB056('invalid-stored-value');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new ToolbarCustomizationErrorB056('invalid-stored-value'); }
  return validate(parsed, schema, 'invalid-stored-value');
}

export interface ToolbarCustomizationControllerOptionsB056 {
  storage: ToolbarCustomizationStorageB056;
  target: ToolbarCustomizationTargetB056;
  commands: readonly ToolbarCommandB056[];
  defaults: readonly ToolbarLayoutB056[];
  required?: Readonly<Record<string, readonly string[]>>;
  key?: string;
}

export function createToolbarCustomizationControllerB056(options: ToolbarCustomizationControllerOptionsB056) {
  const schema = buildSchema(options.commands, options.defaults, options.required ?? {});
  const key = options.key ?? TOOLBAR_CUSTOMIZATION_KEY_B056;
  let committed: ToolbarCustomizationB056;
  try {
    const raw = options.storage.getItem(key);
    committed = raw === null
      ? schema.defaults
      : parseStoredToolbarCustomizationB056(raw, options.commands, options.defaults, options.required ?? {});
  } catch (error) {
    if (error instanceof ToolbarCustomizationErrorB056) throw error;
    throw new ToolbarCustomizationErrorB056('read');
  }
  let draft = committed;
  let closed = false;
  options.target.apply(clone(committed));

  const open = () => {
    if (closed) throw new ToolbarCustomizationErrorB056('closed');
  };
  const toolbar = (toolbarId: string): ToolbarLayoutB056 => {
    const found = draft.toolbars.find(value => value.toolbarId === toolbarId);
    if (!found) throw new ToolbarCustomizationErrorB056('unknown-toolbar');
    return found;
  };
  const replace = (toolbarId: string, commandIds: readonly string[]) => {
    draft = clone({version: 1, toolbars: draft.toolbars.map(value =>
      value.toolbarId === toolbarId ? {toolbarId, commandIds} : value)});
    options.target.apply(clone(draft));
    return clone(draft);
  };

  return {
    snapshot: () => clone(committed),
    draft: () => clone(draft),
    setVisible(toolbarId: string, commandId: string, visible: boolean, position?: number) {
      open();
      const allowed = schema.defaultsByToolbar.get(toolbarId);
      const current = toolbar(toolbarId);
      if (!allowed?.includes(commandId) || !schema.registeredCommands.has(commandId)) {
        throw new ToolbarCustomizationErrorB056('unknown-command');
      }
      const ids = [...current.commandIds];
      const currentIndex = ids.indexOf(commandId);
      if (!visible) {
        if (schema.requiredByToolbar.get(toolbarId)?.has(commandId)) {
          throw new ToolbarCustomizationErrorB056('required-command');
        }
        if (currentIndex >= 0) ids.splice(currentIndex, 1);
        return replace(toolbarId, ids);
      }
      if (currentIndex >= 0) ids.splice(currentIndex, 1);
      const target = position === undefined ? ids.length : position;
      if (!Number.isSafeInteger(target) || target < 0 || target > ids.length) {
        throw new ToolbarCustomizationErrorB056('invalid-position');
      }
      ids.splice(target, 0, commandId);
      return replace(toolbarId, ids);
    },
    move(toolbarId: string, commandId: string, position: number) {
      open();
      const current = toolbar(toolbarId);
      const ids = [...current.commandIds];
      const from = ids.indexOf(commandId);
      if (from < 0) throw new ToolbarCustomizationErrorB056('unknown-command');
      ids.splice(from, 1);
      if (!Number.isSafeInteger(position) || position < 0 || position > ids.length) {
        throw new ToolbarCustomizationErrorB056('invalid-position');
      }
      ids.splice(position, 0, commandId);
      return replace(toolbarId, ids);
    },
    reset() {
      open();
      draft = schema.defaults;
      options.target.apply(clone(draft));
      return clone(draft);
    },
    commit() {
      open();
      try { options.storage.setItem(key, JSON.stringify(draft)); }
      catch {
        draft = committed;
        options.target.apply(clone(committed));
        throw new ToolbarCustomizationErrorB056('write');
      }
      committed = draft;
      closed = true;
      return clone(committed);
    },
    cancel() {
      open();
      draft = committed;
      options.target.apply(clone(committed));
      closed = true;
      return clone(committed);
    },
  };
}

/** Actual DOM projection seam; creating labels/icons remains the host chrome's job. */
export function createDomToolbarCustomizationTargetB056(options: Readonly<{
  containers: Readonly<Record<string, HTMLElement>>;
  createButton(commandId: string): HTMLElement;
}>): ToolbarCustomizationTargetB056 {
  return {
    apply(value) {
      for (const toolbar of value.toolbars) {
        const container = options.containers[toolbar.toolbarId];
        if (!container) throw new ToolbarCustomizationErrorB056('unknown-toolbar');
        container.replaceChildren(...toolbar.commandIds.map(commandId => options.createButton(commandId)));
      }
    },
  };
}
