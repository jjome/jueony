import {MAX_SOURCE_LOCATIONS,type OfficeTextReferenceAddress,type SourceLocation} from '../../modules/references/public/index.ts';
export type ExtractedOfficeReference = { text: string; limitation: string; locations?: SourceLocation[] };
import {createPdfOcr} from './pdf-ocr.ts';
const MAX_CHARACTERS = 120_000;
const MAX_DOCX_XML = 2 * 1024 * 1024;
const MAX_PDF_PAGES = 200;
const MAX_OCR_PAGES = 12;
const wordNamespaces = new Set([
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
]);

export async function openWordMainDocument(bytes: Uint8Array, signal: AbortSignal): Promise<{body: Element; parts: ReadonlySet<string>}> {
  signal.throwIfAborted();
  const { unzipSync } = await import('fflate');
  let xml: Uint8Array | undefined;
  const parts = new Set<string>();
  try {
    xml = unzipSync(bytes, { filter(entry) {
      if (parts.size >= 3000) throw new Error('Too many ZIP entries');
      parts.add(entry.name);
      if (entry.name !== 'word/document.xml') return false;
      if (entry.originalSize > MAX_DOCX_XML) throw new RangeError();
      return true;
    } })['word/document.xml'];
  } catch (error) {
    if (error instanceof RangeError) throw new Error('Word 참고 문서의 본문 XML이 2MB를 넘습니다.');
    throw new Error('Word 참고 문서를 열 수 없습니다. 암호화되었거나 손상된 파일일 수 있습니다.');
  }
  if (!xml || xml.byteLength > MAX_DOCX_XML) throw new Error('Word 문서의 본문 XML을 확인할 수 없습니다.');
  const text = new TextDecoder('utf-8', { fatal:true }).decode(xml);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('외부 선언이 포함된 Word 문서는 읽을 수 없습니다.');
  const document = new DOMParser().parseFromString(text, 'application/xml');
  const root = document.documentElement;
  if (root.localName !== 'document' || !wordNamespaces.has(root.namespaceURI ?? '')) throw new Error('올바른 Word 본문 형식이 아닙니다.');
  const body = [...root.children].find(child => child.namespaceURI === root.namespaceURI && child.localName === 'body');
  if (!body) throw new Error('Word 문서에 본문이 없습니다.');
  return {body, parts};
}

export async function extractWordReference(bytes: Uint8Array, signal: AbortSignal): Promise<ExtractedOfficeReference> {
  const {body} = await openWordMainDocument(bytes, signal);
  const parts: string[] = [];
  const stack: {node: Element; end?: true; depth: number; paragraph?: {number: number; start: number}}[] = [{node:body,depth:0}];
  const locations: SourceLocation[] = [];
  let size = 0;
  let nodes = 0;
  let paragraphs = 0;
  function append(value: string) {
    size += value.length;
    if (size > MAX_CHARACTERS) throw new Error('Word 참고 문서의 추출문이 120,000자를 넘습니다.');
    parts.push(value);
  }
  while (stack.length) {
    signal.throwIfAborted();
    const {node,end,depth,paragraph} = stack.pop()!;
    if (++nodes > 60_000 || depth > 80) throw new Error('Word 문서의 구조가 추출 한도를 넘습니다.');
    if (node.namespaceURI !== body.namespaceURI || ['del','moveFrom','drawing','pict','object','txbxContent','altChunk'].includes(node.localName)) continue;
    if (end) {
      if (paragraph && paragraph.start<size && locations.length<MAX_SOURCE_LOCATIONS
        && paragraph.start >= (locations.at(-1)?.end??0)) {
        locations.push({start:paragraph.start,end:size,address:{kind:'docx',paragraph:paragraph.number}});
      }
      if (node.localName === 'tc') append('\t');
      else append('\n');
    } else if (node.localName === 't') append(node.textContent ?? '');
    else if (node.localName === 'tab') append('\t');
    else if (node.localName === 'br' || node.localName === 'cr') append('\n');
    else {
      if (node.localName==='p') stack.push({node,end:true,depth,paragraph:{number:++paragraphs,start:size}});
      else if (node.localName==='tc'||node.localName==='tr') stack.push({node,end:true,depth});
      for (let i = node.children.length - 1; i >= 0; i--) stack.push({node:node.children[i],depth:depth+1});
    }
  }
  const untrimmed = parts.join('');
  const leading = untrimmed.length-untrimmed.trimStart().length;
  const result = untrimmed.trim();
  if (!result) throw new Error('Word 본문에서 읽을 수 있는 텍스트가 없습니다.');
  const trimmed = locations.flatMap(({start,end,address})=>{
    const from=Math.max(0,start-leading),to=Math.min(result.length,end-leading);
    return from<to&&result.slice(from,to).trim()?[{start:from,end:to,address}]:[];
  });
  return {text:result,locations:trimmed,limitation:'Word 본문·표의 셀을 문서 순서로 추출했습니다. 그림, 각주, 머리말, 서식과 삭제된 변경 사항은 제외됩니다.'};
}

