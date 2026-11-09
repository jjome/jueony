import {sha256} from '@noble/hashes/sha2.js';

export type EditableFormTypeB078 = 'CheckBox' | 'RadioButton' | 'ComboBox' | 'Edit';
export type FormSourceFormatB078 = 'hwp' | 'hwpx';

export type FormObjectTargetB078 = Readonly<{
  section: number;
  paragraph: number;
  control: number;
}>;

export type FormObjectValueB078 = Readonly<{
  value: number;
  text: string;
  caption: string;
}>;

export type FormObjectValueSealB078 = Readonly<{
  version: 1;
  documentIdentity: string;
  documentInstance: string;
  revision: string;
  sourceFormat: FormSourceFormatB078;
  target: FormObjectTargetB078;
  name: string;
  formType: EditableFormTypeB078;
  enabled: true;
  propertiesSha256: string;
  itemsSha256: string;
  original: FormObjectValueB078;
  fingerprint: string;
}>;

export type FormObjectValueChangeB078 =
  | Readonly<{version: 1; value: 0 | 1}>
  | Readonly<{version: 1; text: string}>;

export interface FormObjectValueHostB078 {
  getFormObjectInfo(section: number, paragraph: number, control: number): string;
  getFormValue(section: number, paragraph: number, control: number): string;
  setFormValue(section: number, paragraph: number, control: number, valueJson: string): string;
  saveSnapshot(): number;
  restoreSnapshot(token: number): unknown;
  discardSnapshot(token: number): void;
  exportHwp(): Uint8Array;
  exportHwpx(): Uint8Array;
}

export interface FormObjectValueContextB078 {
  documentIdentity(): unknown;
  documentInstance(): unknown;
  revision(): unknown;
  sourceFormat(): unknown;
  active(): unknown;
  editable(): unknown;
  story(): unknown;
  formMode(): unknown;
  composing(): unknown;
  passwordRequired(): unknown;
}

export type FormObjectValueBlockReasonB078 =
  | 'api-unavailable' | 'invalid-context' | 'unsupported-story' | 'form-mode'
  | 'password-protected' | 'invalid-target' | 'invalid-form' | 'unsupported-type'
  | 'read-only' | 'password-form' | 'invalid-change' | 'tampered-seal'
  | 'stale-document' | 'stale-form' | 'stale-value' | 'history-unavailable'
  | 'mutation-rejected' | 'verification-failed' | 'history-state-mismatch';

export type FormObjectValueCaptureB078 =
  | {status: 'ready'; seal: FormObjectValueSealB078}
  | {status: 'blocked'; reason: FormObjectValueBlockReasonB078};

export type FormObjectValueTransitionB078 =
  | {status: 'applied'; command: FormObjectValueCommandB078; value: FormObjectValueB078}
  | {status: 'restored'; value: FormObjectValueB078}
  | {status: 'blocked'; reason: FormObjectValueBlockReasonB078}
  | {status: 'state-uncertain'; reason: 'rollback-failed'};

type RecordValue = Record<string, unknown>;
type ContextState = Readonly<{
  identity: string;
  instance: string;
  revision: string;
  sourceFormat: FormSourceFormatB078;
}>;
type FormState = Readonly<{
  name: string;
  formType: string;
  enabled: boolean;
  value: FormObjectValueB078;
  propertiesSha256: string;
  itemsSha256: string;
  items: readonly string[];
  properties: Readonly<Record<string, string>>;
}>;
type ExportDigests = Readonly<{hwp: string; hwpx: string}>;

const required = [
  'getFormObjectInfo', 'getFormValue', 'setFormValue', 'saveSnapshot', 'restoreSnapshot',
  'discardSnapshot', 'exportHwp', 'exportHwpx',
] as const;
const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const supported = new Set<EditableFormTypeB078>(['CheckBox', 'RadioButton', 'ComboBox', 'Edit']);
const MAX_TEXT = 4096;

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
}

