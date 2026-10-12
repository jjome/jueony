import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
/** Install on the generated Jueony copy after its adapters have been copied. */
export async function applyTableConversionPatches({ root }) {
  const path = join(root, 'src/jueony/shortcuts/install.ts');
  let source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
  const anchor = '  installDocumentInsertion(registry, input, eventBus);';
  if (source.split(anchor).length !== 2) throw new Error('표 문자열 변환 패치 기준 불일치');
  source = "import { installTableConversion } from '../adapters/rhwp/table-conversion.ts';\nimport { installTableAutoFill } from '../adapters/rhwp/table-auto-fill.ts';\n" + source.replace(anchor, anchor + '\n  installTableConversion(registry, input, eventBus);\n  installTableAutoFill(registry, input, eventBus);');
  await writeFile(path, source);
  const keyPath = join(root, 'src/jueony/shortcuts/keymap.ts');
  const keySource = (await readFile(keyPath, 'utf8')).replace(/\r\n/g, '\n');
  const keyAnchor = "  binding('H', 'table:cell-height-equal', '셀 높이를 같게', 'cells'),";
  if (keySource.split(keyAnchor).length !== 2) throw new Error('표 자동 채우기 단축키 패치 기준 불일치');
  await writeFile(keyPath, keySource.replace(keyAnchor, "  binding('A', 'table:auto-fill-integers', '자동 채우기 (정수 수열)', 'cells'),\n" + keyAnchor));
}
