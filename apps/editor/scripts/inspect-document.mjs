// 파일의 실제 본문을 읽는 진단이다. 한컴 렌더링·레이아웃 정합성을 판정하지 않는다.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import init, { HwpDocument } from '@rhwp/core';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await init({ module_or_path: await readFile(resolve(app, 'node_modules/@rhwp/core/rhwp_bg.wasm')) });
const reports = [];
for (const path of process.argv.slice(2)) {
  const bytes = await readFile(path);
  const doc = new HwpDocument(bytes);
  try {
    const sections = [];
    for (let section = 0; section < doc.getSectionCount(); section++) {
      const paragraphs = [];
      for (let paragraph = 0; paragraph < doc.getParagraphCount(section); paragraph++) {
        const length = doc.getParagraphLength(section, paragraph);
        paragraphs.push(doc.getTextRange(section, paragraph, 0, length));
      }
      sections.push(paragraphs);
    }
    reports.push({ file: path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), sections });
  } finally { doc.free(); }
}
console.log(JSON.stringify(reports, null, 2));
await writeFile(resolve(app, 'evidence/document-content.json'), JSON.stringify(reports, null, 2));
