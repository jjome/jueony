function replacePinned(source,from,to){
 if(source.split(from).length!==2)throw new Error('OCR 자산의 고정 기본 경로를 확인하지 못했습니다.');
 return source.replace(from,to);
}

export function patchOcrWorker(source){
 const localLanguages=replacePinned(source,'"https://cdn.jsdelivr.net/npm/@tesseract.js-data/".concat(i,m?"/4.0.0_best_int":"/4.0.0")','"/ocr/lang"');
 return replacePinned(localLanguages,'"https://cdn.jsdelivr.net/npm/tesseract.js-core@v".concat(h.substring(1))','"/ocr/core"');
}

export function offlineOcrDefaults(){
 return {name:'jueony-offline-ocr-defaults',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/tesseract.js/src/worker/browser/defaultOptions.js'))return;
  return replacePinned(source,'`https://cdn.jsdelivr.net/npm/tesseract.js@v${version}/dist/worker.min.js`','\'/ocr/worker.min.js\'');
 }};
}
