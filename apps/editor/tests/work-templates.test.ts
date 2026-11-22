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
test('template variables fill a new document, reject incomplete inputs and preserve the built-in source',async()=>{
  await init({module_or_path:await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url))});
  const template=readWorkTemplate('work-plan');
  const values={'업무명':'현장 점검','시작일':'2026-11-23','종료일':'2026-11-25','일정':'수요일'};
  const doc=HwpDocument.createEmpty();doc.createBlankDocument();
  try{
    assert.throws(()=>applyWorkTemplate(doc,'work-plan',{'업무명':'현장 점검'}),/필수 입력/);
    assert.equal(canApplyWorkTemplate(doc),true);
    applyWorkTemplate(doc,'work-plan',values);
    const copies=[doc.exportHwp(),doc.exportHwpx()];
    for(const bytes of copies){
      const opened=new HwpDocument(bytes);
      try{
        const body=JSON.parse(opened.getTextFileUnicode());
        assert.match(body,/현장 점검 추진 계획/);
        assert.match(body,/2026-11-23 ~ 2026-11-25/);
        assert.equal(body.match(/수요일/g)?.length,3);
      }finally{opened.free();}
    }
    assert.deepEqual(readWorkTemplate('work-plan'),template);
  }finally{doc.free();}
});
