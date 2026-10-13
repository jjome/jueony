import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const replace = (source, before, after, name) => { if (source.split(before).length !== 2) throw new Error('문서 전환 상태 패치 기준 불일치: ' + name); return source.replace(before, after); };
export async function applyDocumentSwapStatePatches({ root }) {
  const path = join(root, 'src/engine/cursor.ts'); let source = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
  source = replace(source, '  constructor(private wasm: WasmBridge) {}', `  constructor(private wasm: WasmBridge) {}
  /** Drop old-document runtime addresses without querying the newly swapped layout. */
  resetForDocumentSwap(): void {
    this.clearSelection(); this.exitCellSelectionMode(); this.exitTableObjectSelection(); this.exitPictureObjectSelection();
    this._headerFooterMode = 'none'; this._footnoteMode = false; this._savedBodyPosition = null;
    this._blockSelectionMode = false; this._expandPhase = 0;
    this.position = { sectionIndex: 0, paragraphIndex: 0, charOffset: 0 };
    this.preferredX = null; this.atLineEnd = false; this.preparedFocusedGeometry = null;
    this.focusedGeometryValid = false; this.focusedGeometryRevision = null;
  }`, 'cursor reset'); await writeFile(path, source);
  const handlerPath = join(root, 'src/engine/input-handler.ts'); let handler = (await readFile(handlerPath, 'utf8')).replace(/\r\n/g, '\n');
  handler = replace(handler, '    this.cursor.clearSelection();\n    this.selectionRenderer.clear();\n    this.history.clear(this.wasm);', `    this.cursor.resetForDocumentSwap();
    this.selectionRenderer.clear(); this.cellSelectionRenderer?.clear(); this.tableObjectRenderer?.clear(); this.pictureObjectRenderer?.clear(); this.contextMenu?.hide();
    this.eventBus.emit('table-object-selection-changed', false); this.eventBus.emit('picture-object-selection-changed', false);
    this.history.clear(this.wasm);`, 'document deactivation'); await writeFile(handlerPath, handler);
}
