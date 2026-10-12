import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Native insertion must pass through the same tracked bridge as manual edits. */
export async function applyDocumentInsertionPatches({ root }) {
  const replace = async (file, before, after) => {
    const path = join(root, 'src', file), source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
    if (source.split(before).length !== 2) throw new Error(`문서 삽입 패치 기준 불일치: ${file}`);
    await writeFile(path, source.replace(before, after));
  };
  await replace('core/wasm-bridge.ts', '  pasteHwpJson(sec: number, para: number, charOffset: number, json: string): string {',
    `  insertDocumentBytes(sec: number, para: number, charOffset: number, bytes: Uint8Array): {ok: boolean; paraIdx: number; charOffset: number} {
    if (!this.doc) throw new Error('문서가 로드되지 않았습니다');
    const fn = (this.doc as any).insertDocumentBytes;
    if (typeof fn !== 'function') throw new Error('현재 엔진은 문서 끼워 넣기를 지원하지 않습니다.');
    return JSON.parse(fn.call(this.doc, sec, para, charOffset, bytes));
  }

  pasteHwpJson(sec: number, para: number, charOffset: number, json: string): string {`);
  await replace('core/mutation-method-registry.ts', "'pasteHtml', 'pasteHtmlInCell', 'pasteHtmlInCellByPath', 'pasteHwpJson',",
    "'pasteHtml', 'pasteHtmlInCell', 'pasteHtmlInCellByPath', 'pasteHwpJson', 'insertDocumentBytes',");
}
