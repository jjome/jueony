import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import init, {HwpDocument} from '../node_modules/@rhwp/core/rhwp.js';
import {
  applyFormObjectValueB078,
  captureFormObjectValueB078,
  type FormObjectValueContextB078,
  type FormObjectValueHostB078,
  type FormObjectTargetB078,
} from '../src/adapters/rhwp/form-object-value-b078.ts';

await init({module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});

// Upstream rhwp's real `form-01.hwp` corpus fixture, gzip-compressed so this
// focused test remains self-contained even in a sparse source checkout.
const FORM_HWP = gunzipSync(Buffer.from(
  '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',
  'base64',
));

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const parse = (value: string) => JSON.parse(value) as Record<string, unknown>;

function fixture(sourceFormat: 'hwp' | 'hwpx' = 'hwp') {
  const document = new HwpDocument(FORM_HWP);
  let identity = 'document-b078', instance = 'instance-b078', active = true, editable = true;
  let story = 'body', formMode = false, composing = false, passwordRequired = false;
  let revisionOverride: string | undefined;
  const context: FormObjectValueContextB078 = {
    documentIdentity: () => identity,
    documentInstance: () => instance,
    revision: () => revisionOverride ?? digest(document.exportHwp()),
    sourceFormat: () => sourceFormat,
    active: () => active,
    editable: () => editable,
    story: () => story,
    formMode: () => formMode,
    composing: () => composing,
    passwordRequired: () => passwordRequired,
  };
  return {document, context,
    setIdentity(value: string) { identity = value; }, setInstance(value: string) { instance = value; },
    setRevision(value: string | undefined) { revisionOverride = value; }, setActive(value: boolean) { active = value; },
    setEditable(value: boolean) { editable = value; }, setStory(value: string) { story = value; },
    setFormMode(value: boolean) { formMode = value; }, setComposing(value: boolean) { composing = value; },
    setPasswordRequired(value: boolean) { passwordRequired = value; }};
}

const cases: ReadonlyArray<Readonly<{
  name: string;
  target: FormObjectTargetB078;
  change: Readonly<Record<string, unknown>>;
  expected: Readonly<Record<string, unknown>>;
}>> = [
  {name: 'CheckBox', target: {section: 0, paragraph: 2, control: 0}, change: {version: 1, value: 0}, expected: {value: 0}},
  {name: 'RadioButton', target: {section: 0, paragraph: 6, control: 0}, change: {version: 1, value: 1}, expected: {value: 1}},
  {name: 'ComboBox', target: {section: 0, paragraph: 4, control: 0}, change: {version: 1, text: '봄'}, expected: {text: '봄'}},
  {name: 'Edit', target: {section: 0, paragraph: 8, control: 0}, change: {version: 1, text: '안전 입력'}, expected: {text: '안전 입력'}},
];

test('B078 edits four real top-level form values and preserves exact HWP/HWPX undo and redo', () => {
  for (const scenario of cases) {
    const f = fixture();
    try {
      const beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
      const captured = captureFormObjectValueB078(f.document, f.context, scenario.target);
      assert.equal(captured.status, 'ready', scenario.name);
      if (captured.status !== 'ready') continue;
      assert.equal(captured.seal.formType, scenario.name);
      assert.equal(captured.seal.sourceFormat, 'hwp');
      assert.match(captured.seal.propertiesSha256, /^[0-9a-f]{64}$/u);
      const applied = applyFormObjectValueB078(f.document, f.context, captured.seal, scenario.change);
      assert.equal(applied.status, 'applied', scenario.name);
      if (applied.status !== 'applied') continue;
      const afterHwp = f.document.exportHwp(), afterHwpx = f.document.exportHwpx();
      assert.notDeepEqual(afterHwp, beforeHwp); assert.notDeepEqual(afterHwpx, beforeHwpx);
      for (const bytes of [afterHwp, afterHwpx]) {
        const reopened = new HwpDocument(bytes);
        try {
          const actual = parse(reopened.getFormValue(scenario.target.section, scenario.target.paragraph, scenario.target.control));
          assert.equal(actual.ok, true); assert.equal(actual.formType, scenario.name);
          for (const [key, value] of Object.entries(scenario.expected)) assert.equal(actual[key], value);
        } finally { reopened.free(); }
      }
      assert.equal(applied.command.undo().status, 'restored');
      assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
      assert.equal(applied.command.redo().status, 'restored');
      assert.deepEqual(f.document.exportHwp(), afterHwp); assert.deepEqual(f.document.exportHwpx(), afterHwpx);
      applied.command.dispose();
    } finally { f.document.free(); }
  }
});

