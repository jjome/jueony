import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { readAdministrativeAuditProfile } from '../src/adapters/rhwp/administrative-audit.ts';
import { createDocumentFacades } from '../src/modules/document/public/index.ts';
import { auditAdministrativeProfile } from '../src/modules/document/domain/administrative-audit.ts';

const pkg = process.env.JUEONY_ENGINE_PACKAGE ?? fileURLToPath(new URL('../node_modules/@rhwp/core', import.meta.url));
const { default: init, HwpDocument } = await import(pathToFileURL(resolve(pkg, 'rhwp.js')).href);
await init({ module_or_path: await readFile(resolve(pkg, 'rhwp_bg.wasm')) });

for (const format of ['HWP', 'HWPX']) {
  test(`${format}: audit sees a mixed font run and nested table without editing the document`, async () => {
    const save = (doc: any) => format === 'HWP' ? doc.exportHwp() : doc.exportHwpx();
    const source = HwpDocument.createEmpty();
    source.createBlankDocument();
    source.pasteHtml(0, 0, 0, '<p>안녕<span style="font-family: HY신명조">문서</span></p><table><tr><td>바깥<table><tr><td>안쪽</td></tr></table></td></tr></table>');
    const doc = new HwpDocument(save(source));
    source.free();
    const before = save(doc);
    const edit = async (): Promise<never> => { throw new Error('audit must not use edit methods'); };
    const {query} = createDocumentFacades({readSnapshot: edit, preflight: edit, apply: edit, undoRequest: edit,
      readAdministrativeAuditProfile: options => readAdministrativeAuditProfile(doc, options)});
    try {
      const full = await query.auditAdministrativeDocument({ fonts: true, nestedTables: true });
      assert.ok(full.findings.some(f => f.rule === 'fonts' && f.label.includes('HY신명조') && f.address.offset === 2), JSON.stringify(full));
      assert.ok(full.findings.some(f => f.rule === 'nestedTables' && f.address.path?.length === 1), JSON.stringify(full));
      const tables = await query.auditAdministrativeDocument({ fonts: false, nestedTables: true });
      assert.ok(tables.count > 0 && tables.findings.every(f => f.rule === 'nestedTables'));
      assert.deepEqual(save(doc), before);
    } finally { doc.free(); }
  });
}

test('optional guidance detects merged body rows and single-cell text without writing a file',()=>{
  const source=HwpDocument.createEmpty();
  try{
    source.createBlankDocument();
    source.pasteHtml(0,0,0,'<table><tr><td>항목</td><td>구분</td></tr><tr><td rowspan="2">본문 병합</td><td>분류</td></tr><tr><td>목록</td></tr></table><p>본문</p><table><tr><td>제목 상자</td></tr></table>');
    const before=source.exportHwpx();
    const options={fonts:false,nestedTables:false,mergedTables:true,singleCellTables:true};
    const observed=readAdministrativeAuditProfile(source,options);
    const report=auditAdministrativeProfile(observed,options);
    assert.ok(report.findings.some(item=>item.rule==='mergedTables'&&item.label.includes('세로 병합')),JSON.stringify(report));
    assert.ok(report.findings.some(item=>item.rule==='singleCellTables'),JSON.stringify(report));
    assert.deepEqual(source.exportHwpx(),before);
  }finally{source.free();}
});
