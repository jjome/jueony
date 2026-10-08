import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import init, { HwpDocument } from '@rhwp/core';

await init({ module_or_path: await readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
function textOf(document: HwpDocument) {
  return Array.from({ length: document.getSectionCount() }, (_, section) =>
    Array.from({ length: document.getParagraphCount(section) }, (_, paragraph) =>
      document.getTextRange(section, paragraph, 0, document.getParagraphLength(section, paragraph))));
}
const expected = [[
  '공무원 문서 편집기 검증',
  '한글 2024 기준으로 문서를 작성합니다.',
  '참석 대상자는 10월 15일까지 신청서를 제출해 주시기 바랍니다.',
]];
for (const extension of ['hwp', 'hwpx']) {
  test(`${extension}: UI 저장물의 문단 경계와 텍스트, 두 형식으로 재저장한 본문을 보존한다`, async () => {
    const doc = new HwpDocument(await readFile(new URL(`../fixtures/three-paragraphs.${extension}`, import.meta.url)));
    try {
      assert.deepEqual(textOf(doc), expected);
      for (const bytes of [doc.exportHwp(), doc.exportHwpx()]) {
        const reopened = new HwpDocument(bytes);
        try { assert.deepEqual(textOf(reopened), expected); } finally { reopened.free(); }
      }
    } finally { doc.free(); }
  });
}
test('저장하고 탭 닫기에서 생성한 HWP가 본문을 포함한다', async () => {
  const doc = new HwpDocument(await readFile(new URL('../fixtures/save-and-close.hwp', import.meta.url)));
  try { assert.deepEqual(textOf(doc), [['저장 후 탭 닫기 검증']]); } finally { doc.free(); }
});

for (const extension of ['hwp', 'hwpx']) {
  test(`${extension}: UI에서 만든 3×3 표와 9개 셀 내용을 재저장 후에도 보존한다`, async () => {
    const original = await readFile(new URL(`../fixtures/schedule-table.${extension}`, import.meta.url));
    const doc = new HwpDocument(original);
    try {
      for (const bytes of [original, doc.exportHwp(), doc.exportHwpx()]) {
        const reopened = new HwpDocument(bytes);
        try {
          assert.deepEqual(JSON.parse(reopened.getTableDimensions(0, 1, 0)), { rowCount: 3, colCount: 3, cellCount: 9 });
          const expected = ['구분', '담당', '기한', '계획 수립', '총무팀', '10월 15일', '자료 검토', '담당 부서', '10월 20일'];
          for (let cell = 0; cell < expected.length; cell++) {
            assert.equal(reopened.getCellParagraphCount(0, 1, 0, cell), 1);
            assert.equal(reopened.getTextInCell(0, 1, 0, cell, 0, 0, reopened.getCellParagraphLength(0, 1, 0, cell, 0)), expected[cell]);
          }
        } finally { reopened.free(); }
      }
    } finally { doc.free(); }
  });
}