test('B078 fails closed for stale/tampered CAS inputs without changing document bytes', () => {
  const f = fixture();
  try {
    const target = cases[0]!.target, beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = captureFormObjectValueB078(f.document, f.context, target);
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const tampered = {...captured.seal, name: 'changed'};
    assert.deepEqual(applyFormObjectValueB078(f.document, f.context, tampered, {version: 1, value: 0}),
      {status: 'blocked', reason: 'tampered-seal'});
    f.setInstance('other-instance');
    assert.deepEqual(applyFormObjectValueB078(f.document, f.context, captured.seal, {version: 1, value: 0}),
      {status: 'blocked', reason: 'stale-document'});
    f.setInstance('instance-b078');
    assert.equal(parse(f.document.setFormValue(0, 2, 0, JSON.stringify({value: 0}))).ok, true);
    f.setRevision(captured.seal.revision);
    assert.deepEqual(applyFormObjectValueB078(f.document, f.context, captured.seal, {version: 1, value: 0}),
      {status: 'blocked', reason: 'stale-value'});
    assert.notDeepEqual(f.document.exportHwp(), beforeHwp);
    const clean = new HwpDocument(FORM_HWP);
    try {
      assert.deepEqual(clean.exportHwp(), beforeHwp); assert.deepEqual(clean.exportHwpx(), beforeHwpx);
    } finally { clean.free(); }
  } finally { f.document.free(); }
});

test('B078 blocks form mode, composition, password state, PushButton and invalid schemas before mutation', () => {
  const f = fixture();
  try {
    const target = cases[0]!.target, beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    f.setFormMode(true);
    assert.deepEqual(captureFormObjectValueB078(f.document, f.context, target), {status: 'blocked', reason: 'form-mode'});
    f.setFormMode(false); f.setComposing(true);
    assert.deepEqual(captureFormObjectValueB078(f.document, f.context, target), {status: 'blocked', reason: 'invalid-context'});
    f.setComposing(false); f.setPasswordRequired(true);
    assert.deepEqual(captureFormObjectValueB078(f.document, f.context, target), {status: 'blocked', reason: 'password-protected'});
    f.setPasswordRequired(false);
    assert.deepEqual(captureFormObjectValueB078(f.document, f.context, {section: 0, paragraph: 0, control: 2}),
      {status: 'blocked', reason: 'unsupported-type'});
    assert.deepEqual(captureFormObjectValueB078(f.document, f.context, {...target, extra: true}),
      {status: 'blocked', reason: 'invalid-target'});
    const captured = captureFormObjectValueB078(f.document, f.context, target);
    assert.equal(captured.status, 'ready');
    if (captured.status === 'ready') {
      assert.deepEqual(applyFormObjectValueB078(f.document, f.context, captured.seal, {version: 1, value: 0, extra: true}),
        {status: 'blocked', reason: 'invalid-change'});
    }
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
  } finally { f.document.free(); }
});

test('B078 recognizes disabled, read-only and password Edit metadata from the real form host', () => {
  const f = fixture();
  try {
    const override = (mode: 'disabled' | 'readonly' | 'password'): FormObjectValueHostB078 =>
      new Proxy(f.document as unknown as FormObjectValueHostB078, {
        get(targetHost, property, receiver) {
          if (property === 'getFormObjectInfo') return (...args: [number, number, number]) => {
            const info = parse(targetHost.getFormObjectInfo(...args));
            if (mode === 'disabled') info.enabled = false;
            if (mode === 'readonly') info.properties = {...info.properties as Record<string, string>, ReadOnly: '1'};
            if (mode === 'password') info.properties = {...info.properties as Record<string, string>, PasswordChar: '*'};
            return JSON.stringify(info);
          };
          if (property === 'getFormValue' && mode === 'disabled') return (...args: [number, number, number]) => {
            const value = parse(targetHost.getFormValue(...args)); value.enabled = false; return JSON.stringify(value);
          };
          const value = Reflect.get(targetHost, property, receiver) as unknown;
          return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(targetHost) : value;
        },
      });
    assert.deepEqual(captureFormObjectValueB078(override('disabled'), f.context, cases[0]!.target),
      {status: 'blocked', reason: 'read-only'});
    assert.deepEqual(captureFormObjectValueB078(override('readonly'), f.context, cases[3]!.target),
      {status: 'blocked', reason: 'read-only'});
    assert.deepEqual(captureFormObjectValueB078(override('password'), f.context, cases[3]!.target),
      {status: 'blocked', reason: 'password-form'});
  } finally { f.document.free(); }
});

test('B078 rolls back a rejected or unverifiable mutation to exact HWP/HWPX bytes', () => {
  const f = fixture();
  try {
    const target = cases[0]!.target, beforeHwp = f.document.exportHwp(), beforeHwpx = f.document.exportHwpx();
    const captured = captureFormObjectValueB078(f.document, f.context, target);
    assert.equal(captured.status, 'ready'); if (captured.status !== 'ready') return;
    const host = new Proxy(f.document as unknown as FormObjectValueHostB078, {
      get(targetHost, property, receiver) {
        if (property === 'setFormValue') return () => JSON.stringify({ok: false, error: 'rejected'});
        const value = Reflect.get(targetHost, property, receiver) as unknown;
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(targetHost) : value;
      },
    });
    assert.deepEqual(applyFormObjectValueB078(host, f.context, captured.seal, {version: 1, value: 0}),
      {status: 'blocked', reason: 'mutation-rejected'});
    assert.deepEqual(f.document.exportHwp(), beforeHwp); assert.deepEqual(f.document.exportHwpx(), beforeHwpx);
  } finally { f.document.free(); }
});
