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
