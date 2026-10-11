import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error(`수동 편집 패치 기준 불일치: ${label}`);
  return source.replace(before, after);
}

/** Run after applyStudioPatches, on the generated Studio copy only. */
export async function applyManualFeaturePatches({ root }) {
  const edit = async (file, transform) => {
    const path = join(root, 'src', file);
    const source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
    await writeFile(path, transform(source));
  };
  await edit('command/commands/insert.ts', source => {
    source = "import { applyCaptionSnapshot, isBodyCaptionTarget } from '../../jueony/adapters/rhwp/manual-commands';\n" + source;
    source = replaceOnce(source, "      if (!ref || ref.type === 'equation' || ref.type === 'group') return;", "      if (!isBodyCaptionTarget(ref)) throw new Error('캡션 넣기는 본문의 그림·도형에서 지원합니다.');\n      if (!ref) return;", 'caption target guard');
    return replaceOnce(source,
      "        result = setObjectProps(services.wasm, ref, captionProps);\n        // \"그림 N \" 끝 위치를 Rust가 반환\n        charOffset = result?.captionCharOffset ?? 4;\n        services.eventBus.emit('document-changed');",
      "        const changed = applyCaptionSnapshot(ih, ref, captionProps, (wasm, target, props) => { result = setObjectProps(wasm, target, props); return result; });\n        if (!changed) return;\n        charOffset = result?.captionCharOffset ?? 4;",
      'caption insertion history');
  });
  await edit('command/commands/table.ts', source => {
    // Both dialogs share the implementation; only the initial tab changes with L/C/B/F.
    for (const id of ['table:border-each', 'table:border-one']) {
      const start = source.indexOf("    id: '" + id + "'");
      const end = source.indexOf('\n  },', start);
      if (start < 0 || end < 0) throw new Error('셀 테두리 명령 없음: ' + id);
      let block = source.slice(start, end);
      block = replaceOnce(block, 'execute(services)', 'execute(services, params)', id + ' parameters');
      block = replaceOnce(block, 'dialog.show();', "dialog.show(params?.tab === 'background' ? 'background' : 'border');", id + ' initial tab');
      source = source.slice(0, start) + block + source.slice(end);
    }
    return source;
  });
  await edit('ui/cell-border-bg-dialog.ts', source => replaceOnce(source,
    '  show(): void {\n    super.show();',
    "  show(initialTab: 'border' | 'background' = 'border'): void {\n    super.show();\n    this.switchTab(initialTab === 'background' ? 1 : 0);", 'cell dialog tab'));
}
