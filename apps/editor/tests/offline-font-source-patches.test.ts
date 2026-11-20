import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyOfflineFontSourcePatches, disableGeneratedExternalFontSources } from '../scripts/integration/offline-font-source-patches.mjs';

test('offline font source sanitizer removes only HTTPS font URLs deterministically', () => {
  const source = 'const x=["https://cdn.example.invalid/A.woff2","https://cdn.example.invalid/A.woff2","https://cdn.example.invalid/B.ttf?x=1"];';
  const result = disableGeneratedExternalFontSources(source);
  assert.equal(result.literalCount, 3);
  assert.equal(result.uniqueSourceCount, 2);
  assert.doesNotMatch(result.source, /https?:\/\//u);
  assert.match(result.source, /fonts\/__external-disabled__\/[a-f0-9]{24}\.woff2/u);
  assert.equal(disableGeneratedExternalFontSources(source).outputSha256, result.outputSha256);
  for (const invalid of [
    'const x="http://cdn.example.invalid/A.woff2";',
    'const x="https://cdn.example.invalid/script.js";',
    'const x="wss://cdn.example.invalid/A.woff2";',
  ]) assert.throws(() => disableGeneratedExternalFontSources(invalid), /non-font network literal rejected/u);
});

test('offline font source patch matches the pinned generated rule inventory and writes evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jueony-offline-font-'));
  const sourceRoot = new URL('../../../upstream/rhwp-source/rhwp-studio/src/core/generated/font-rule-projections/', import.meta.url);
  try {
    const target = join(root, 'src/core/generated/font-rule-projections');
    await mkdir(target, { recursive: true });
    await mkdir(join(root, 'public'), { recursive: true });
    for (const name of ['webfont-supply.ts', 'canvaskit-sfnt.ts']) {
      await writeFile(join(target, name), await readFile(new URL(name, sourceRoot)));
    }
    const evidence = await applyOfflineFontSourcePatches({ root });
    assert.equal(evidence.literalCount, 256);
    assert.equal(evidence.files.length, 2);
    for (const item of evidence.files) {
      assert.ok(item.literalCount > 0);
      assert.doesNotMatch(await readFile(join(root, ...item.path.split('/')), 'utf8'), /https?:\/\//u);
    }
    assert.deepEqual(JSON.parse(await readFile(join(root, 'public/offline-font-evidence.json'), 'utf8')), evidence);
  } finally { await rm(root, { recursive: true, force: true }); }
});
