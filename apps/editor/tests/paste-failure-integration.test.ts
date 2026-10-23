import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { applyPasteFailurePatches } from '../scripts/integration/paste-failure-patches.mjs';
const repo = resolve(import.meta.dirname, '../../..');
test('rich paste failure throws inside its snapshot and restores JS selection without silent plain fallback', async () => {
  await mkdir(resolve(repo, 'build'), { recursive: true }); const root = await mkdtemp(resolve(repo, 'build/paste-failure-patch-test-')); await mkdir(join(root, 'src/engine'), { recursive: true });
  for (const name of ['input-handler.ts', 'input-handler-keyboard.ts']) await writeFile(join(root, 'src/engine', name), await readFile(resolve(repo, 'upstream/rhwp-source/rhwp-studio/src/engine', name)));
  await applyPasteFailurePatches({ root });
  const keyboard = await readFile(join(root, 'src/engine/input-handler-keyboard.ts'), 'utf8'), handler = await readFile(join(root, 'src/engine/input-handler.ts'), 'utf8');
  const body = keyboard.slice(keyboard.indexOf('function pasteExternalHtml('), keyboard.indexOf('/** 클립보드의 이미지 파일'));
  assert.match(body, /if \(parsed.ok !== true\) throw new Error/); assert.match(body, /selectionBefore.anchor/); assert.doesNotMatch(body, /pastePlainText.call/); assert.match(body, /revision\(\) === revisionBefore/); assert.match(handler, /메뉴 붙이기를 허용하지 않았습니다/);
  await assert.rejects(applyPasteFailurePatches({ root }), /integration drift/);
});
