import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { applyTabFeaturePatches } from '../scripts/integration/tab-feature-patches.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'jueony-tabs-patch-'));
  const pinned = fileURLToPath(new URL('../../../upstream/rhwp-source/rhwp-studio/src/', import.meta.url));
  for (const file of ['ui/para-shape-tab-builders.ts', 'ui/para-shape-dialog.ts', 'ui/section-settings-dialog.ts', 'command/commands/format.ts', 'core/wasm-bridge.ts']) {
    await mkdir(join(root, 'src', file, '..'), { recursive: true });
    await copyFile(join(pinned, file), join(root, 'src', file));
  }
  await applyTabFeaturePatches({ root });
  return root;
}

test('tab UI patch applies once to pinned Studio and rejects drift', async () => {
  const root = await fixture();
  try {
    const tabs = await readFile(join(root, 'src/ui/para-shape-tab-builders.ts'), 'utf8');
    assert.match(tabs, /changeBtn.disabled = false/);
    assert.match(tabs, /Math.round\(positionPt \* 200\)/);
    assert.equal(tabs.split('t.position / 200').length - 1, 2);
    const section = await readFile(join(root, 'src/ui/section-settings-dialog.ts'), 'utf8');
    assert.match(section, /operationType: 'setSectionTabSpacing'/);
    assert.match(section, /\(\(sd.defaultTabSpacing \|\| 8000\) \/ 200\)/);
    await assert.rejects(() => applyTabFeaturePatches({ root }), /패치 기준 불일치/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('default-tab dialog applies only tab distance, preserves distinct section settings and rejects stale/invalid input', async () => {
  const root = await fixture();
  const oldDocument = globalThis.document;
  class Element {
    children: any[] = []; dataset: Record<string, string> = {}; value = ''; textContent = ''; className = '';
    append(...children: any[]) { this.children.push(...children); }
    setAttribute() {}
  }
  globalThis.document = { createElement: () => new Element() } as any;
  try {
    let source = await readFile(join(root, 'src/ui/default-tab-spacing-dialog.ts'), 'utf8');
    source = source.replace("import { ModalDialog } from './dialog';", 'class ModalDialog { constructor(...args: any[]) {} }');
    const output = stripTypeScriptTypes(source, { mode: 'transform' });
    const { DefaultTabSpacingDialog } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
    const sections = [{ defaultTabSpacing: 0, pageNum: 7, hideHeader: true }, { defaultTabSpacing: 12000, pageNum: 12, hideHeader: false }];
    let history = 0;
    const services = {
      wasm: {
        getSectionCount: () => sections.length,
        getSectionDef: (idx: number) => ({ ...sections[idx] }),
        setSectionDef: (idx: number, props: any) => Object.assign(sections[idx], props),
        setSectionDefAll: (props: any) => sections.forEach(section => Object.assign(section, props)),
      },
      getInputHandler: () => ({ getCursorPosition: () => ({ section: 0, para: 0, offset: 0 }), executeOperation: (operation: any) => { history++; operation.operation(); } }),
    };
    let applied = 0;
    const dialog = new DefaultTabSpacingDialog(services, 0, (raw: number) => { applied = raw; });
    dialog.createBody();
    assert.equal(dialog.spacing.value, '40.0'); // Hancom 2024 Normal.hwtx: tabStop=8000, tabStopVal=4000.
    dialog.spacing.value = '20'; dialog.scope.value = 'all';
    assert.equal(dialog.onConfirm(), true);
    assert.equal(history, 1); assert.equal(applied, 4000);
    assert.deepEqual(sections, [{ defaultTabSpacing: 4000, pageNum: 7, hideHeader: true }, { defaultTabSpacing: 4000, pageNum: 12, hideHeader: false }]);
    const stale = new DefaultTabSpacingDialog(services, 0, () => {}); stale.createBody();
    sections[1].defaultTabSpacing = 6000;
    stale.spacing.value = '60'; stale.scope.value = 'all';
    assert.equal(stale.onConfirm(), false); assert.equal(history, 1);
    const invalid = new DefaultTabSpacingDialog(services, 0, () => {}); invalid.createBody();
    invalid.spacing.value = '0'; assert.equal(invalid.onConfirm(), false); assert.equal(history, 1);
    const noOp = new DefaultTabSpacingDialog(services, 0, () => {}); noOp.createBody();
    noOp.spacing.value = '20'; noOp.scope.value = 'current';
    assert.equal(noOp.onConfirm(), true); assert.equal(history, 1);
  } finally { globalThis.document = oldDocument; await rm(root, { recursive: true, force: true }); }
});
