import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { parseStylePackage } from '../src/modules/document/public/style-package.ts';
import { exportStylePackage, importStylePackage, importStyleNames } from '../src/adapters/rhwp/style-package-native.ts';
test('portable style import preserves language fonts, mixed definitions, next-style cycles and existing document across native formats', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const source: any = HwpDocument.createEmpty(); source.createBlankDocument(); const target: any = HwpDocument.createEmpty(); target.createBlankDocument();
  try {
    const title = source.createStyle(JSON.stringify({ name: '업무 제목', englishName: 'WorkTitle', type: 0, nextStyleId: 0 })), body = source.createStyle(JSON.stringify({ name: '업무 본문', englishName: 'WorkBody', type: 0, nextStyleId: title }));
    source.updateStyle(title, JSON.stringify({ nextStyleId: body })); source.updateStyleShapes(title, JSON.stringify({ bold: true, fontSize: 1600, textColor: '#112233' }), JSON.stringify({ marginLeft: 600, spacingAfter: 450, lineSpacing: 180 }));
    source.updateStyleShapes(body, '{}', JSON.stringify({ alignment: 'left', keepWithNext: true }));
    const value = exportStylePackage(source, [title]), file = JSON.stringify(value); assert.equal(value.styles.length, 2); assert.deepEqual(parseStylePackage(file), value);
    target.insertText(0, 0, 0, '기존 본문😀'); const oldStyles = target.getStyleList();
    const ids = importStylePackage(target, value); assert.equal(target.getTextRange(0, 0, 0, 7), '기존 본문😀'); assert.equal(target.getStyleList().startsWith('['), true);
    assert.deepEqual(JSON.parse(target.getStyleList()).slice(0, JSON.parse(oldStyles).length), JSON.parse(oldStyles));
    for (const method of ['exportHwp', 'exportHwpx']) {
      const reopened: any = new HwpDocument(target[method]());
      try { const styles = JSON.parse(reopened.getStyleList()), detail = JSON.parse(reopened.getStyleDetail(ids[0])); assert.equal(styles[ids[0]].nextStyleId, ids[1]); assert.equal(styles[ids[1]].nextStyleId, ids[0]); assert.equal(detail.charProps.fontSize, 1600); assert.equal(detail.charProps.bold, true); assert.equal(detail.paraProps.marginLeft, 4); assert.equal(detail.paraProps.spacingAfter, 6); assert.equal(detail.paraProps.lineSpacing, 180); assert.equal(reopened.getTextRange(0, 0, 0, 7), '기존 본문😀'); } finally { reopened.free(); }
    }
    const names = importStyleNames(target, value); assert.match(names[0].name, /가져옴/); assert.match(names[0].englishName, /가져옴/);
  } finally { source.free(); target.free(); }
});
test('advanced styles are refused explicitly and malformed portable shapes never mutate document', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  const source: any = HwpDocument.createEmpty(); source.createBlankDocument();
  try {
    const value = exportStylePackage(source, [0]); assert.throws(() => parseStylePackage(JSON.stringify({ ...value, version: 2 }))); assert.throws(() => parseStylePackage('broken'));
    const malformed = structuredClone(value); malformed.styles[0].char.fontSize = -1; const before = source.exportHwpx(); assert.throws(() => importStylePackage(source, malformed)); assert.deepEqual(source.exportHwpx(), before);
    const extended = structuredClone(value); extended.styles[0].para.numberingId = 42; assert.throws(() => importStylePackage(source, extended), /지원하지 않는/); assert.deepEqual(source.exportHwpx(), before);
    source.updateStyleShapes(0, '{}', JSON.stringify({ headType: 'Outline' })); assert.throws(() => exportStylePackage(source, [0]), /번호·개요/);
  } finally { source.free(); }
});
