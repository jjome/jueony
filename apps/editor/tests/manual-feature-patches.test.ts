import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyManualFeaturePatches } from '../scripts/integration/manual-feature-patches.mjs';

test('manual feature patches match pinned Studio; caption mutation uses history and cell background can open directly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jueony-manual-patch-'));
  // Tests live in apps/editor/tests, so the repository is three levels above.
  const repositorySource = fileURLToPath(new URL('../../../', import.meta.url));
  const pinnedSource = join(repositorySource, 'upstream/rhwp-source/rhwp-studio/src');
  try {
    await mkdir(join(root, 'src/command/commands'), { recursive: true });
    await mkdir(join(root, 'src/ui'), { recursive: true });
    for (const file of ['command/commands/insert.ts', 'command/commands/table.ts', 'ui/cell-border-bg-dialog.ts', 'ui/table-cell-props-dialog.ts', 'ui/page-border-dialog.ts']) {
      await copyFile(join(pinnedSource, file), join(root, 'src', file));
    }
    const before = await readFile(join(root, 'src/command/commands/insert.ts'), 'utf8');
    assert.match(before, /result = setObjectProps\(services.wasm, ref, captionProps\)/);
    await applyManualFeaturePatches({ root });
    const insert = await readFile(join(root, 'src/command/commands/insert.ts'), 'utf8');
    assert.match(insert, /const changed = applyCaptionSnapshot\(ih, ref, captionProps/);
    assert.doesNotMatch(insert, /result = setObjectProps\(services.wasm, ref, captionProps\)/);
    const table = await readFile(join(root, 'src/command/commands/table.ts'), 'utf8');
    assert.equal(table.split("dialog.show(params?.tab === 'background' ? 'background' : 'border');").length - 1, 2);
    const dialog = await readFile(join(root, 'src/ui/cell-border-bg-dialog.ts'), 'utf8');
    assert.match(dialog, /this.switchTab\(initialTab === 'background' \? 1 : 0\)/);
    // Reapplying against drifted or already patched code must fail, not silently skip.
    await assert.rejects(() => applyManualFeaturePatches({ root }), /패치 기준 불일치/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
