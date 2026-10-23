import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { applyBasicFindPatches } from '../scripts/integration/basic-find-patches.mjs';
const repo = resolve(import.meta.dirname, '../../..');
test('generated Studio find and repeat-find use the shared path-aware contract and patch drift fails closed', async () => {
  await mkdir(resolve(repo, 'build'), { recursive: true });
  const root = await mkdtemp(resolve(repo, 'build/basic-find-patch-test-'));
  await mkdir(join(root, 'src/ui'), { recursive: true }); await mkdir(join(root, 'src/command/commands'), { recursive: true });
  for (const file of ['ui/find-dialog.ts', 'command/commands/edit.ts']) await writeFile(join(root, 'src', file), await readFile(resolve(repo, 'upstream/rhwp-source/rhwp-studio/src', file)));
  await applyBasicFindPatches({ root });
  const dialog = await readFile(join(root, 'src/ui/find-dialog.ts'), 'utf8'), commands = await readFile(join(root, 'src/command/commands/edit.ts'), 'utf8');
  assert.match(dialog, /isInDialog && this\.isFindEnter/); assert.match(dialog, /document-swapped.*this\.hide/); assert.match(dialog, /replaceAllFindHits/); assert.match(dialog, /replaceComposing/);
  assert.doesNotMatch(dialog, /wasm\.replaceAll\(/); assert.doesNotMatch(dialog, /wasm\.searchText\(/);
  assert.match(commands, /findFromInput\(ih, FindDialog\.lastQuery/);
  await assert.rejects(applyBasicFindPatches({ root }), /integration drift|method boundary/);
});