function exact(value: RecordValue, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort(), expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function parseJson(value: unknown): RecordValue | undefined {
  try { return record(typeof value === 'string' ? JSON.parse(value) : value); }
  catch { return undefined; }
}

function accepted(value: unknown): boolean { return parseJson(value)?.ok === true; }

function hex(bytes: Uint8Array): string {
  return [...sha256(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalProperties(value: unknown): Readonly<Record<string, string>> | undefined {
  const item = record(value);
  if (!item || Object.keys(item).length > 256) return undefined;
  const entries = Object.entries(item).sort(([left], [right]) => left.localeCompare(right));
  if (entries.some(([key, entry]) => key.length === 0 || key.length > 128
    || typeof entry !== 'string' || entry.length > 4096)) return undefined;
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}

function stringItems(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > 1024
    || value.some(item => typeof item !== 'string' || item.length > MAX_TEXT)) return undefined;
  return Object.freeze([...value] as string[]);
}

function objectDigest(value: unknown): string { return hex(new TextEncoder().encode(JSON.stringify(value))); }

function parseValue(value: unknown): FormObjectValueB078 | undefined {
  const item = record(value);
  if (!item || !exact(item, ['value', 'text', 'caption'])
    || typeof item.value !== 'number' || !Number.isInteger(item.value)
    || item.value < -2_147_483_648 || item.value > 2_147_483_647
    || typeof item.text !== 'string' || item.text.length > 100_000
    || typeof item.caption !== 'string' || item.caption.length > 100_000) return undefined;
  return Object.freeze({value: item.value, text: item.text, caption: item.caption});
}

function parseTarget(value: unknown): FormObjectTargetB078 | undefined {
  const item = record(value);
  if (!item || !exact(item, ['section', 'paragraph', 'control'])
    || !integer(item.section, 100_000) || !integer(item.paragraph, 1_000_000) || !integer(item.control, 100_000)) return undefined;
  return Object.freeze({section: item.section, paragraph: item.paragraph, control: item.control});
}

function sameValue(left: FormObjectValueB078, right: FormObjectValueB078): boolean {
  return left.value === right.value && left.text === right.text && left.caption === right.caption;
}

function hasHost(value: Partial<FormObjectValueHostB078>): value is FormObjectValueHostB078 {
  return required.every(name => typeof (value as RecordValue)[name] === 'function');
}

function contextState(context: FormObjectValueContextB078): ContextState | FormObjectValueBlockReasonB078 {
  try {
    if (context.active() !== true || context.editable() !== true || context.composing() !== false) return 'invalid-context';
    if (context.story() !== 'body') return 'unsupported-story';
    if (context.formMode() !== false) return 'form-mode';
    const passwordRequired = context.passwordRequired();
    if (passwordRequired === true) return 'password-protected';
    if (passwordRequired !== false) return 'invalid-context';
    const identity = context.documentIdentity(), instance = context.documentInstance();
    const revision = context.revision(), sourceFormat = context.sourceFormat();
    if (typeof identity !== 'string' || typeof instance !== 'string' || typeof revision !== 'string'
      || !IDENTITY.test(identity) || !IDENTITY.test(instance) || !IDENTITY.test(revision)
      || (sourceFormat !== 'hwp' && sourceFormat !== 'hwpx')) return 'invalid-context';
    return Object.freeze({identity, instance, revision, sourceFormat});
  } catch { return 'invalid-context'; }
}

function readForm(host: FormObjectValueHostB078, target: FormObjectTargetB078): FormState | undefined {
  try {
    const info = parseJson(host.getFormObjectInfo(target.section, target.paragraph, target.control));
    const value = parseJson(host.getFormValue(target.section, target.paragraph, target.control));
    if (!info || !value || info.ok !== true || value.ok !== true
      || !exact(info, ['ok', 'formType', 'name', 'value', 'text', 'caption', 'enabled', 'width', 'height',
        'foreColor', 'backColor', 'properties', 'items'])
      || !exact(value, ['ok', 'formType', 'name', 'value', 'text', 'caption', 'enabled'])
      || typeof info.formType !== 'string' || info.formType !== value.formType
      || typeof info.name !== 'string' || info.name.length > 256 || info.name !== value.name
      || typeof info.enabled !== 'boolean' || info.enabled !== value.enabled) return undefined;
    const properties = canonicalProperties(info.properties), items = stringItems(info.items);
    const formValue = parseValue({value: value.value, text: value.text, caption: value.caption});
    if (!properties || !items || !formValue || info.value !== value.value || info.text !== value.text
      || info.caption !== value.caption) return undefined;
    return Object.freeze({name: info.name, formType: info.formType, enabled: info.enabled,
      value: formValue, propertiesSha256: objectDigest(properties), itemsSha256: objectDigest(items), items, properties});
  } catch { return undefined; }
}

function readOnlyReason(form: FormState): FormObjectValueBlockReasonB078 | undefined {
  if (!supported.has(form.formType as EditableFormTypeB078)) return 'unsupported-type';
  if (!form.enabled || ['0', 'false', 'FALSE'].includes(form.properties.Editable ?? '')
    || ['1', 'true', 'TRUE'].includes(form.properties.ReadOnly ?? '')) return 'read-only';
  if (form.formType === 'Edit' && (form.properties.PasswordChar ?? '').length > 0) return 'password-form';
  return undefined;
}

function unsignedSeal(seal: Omit<FormObjectValueSealB078, 'fingerprint'>): string {
  return objectDigest(seal);
}

function parseSeal(value: unknown): FormObjectValueSealB078 | undefined {
  const item = record(value);
  if (!item || !exact(item, ['version', 'documentIdentity', 'documentInstance', 'revision', 'sourceFormat', 'target',
    'name', 'formType', 'enabled', 'propertiesSha256', 'itemsSha256', 'original', 'fingerprint'])
    || item.version !== 1 || typeof item.documentIdentity !== 'string' || !IDENTITY.test(item.documentIdentity)
    || typeof item.documentInstance !== 'string' || !IDENTITY.test(item.documentInstance)
    || typeof item.revision !== 'string' || !IDENTITY.test(item.revision)
    || (item.sourceFormat !== 'hwp' && item.sourceFormat !== 'hwpx')
    || typeof item.name !== 'string' || item.name.length > 256
    || typeof item.formType !== 'string' || !supported.has(item.formType as EditableFormTypeB078)
    || item.enabled !== true || typeof item.propertiesSha256 !== 'string' || !SHA256.test(item.propertiesSha256)
    || typeof item.itemsSha256 !== 'string' || !SHA256.test(item.itemsSha256)
    || typeof item.fingerprint !== 'string' || !SHA256.test(item.fingerprint)) return undefined;
  const target = parseTarget(item.target), original = parseValue(item.original);
  if (!target || !original) return undefined;
  const unsigned = {version: 1 as const, documentIdentity: item.documentIdentity, documentInstance: item.documentInstance,
    revision: item.revision, sourceFormat: item.sourceFormat as FormSourceFormatB078, target, name: item.name,
    formType: item.formType as EditableFormTypeB078, enabled: true as const,
    propertiesSha256: item.propertiesSha256, itemsSha256: item.itemsSha256, original};
  if (unsignedSeal(unsigned) !== item.fingerprint) return undefined;
  return Object.freeze({...unsigned, fingerprint: item.fingerprint});
}

function nextValue(
  form: FormState,
  seal: FormObjectValueSealB078,
  change: unknown,
): {payload: string; value: FormObjectValueB078} | undefined {
  const item = record(change);
  if (!item || item.version !== 1) return undefined;
  if (form.formType === 'CheckBox' || form.formType === 'RadioButton') {
    if (!exact(item, ['version', 'value']) || (item.value !== 0 && item.value !== 1)) return undefined;
    return {payload: JSON.stringify({value: item.value}), value: Object.freeze({...seal.original, value: item.value})};
  }
  if (!exact(item, ['version', 'text']) || typeof item.text !== 'string' || item.text.length > MAX_TEXT) return undefined;
  if (form.formType === 'ComboBox' && form.items.length > 0 && !form.items.includes(item.text)) return undefined;
  return {payload: JSON.stringify({text: item.text}), value: Object.freeze({...seal.original, text: item.text})};
}

function exportsDigest(host: FormObjectValueHostB078): ExportDigests | undefined {
  try {
    const hwp = host.exportHwp(), hwpx = host.exportHwpx();
    if (!(hwp instanceof Uint8Array) || !(hwpx instanceof Uint8Array)) return undefined;
    return Object.freeze({hwp: hex(hwp), hwpx: hex(hwpx)});
  } catch { return undefined; }
}

function sameDigests(left: ExportDigests, right: ExportDigests): boolean {
  return left.hwp === right.hwp && left.hwpx === right.hwpx;
}

function matchesSeal(form: FormState, seal: FormObjectValueSealB078, expected: FormObjectValueB078): boolean {
  return form.name === seal.name && form.formType === seal.formType && form.enabled === seal.enabled
    && form.propertiesSha256 === seal.propertiesSha256 && form.itemsSha256 === seal.itemsSha256
    && sameValue(form.value, expected);
}

export function captureFormObjectValueB078(
  hostInput: Partial<FormObjectValueHostB078>,
  context: FormObjectValueContextB078,
  targetInput: unknown,
): FormObjectValueCaptureB078 {
  if (!hasHost(hostInput)) return {status: 'blocked', reason: 'api-unavailable'};
  const current = contextState(context);
  if (typeof current === 'string') return {status: 'blocked', reason: current};
  const target = parseTarget(targetInput); if (!target) return {status: 'blocked', reason: 'invalid-target'};
  const form = readForm(hostInput, target); if (!form) return {status: 'blocked', reason: 'invalid-form'};
  const blocked = readOnlyReason(form); if (blocked) return {status: 'blocked', reason: blocked};
  const unsigned = {version: 1 as const, documentIdentity: current.identity, documentInstance: current.instance,
    revision: current.revision, sourceFormat: current.sourceFormat, target, name: form.name,
    formType: form.formType as EditableFormTypeB078, enabled: true as const,
    propertiesSha256: form.propertiesSha256, itemsSha256: form.itemsSha256, original: form.value};
  return {status: 'ready', seal: Object.freeze({...unsigned, fingerprint: unsignedSeal(unsigned)})};
}

export function applyFormObjectValueB078(
  hostInput: Partial<FormObjectValueHostB078>,
  context: FormObjectValueContextB078,
  sealInput: unknown,
  change: unknown,
): FormObjectValueTransitionB078 {
  if (!hasHost(hostInput)) return {status: 'blocked', reason: 'api-unavailable'};
  const seal = parseSeal(sealInput); if (!seal) return {status: 'blocked', reason: 'tampered-seal'};
  const current = contextState(context);
  if (typeof current === 'string') return {status: 'blocked', reason: current};
  if (current.identity !== seal.documentIdentity || current.instance !== seal.documentInstance
    || current.revision !== seal.revision || current.sourceFormat !== seal.sourceFormat) {
    return {status: 'blocked', reason: 'stale-document'};
  }
  const form = readForm(hostInput, seal.target); if (!form) return {status: 'blocked', reason: 'stale-form'};
  const blocked = readOnlyReason(form); if (blocked) return {status: 'blocked', reason: blocked};
  if (!matchesSeal(form, seal, seal.original)) {
    const sameObject = form.name === seal.name && form.formType === seal.formType && form.enabled === seal.enabled
      && form.propertiesSha256 === seal.propertiesSha256 && form.itemsSha256 === seal.itemsSha256;
    return {status: 'blocked', reason: sameObject ? 'stale-value' : 'stale-form'};
  }
  const next = nextValue(form, seal, change); if (!next) return {status: 'blocked', reason: 'invalid-change'};
  if (sameValue(next.value, seal.original)) return {status: 'blocked', reason: 'invalid-change'};
  const beforeDigest = exportsDigest(hostInput); if (!beforeDigest) return {status: 'blocked', reason: 'verification-failed'};
  let beforeToken: number | undefined, afterToken: number | undefined;
  try {
    const candidate = hostInput.saveSnapshot();
    if (!integer(candidate)) return {status: 'blocked', reason: 'history-unavailable'};
    beforeToken = candidate;
    const preMutation = contextState(context), preMutationForm = readForm(hostInput, seal.target);
    const preMutationDigest = exportsDigest(hostInput);
    if (typeof preMutation === 'string' || preMutation.identity !== seal.documentIdentity
      || preMutation.instance !== seal.documentInstance || preMutation.revision !== seal.revision
      || preMutation.sourceFormat !== seal.sourceFormat || !preMutationForm
      || !matchesSeal(preMutationForm, seal, seal.original) || !preMutationDigest
      || !sameDigests(preMutationDigest, beforeDigest)) throw new Error('verification');
    if (!accepted(hostInput.setFormValue(seal.target.section, seal.target.paragraph, seal.target.control, next.payload))) {
      throw new Error('mutation');
    }
    const changed = contextState(context), changedForm = readForm(hostInput, seal.target), afterDigest = exportsDigest(hostInput);
    if (typeof changed === 'string' || changed.identity !== seal.documentIdentity || changed.instance !== seal.documentInstance
      || changed.sourceFormat !== seal.sourceFormat || changed.revision === seal.revision
      || !changedForm || !matchesSeal(changedForm, seal, next.value) || !afterDigest || sameDigests(afterDigest, beforeDigest)) {
      throw new Error('verification');
    }
    const afterCandidate = hostInput.saveSnapshot();
    if (!integer(afterCandidate)) throw new Error('snapshot');
    afterToken = afterCandidate;
    return {status: 'applied', value: next.value,
      command: new FormObjectValueCommandB078(hostInput, context, seal, next.value, changed.revision,
        beforeToken, afterToken, beforeDigest, afterDigest)};
  } catch (error) {
    if (beforeToken === undefined) return {status: 'blocked', reason: 'history-unavailable'};
    try {
      if (!accepted(hostInput.restoreSnapshot(beforeToken))) throw new Error('restore');
      const restored = contextState(context), restoredForm = readForm(hostInput, seal.target), restoredDigest = exportsDigest(hostInput);
      if (typeof restored === 'string' || restored.identity !== seal.documentIdentity || restored.instance !== seal.documentInstance
        || restored.revision !== seal.revision || !restoredForm || !matchesSeal(restoredForm, seal, seal.original)
        || !restoredDigest || !sameDigests(restoredDigest, beforeDigest)) throw new Error('verify');
      if (afterToken !== undefined) hostInput.discardSnapshot(afterToken);
      hostInput.discardSnapshot(beforeToken);
      return {status: 'blocked', reason: String(error).includes('mutation') ? 'mutation-rejected' : 'verification-failed'};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }
}

export class FormObjectValueCommandB078 {
  #position: 'before' | 'after' | 'disposed' = 'after';
  readonly #host: FormObjectValueHostB078;
  readonly #context: FormObjectValueContextB078;
  readonly #seal: FormObjectValueSealB078;
  readonly #afterValue: FormObjectValueB078;
  readonly #afterRevision: string;
  readonly #beforeToken: number;
  readonly #afterToken: number;
  readonly #beforeDigest: ExportDigests;
  readonly #afterDigest: ExportDigests;

  constructor(
    host: FormObjectValueHostB078,
    context: FormObjectValueContextB078,
    seal: FormObjectValueSealB078,
    afterValue: FormObjectValueB078,
    afterRevision: string,
    beforeToken: number,
    afterToken: number,
    beforeDigest: ExportDigests,
    afterDigest: ExportDigests,
  ) {
    this.#host = host;
    this.#context = context;
    this.#seal = seal;
    this.#afterValue = afterValue;
    this.#afterRevision = afterRevision;
    this.#beforeToken = beforeToken;
    this.#afterToken = afterToken;
    this.#beforeDigest = beforeDigest;
    this.#afterDigest = afterDigest;
  }

  undo(): FormObjectValueTransitionB078 { return this.#restore('before'); }
  redo(): FormObjectValueTransitionB078 { return this.#restore('after'); }

  #restore(target: 'before' | 'after'): FormObjectValueTransitionB078 {
    const expected = target === 'before' ? 'after' : 'before';
    if (this.#position !== expected) return {status: 'blocked', reason: 'history-state-mismatch'};
    const current = contextState(this.#context), currentDigest = exportsDigest(this.#host);
    const currentRevision = expected === 'before' ? this.#seal.revision : this.#afterRevision;
    const expectedDigest = expected === 'before' ? this.#beforeDigest : this.#afterDigest;
    if (typeof current === 'string' || current.identity !== this.#seal.documentIdentity
      || current.instance !== this.#seal.documentInstance || current.sourceFormat !== this.#seal.sourceFormat
      || current.revision !== currentRevision || !currentDigest || !sameDigests(currentDigest, expectedDigest)) {
      return {status: 'blocked', reason: 'history-state-mismatch'};
    }
    try {
      const token = target === 'before' ? this.#beforeToken : this.#afterToken;
      if (!accepted(this.#host.restoreSnapshot(token))) throw new Error('restore');
      const restored = contextState(this.#context), restoredForm = readForm(this.#host, this.#seal.target);
      const restoredDigest = exportsDigest(this.#host), value = target === 'before' ? this.#seal.original : this.#afterValue;
      const revision = target === 'before' ? this.#seal.revision : this.#afterRevision;
      const digestValue = target === 'before' ? this.#beforeDigest : this.#afterDigest;
      if (typeof restored === 'string' || restored.identity !== this.#seal.documentIdentity
        || restored.instance !== this.#seal.documentInstance || restored.sourceFormat !== this.#seal.sourceFormat
        || restored.revision !== revision || !restoredForm || !matchesSeal(restoredForm, this.#seal, value)
        || !restoredDigest || !sameDigests(restoredDigest, digestValue)) throw new Error('verify');
      this.#position = target;
      return {status: 'restored', value};
    } catch { return {status: 'state-uncertain', reason: 'rollback-failed'}; }
  }

  dispose(): void {
    if (this.#position === 'disposed') return;
    this.#position = 'disposed';
    try { this.#host.discardSnapshot(this.#beforeToken); } catch { /* release only */ }
    try { this.#host.discardSnapshot(this.#afterToken); } catch { /* release only */ }
  }
}