export async function extractPdfReference(bytes: Uint8Array, signal: AbortSignal, useOcr = false, pageToRead?:number): Promise<ExtractedOfficeReference> {
  signal.throwIfAborted();
  const pdfjs = await import('pdfjs-dist');
  signal.throwIfAborted();
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  const task = pdfjs.getDocument({ data:bytes.slice(), cMapUrl:'/pdfjs/cmaps/', cMapPacked:true,
    standardFontDataUrl:'/pdfjs/standard_fonts/', wasmUrl:'/pdfjs/wasm/', useWasm:useOcr, enableXfa:false, stopAtErrors:true });
  const abort = () => { void task.destroy().catch(() => {}); };
  signal.addEventListener('abort', abort, {once:true});
  let loaded;
  try { loaded=await task.promise; }
  catch (error) {
    await task.destroy().catch(() => {});
    signal.removeEventListener('abort',abort);
    signal.throwIfAborted();
    throw new Error(error instanceof Error && error.name === 'PasswordException'
      ? '암호가 설정된 PDF 참고 자료는 열 수 없습니다.' : 'PDF 참고 자료가 손상되었거나 지원하지 않는 형식입니다.');
  }
  let ocr: ReturnType<typeof createPdfOcr> | undefined;
  try {
    if (loaded.numPages > MAX_PDF_PAGES) throw new Error(`PDF 참고 자료는 ${MAX_PDF_PAGES}쪽까지 읽을 수 있습니다.`);
    let total = 0;
    const empty: number[] = [];
    let ocrPages = 0;
    let recognizedPages = 0;
    const sections: string[] = [];
    const locations: SourceLocation[] = [];
    let textLength = 0;
    for (let page = pageToRead??1; page <= Math.min(pageToRead??loaded.numPages,loaded.numPages); page++) {
      signal.throwIfAborted();
      const handle = await loaded.getPage(page);
      const stream = handle.streamTextContent().getReader();
      let content = '';
      try {
        for (;;) {
          const { done, value } = await stream.read();
          if (done) break;
          for (const item of value.items) if ('str' in item) {
            const part = item.str + (item.hasEOL ? '\n' : ' ');
            total += part.length;
            if (total > MAX_CHARACTERS) throw new Error('PDF 참고 문서의 추출문이 120,000자를 넘습니다.');
            content += part;
          }
          signal.throwIfAborted();
        }
      } finally { await stream.cancel().catch(() => {}); }
      try {
        let recognition=false;
        if(!content.trim()&&useOcr&&ocrPages<MAX_OCR_PAGES){
          ocr??=createPdfOcr(signal);ocrPages++;
          try {content=await ocr.recognize(handle);}
          catch (error){signal.throwIfAborted();throw new Error(error instanceof Error&&error.name==='TimeoutError'
            ? 'PDF 글자 인식 시간 한도를 넘었습니다.' : '이 PC에서 PDF의 글자 인식을 완료하지 못했습니다.');}
          total+=content.length;
          if(total>MAX_CHARACTERS)throw new Error('PDF 참고 문서의 추출문이 120,000자를 넘습니다.');
          if(content) {recognizedPages++;recognition=true;}
        }
        const body=content.trim();
        if(body){
          const heading=`[PDF ${page}쪽${recognition?' OCR':''}]\n`;
          const start=textLength+(sections.length?2:0)+heading.length;
          textLength=start+body.length;
          if(locations.length<MAX_SOURCE_LOCATIONS)locations.push({start,end:textLength,address:{kind:'pdf',page,ocr:recognition}});
          sections.push(heading+body);
        }else empty.push(page);
      } finally {handle.cleanup();}
    }
    if (!sections.length) throw new Error(useOcr ? 'PDF에서 OCR로 읽을 수 있는 텍스트를 찾지 못했습니다.' : 'PDF에 읽을 수 있는 텍스트가 없습니다. 스캔 PDF에는 OCR이 필요합니다.');
    return { text:sections.join('\n\n'), locations, limitation:'PDF의 텍스트를 쪽별로 추출했습니다. 표의 읽기 순서는 실제 배치와 다를 수 있습니다.'
      + (recognizedPages ? ` ${recognizedPages}쪽은 이 PC의 한국어·영어 OCR 결과입니다.` : '')
      + (empty.length ? ` 읽을 내용이 없는 쪽 ${empty.length}개를 건너뛰었습니다.${useOcr?' 텍스트 없는 쪽 중 최대 12쪽에 OCR을 적용합니다.':' OCR을 실행하지 않았습니다.'}` : '') };
  } catch (error) { signal.throwIfAborted(); throw error; }
  finally { ocr?.dispose(); signal.removeEventListener('abort',abort); await task.destroy().catch(() => {}); }
}

export async function readOfficeTextCitation(bytes:Uint8Array,address:OfficeTextReferenceAddress,signal:AbortSignal):Promise<string>{
  const source=address.kind==='pdf'
    ? await extractPdfReference(bytes,signal,address.ocr,address.page) : await extractWordReference(bytes,signal);
  const place=source.locations?.find(({address:found})=>address.kind==='pdf'
    ? found.kind==='pdf'&&found.page===address.page&&found.ocr===address.ocr
    : found.kind==='docx'&&found.paragraph===address.paragraph);
  if(!place)throw new Error('인용한 쪽이나 문단 위치를 다시 확인할 수 없습니다.');
  return source.text.slice(place.start,place.end);
}
