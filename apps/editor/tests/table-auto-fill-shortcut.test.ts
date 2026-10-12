import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { applyTableConversionPatches } from '../scripts/integration/table-conversion-patches.mjs';
test('generated Hangul A binding invokes integer autofill only with cell-block selection', async () => {
  const tempBase = resolve(tmpdir()), root = await mkdtemp(join(tempBase, 'jueony-fill-shortcut-'));
  assert.ok(resolve(root).startsWith(tempBase + '\\') || resolve(root).startsWith(tempBase + '/'));
  try {
    const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), generated = join(root, 'src/jueony/shortcuts'); await mkdir(generated, { recursive: true });
    await writeFile(join(generated, 'install.ts'), '  installDocumentInsertion(registry, input, eventBus);\n');
    await writeFile(join(generated, 'keymap.ts'), await readFile(join(app, 'src/shortcuts/keymap.ts'), 'utf8'));
    await writeFile(join(generated, 'style-slots.ts'), await readFile(join(app, 'src/shortcuts/style-slots.ts'), 'utf8'));
    await applyTableConversionPatches({ root });
    const { HangulKeyResolver, hangulBindings } = await import(pathToFileURL(join(generated, 'keymap.ts')).href);
    assert.equal(hangulBindings.filter((b: any) => b.keys === 'A').length, 1);
    const key = { key: 'a', code: 'KeyA', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false, isComposing: false };
    const resolveKey = (cells: boolean, table = false) => new HangulKeyResolver().resolve(key, { cells, table, object: false });
    assert.equal(resolveKey(true, true).binding.command, 'table:auto-fill-integers');
    assert.equal(resolveKey(false).handled, false, 'ordinary body typing must remain untouched');
    assert.equal(resolveKey(false, true).handled, false, 'ordinary cell text typing must remain untouched');
    assert.equal(new HangulKeyResolver().resolve({ ...key, isComposing: true }, { cells: true, table: true, object: false }).handled, false);
  } finally { assert.ok(resolve(root).startsWith(tempBase + '\\') || resolve(root).startsWith(tempBase + '/')); await rm(root, { recursive: true, force: true }); }
});
