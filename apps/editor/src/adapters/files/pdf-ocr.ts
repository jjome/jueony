import type { PDFPageProxy } from 'pdfjs-dist';
import type { Worker as OcrWorker } from 'tesseract.js';

const MAX_PIXELS = 4_000_000;

async function waitFor<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_resolve,reject)=>{
    abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
  });
  try { return await Promise.race([work,stopped]); }
  finally { signal.removeEventListener('abort',abort); }
}

/** Recognition uses the site's own worker, engine and language files. */
export function createPdfOcr(caller: AbortSignal) {
  const signal=AbortSignal.any([caller,AbortSignal.timeout(90_000)]);
  let opening: Promise<OcrWorker> | undefined;
  let disposed=false;
  function dispose() {
    if(disposed)return;
    disposed=true;
    signal.removeEventListener('abort',dispose);
    void opening?.then(worker=>worker.terminate()).catch(()=>{});
  }
  signal.addEventListener('abort',dispose,{once:true});

  async function worker(): Promise<OcrWorker> {
    signal.throwIfAborted();
    if(disposed)throw new Error('스캔 PDF 글자 인식을 마쳤습니다.');
    opening ??= import('tesseract.js').then(api=>api.createWorker(['kor','eng'],api.OEM.LSTM_ONLY,{
      workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,cacheMethod:'none',
      errorHandler:()=>{},
    }));
    return waitFor(opening,signal);
  }

  async function recognize(page: PDFPageProxy): Promise<string> {
    const recognizer=await worker();
    const normal=page.getViewport({scale:1});
    if(!Number.isFinite(normal.width*normal.height)||normal.width<=0||normal.height<=0)throw new Error('스캔 쪽의 크기를 확인할 수 없습니다.');
    const scale=Math.min(2.5,Math.sqrt(MAX_PIXELS/(normal.width*normal.height)));
    const viewport=page.getViewport({scale});
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.floor(viewport.width));canvas.height=Math.max(1,Math.floor(viewport.height));
    const render=page.render({canvas,viewport,background:'#ffffff'});
    const cancel=()=>render.cancel();
    signal.addEventListener('abort',cancel,{once:true});
    try {
      await waitFor(render.promise,signal);
      const {data}=await waitFor(recognizer.recognize(canvas),signal);
      return data.text.trim();
    } finally {
      signal.removeEventListener('abort',cancel);
      canvas.width=canvas.height=0;
    }
  }
  return { recognize, dispose };
}
