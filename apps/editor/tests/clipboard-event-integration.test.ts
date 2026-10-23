import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { applyClipboardEventPatches } from '../scripts/integration/clipboard-event-patches.mjs';
const repo = resolve(import.meta.dirname, '../../..');
test('destructive native text cut requires rich clipboard acceptance and refuses patch drift', async () => {
  await mkdir(resolve(repo, 'build'), { recursive: true }); const root = await mkdtemp(resolve(repo, 'build/clipboard-event-patch-test-')); await mkdir(join(root, 'src/engine'), { recursive: true });
  const file = join(root, 'src/engine/input-handler-keyboard.ts'); await writeFile(file, await readFile(resolve(repo, 'upstream/rhwp-source/rhwp-studio/src/engine/input-handler-keyboard.ts'))); await applyClipboardEventPatches({ root });
  const source = await readFile(file, 'utf8'), cut = source.slice(source.indexOf('export function onCut'), source.indexOf('export function onPaste'));
  assert.match(cut, /if \(copyRichSelectionForCut\.call\(this, e\)\) this\.deleteSelection\(\)/);
  assert.match(source, /writeCutClipboardEvent\(e.clipboardData, text, marked\)/); assert.match(source, /validateClipboardSelection\(start, end\)/);
  assert.doesNotMatch(cut, /if \(copyHeaderFooterSelection\.call/); assert.match(cut, /머리말·꼬리말의 서식 보존 잘라내기는 지원하지/);
  await assert.rejects(applyClipboardEventPatches({ root }), /integration drift/);
});
