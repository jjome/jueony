import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditModuleSources, auditRepository } from '../../../scripts/check-module-boundaries.mjs';

const publicA = 'apps/editor/src/modules/a/public/index.ts';
const publicB = 'apps/editor/src/modules/b/public/index.ts';
const privateB = 'apps/editor/src/modules/b/domain/secret.ts';
const codes = (sources: Record<string, string>, options = {}) => auditModuleSources(sources, options).diagnostics.map((issue: { code: string }) => issue.code);

test('public type contracts are allowed and type-only cycles are rejected', () => {
  assert.deepEqual(codes({ [publicA]: "import type {B} from '../../b/public/index.ts'; export type A={b:B}", [publicB]: 'export type B={text:string}' }), []);
  assert.ok(codes({ [publicA]: "import type {B} from '../../b/public/index.ts'; export type A={b:B}", [publicB]: "import type {A} from '../../a/public/index.ts'; export type B={a:A}" }).includes('module-cycle'));
});

test('static, type-expression, and dynamic private imports cannot bypass facade boundary', () => {
  for (const statement of [
    "import type {Secret} from '../../b/domain/secret.ts';",
    "export type {Secret} from '../../b/domain/secret.ts';",
    "export type Value=import('../../b/domain/secret.ts').Secret;",
    "export const value=()=>import('../../b/domain/secret.ts');",
  ]) assert.ok(codes({ [publicA]: statement, [privateB]: 'export type Secret=string;' }).includes('private-import'), statement);
  assert.ok(codes({ [publicA]: 'export const value=(name:string)=>import(name);' }).includes('dynamic-import'));
});

test('native access, public any and missing module references fail while data named document is valid', () => {
  assert.deepEqual(codes({ [publicA]: 'export function value(document:{text:string}) { return document.text; }' }), []);
  const found = codes({ [publicA]: "import type {Missing} from '../../b/public/absent.ts'; export type Native=FileSystemFileHandle; export type Leak=any; export const data=()=>globalThis.fetch('/');" });
  for (const code of ['missing-target', 'public-native-type', 'public-any', 'core-global']) assert.ok(found.includes(code), code);
  assert.ok(codes({ [publicA]: "import {readFile} from 'node:fs';" }).includes('core-external'));
  assert.ok(codes({ [publicA]: "import {state} from '../../../mvp/model.ts';" }).includes('core-external'));
});

test('legacy exceptions are exact, documented, consumed, and cannot authorize core imports', () => {
  const legacy = 'apps/editor/src/mvp/legacy.ts';
  const sources = { [legacy]: "export type {Secret} from '../modules/b/domain/secret.ts';", [privateB]: 'export type Secret=string;' };
  const entry = { from: legacy, to: privateB, owner: 'integration', reason: 'Compatibility shim pending migration', removal: 'R13' };
  assert.deepEqual(codes(sources, { allowlist: [entry] }), []);
  assert.ok(codes(sources, { allowlist: [{ ...entry, from: 'apps/editor/src/mvp/*' }] }).includes('invalid-allowlist'));
  assert.ok(codes({ [privateB]: 'export type Secret=string;' }, { allowlist: [entry] }).includes('stale-allowlist'));
  assert.ok(codes({ [publicA]: "import type {Secret} from '../../b/domain/secret.ts';", [privateB]: sources[privateB] }, { allowlist: [{ ...entry, from: publicA }] }).includes('invalid-allowlist'));
});

test('domain cannot import its application orchestration', () => {
  assert.ok(codes({ 'apps/editor/src/modules/a/domain/rule.ts': "import {run} from '../application/run.ts';", 'apps/editor/src/modules/a/application/run.ts': 'export const run=()=>{};' }).includes('layer-direction'));
});

test('repository module contracts satisfy the same rules as negative fixtures', async () => {
  const report = await auditRepository();
  assert.equal(report.moduleCount, 10);
  assert.equal(report.ok, true, JSON.stringify(report.diagnostics, null, 2));
});
