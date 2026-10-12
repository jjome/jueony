import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
/** Generated Studio copy only. Keep selected-object UI ownership in its adapter. */
export async function applySelectedObjectPropertiesPatches({ root }) {
  const edit = async (file, before, after) => { const path = join(root, 'src/jueony', file), source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n'); if (source.split(before).length !== 2) throw new Error('선택 개체 고치기 패치 기준 불일치: ' + file); await writeFile(path, source.replace(before, after)); };
  const path = join(root, 'src/jueony/shortcuts/install.ts'); let source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
  source = `import { installSelectedObjectProperties } from '../adapters/rhwp/selected-object-properties.ts';
import { PicturePropsDialog } from '../../ui/picture-props-dialog';
import { EquationPropertiesDialog } from '../../ui/equation-props-dialog';
import { TableCellPropsDialog } from '../../ui/table-cell-props-dialog';
` + source;
  const anchor = '  installDocumentInsertion(registry, input, eventBus);'; if (source.split(anchor).length !== 2) throw new Error('선택 개체 고치기 설치 위치 없음');
  source = source.replace(anchor, anchor + `
  installSelectedObjectProperties({ registry, input,
    openTable: (services: any, ref: any, guard: any) => {
      const dialog = new TableCellPropsDialog(services.wasm, services.eventBus, { sec: ref.sec, ppi: ref.ppi, ci: ref.ci }, 0, 'table', services);
      guard(dialog, 'onConfirm'); dialog.show();
    },
    openPicture: (services: any, ref: any, guard: any) => {
      const dialog = new PicturePropsDialog(services.wasm, services.eventBus, services);
      guard(dialog, 'handleOk'); dialog.open(ref.sec, ref.ppi, ref.ci, ref.type, ref.headerFooter, ref.cellPath, ref.cellPath ? ref.ci : undefined);
    },
    openEquation: (services: any, ref: any, guard: any) => {
      const dialog = new EquationPropertiesDialog(services.wasm, services.eventBus, services);
      guard(dialog, 'handleOk'); dialog.open(ref.sec, ref.ppi, ref.ci, ref.cellIdx, ref.cellParaIdx, ref.noteRef);
    },
  });`);
  await writeFile(path, source);
  await edit('shortcuts/keymap.ts', "  binding('P', 'format:object-properties', '개체 속성', 'object'),", "  binding('Ctrl+N,K', 'format:object-properties', '선택 개체 고치기'),\n  binding('P', 'format:object-properties', '개체 속성', 'object'),");
}
