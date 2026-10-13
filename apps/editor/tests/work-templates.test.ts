import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '../node_modules/@rhwp/core/rhwp.js';
import { readWorkTemplate, workTemplates } from '../src/modules/document/public/work-templates.ts';
import { applyWorkTemplate, canApplyWorkTemplate } from '../src/adapters/rhwp/work-templates-native.ts';
test('every original work template saves and reopens with styled titles and expected table cells', async () => {
  await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  for (const template of workTemplates) {
    const doc: any = HwpDocument.createEmpty(); doc.createBlankDocument();
    try {
      assert.equal(canApplyWorkTemplate(doc), true); applyWorkTemplate(doc, template.id); assert.equal(canApplyWorkTemplate(doc), false); assert.throws(() => applyWorkTemplate(doc, template.id), /빈 문서/);
      for (const method of ['exportHwp', 'exportHwpx']) { const reopened: any = new HwpDocument(doc[method]()); try {
        assert.equal(reopened.getTextRange(0, 0, 0, reopened.getParagraphLength(0, 0)), template.paragraphs[0].text); assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 0)).bold, true); assert.equal(JSON.parse(reopened.getCharPropertiesAt(0, 0, 0)).fontSize, 1800);
        const text = JSON.parse(reopened.getTextFileUnicode()); for (const paragraph of template.paragraphs.filter(p => p.text)) assert.ok(text.includes(paragraph.text)); if (template.table) for (const value of template.table.flat()) assert.ok(text.includes(value));
      } finally { reopened.free(); } }
    } finally { doc.free(); }
  }
});
test('template catalog returns detached definitions and rejects unknown templates', () => { const value = readWorkTemplate('work-plan'); value.paragraphs[0].text = 'changed'; assert.notEqual(readWorkTemplate('work-plan').paragraphs[0].text, 'changed'); assert.throws(() => readWorkTemplate('unknown')); });
