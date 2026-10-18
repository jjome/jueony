import {createHash} from 'node:crypto';
import {readFile,writeFile} from'node:fs/promises';import{join}from'node:path';
const replace=(source,before,after,name)=>{if(source.split(before).length!==2)throw Error('새 문서 날짜 패치 기준 불일치: '+name);return source.replace(before,after);};
export function patchDocumentCreatedBridge(source){
 const start=source.indexOf('  createNewDocument(): DocumentInfo {'),end=source.indexOf('\n  get fileName(): string {',start);
 if(start<0||end<0||source.indexOf('  createNewDocument(): DocumentInfo {',start+1)!==-1)throw Error('새 문서 생성 함수 기준 불일치');
 if(createHash('sha256').update(source.slice(start,end)).digest('hex')!=='a925b8f721e9d4b803aba35d92b3a24da5706ab9ab8d486ae7e1a0273f81c1b1')throw Error('새 문서 생성 함수 원문이 검증된 기준과 다릅니다.');
 const method=`  createNewDocument(): DocumentInfo {
    let nextDoc: HwpDocument | null = null;
    let info: DocumentInfo;
    let nextDigest: string;
    try {
      nextDoc = HwpDocument.createEmpty();
      info = JSON.parse(nextDoc.createBlankDocument());
      initializeDocumentCreatedInformation(nextDoc);
      this.ensureParagraphStableIdsFor(nextDoc);
      nextDoc.setFileName('새 문서.hwp');
      nextDigest = \`blake3:\${bytesToHex(blake3(nextDoc.exportHwp()))}\`;
    } catch (error) {
      try { nextDoc?.free(); } catch { /* candidate only */ }
      throw error;
    }
    const previousDoc = this.doc;
    this.doc = nextDoc;
    this._fileName = '새 문서.hwp';
    this._currentFileHandle = null;
    this._requiresPasswordForSave = false;
    this._documentDigest = nextDigest;
    this._documentGeneration += 1;
    this.releaseCanvasFontResources();
    try { previousDoc?.free(); } catch { /* previous owner is retired */ }
    console.log(\`[WasmBridge] 새 문서 생성: \${info.pageCount}페이지\`);
    this.onFileNameChanged?.(this._fileName);
    return info;
  }
`;
 return "import {initializeDocumentCreatedInformation} from '../jueony/adapters/rhwp/document-created-information111.ts';\n"+source.slice(0,start)+method+source.slice(end);
}
export async function applyDocumentCreatedInformationPatches({root}){
 const bridge=join(root,'src/core/wasm-bridge.ts');let source=(await readFile(bridge,'utf8')).replace(/\r\n/g,'\n');await writeFile(bridge,patchDocumentCreatedBridge(source));
 const agent=join(root,'src/jueony/adapters/rhwp/editor-bridge.ts');source=(await readFile(agent,'utf8')).replace(/\r\n/g,'\n');source=replace(source,'     copy.createBlankDocument();','     copy.createBlankDocument();\n     initializeDocumentCreatedInformation(copy);','Agent explicit new clone');source="import {initializeDocumentCreatedInformation} from './document-created-information111.ts';\n"+source;await writeFile(agent,source);
}
