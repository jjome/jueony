import { verifyPreservedExport } from './preservation.ts';

/** Probe the saved/reopened copy, then check the resulting save before touching the live document. */
export function preflightDocumentEdit(wasm: any, edit: (scratch: any) => void): void {
  const { HwpDocument } = wasm.getWasmModuleExports(), format = /\.hwpx$/iu.test(wasm.fileName) ? 'hwpx' : 'hwp';
  const open = (bytes: Uint8Array) => new HwpDocument(bytes);
  const save = (doc: any) => {
    const artifact = doc[format === 'hwpx' ? 'exportHwpxWithReport' : 'exportHwpWithReport']();
    try { const bytes = artifact.takeBytes(); verifyPreservedExport(doc, bytes, format, artifact.contentLoss(), open); return bytes; }
    finally { artifact.free(); }
  };
  let scratch: any;
  try { scratch = open(save(wasm.borrowDocumentHandle?.() ?? wasm)); edit(scratch); save(scratch); }
  finally { scratch?.free(); }
}
