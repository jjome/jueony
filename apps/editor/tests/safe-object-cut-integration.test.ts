import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { applySafeObjectCutPatches } from '../scripts/integration/safe-object-cut-patches.mjs';
const repo = resolve(import.meta.dirname, '../../..');
test('menu and native cut share guarded commit; integration refuses source drift', async () => {
  await mkdir(resolve(repo, 'build'), { recursive: true });
  const root = await mkdtemp(resolve(repo, 'build/safe-object-cut-patch-test-')); await mkdir(join(root, 'src/engine'), { recursive: true });
  for (const file of ['input-handler.ts', 'input-handler-keyboard.ts']) await writeFile(join(root, 'src/engine', file), await readFile(resolve(repo, 'upstream/rhwp-source/rhwp-studio/src/engine', file)));
  await applySafeObjectCutPatches({ root });
  const input = await readFile(join(root, 'src/engine/input-handler.ts'), 'utf8'), keys = await readFile(join(root, 'src/engine/input-handler-keyboard.ts'), 'utf8');
  const cut = input.slice(input.indexOf('  performCut(): void {'), input.indexOf('  /** 선택 영역 삭제'));
  assert.doesNotMatch(cut, /this\.performCopy\(|writeText\(|moveOutOfSelected/); assert.match(cut, /await runGuardedObjectCut/); assert.match(cut, /await _keyboard.writeImageToClipboard/);
  assert.match(keys.slice(keys.indexOf('export function onCut'), keys.indexOf('export function onPaste')), /performObjectCutSafely/);
  await assert.rejects(applySafeObjectCutPatches({ root }), /integration drift/);
});
