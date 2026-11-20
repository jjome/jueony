import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const marker='/* jueony-chart-data-ui-v1 */';
const seam=`void initPromise.then(() => { installHangulKeys({ automation, registry, input: () => inputHandler, eventBus }); installPageControls(registry, () => inputHandler); installDocumentInformation({registry, input: () => inputHandler}); installHangulChrome({ wasm, eventBus, documentState, automation }); });`;
function once(source,before,after,label){if(source.split(before).length!==2)throw new Error('Chart data UI integration drift: '+label);return source.replace(before,after);}

export function patchChartDataEditUiSource(source){
 source=source.replace(/\r\n/g,'\n');if(source.includes(marker))throw new Error('Chart data UI integration drift: already applied');
 source=`${marker}\nimport {installChartDataEditStudio} from './jueony/adapters/rhwp/chart-data-edit-studio.ts';\n`+source;
 return once(source,seam,`void initPromise.then(() => {
  installHangulKeys({ automation, registry, input: () => inputHandler, eventBus });
  installPageControls(registry, () => inputHandler); installDocumentInformation({registry, input: () => inputHandler});
  installChartDataEditStudio({wasm,eventBus,input:()=>inputHandler,render:()=>canvasView!.refreshDocumentAgentMutation()});
  installHangulChrome({ wasm, eventBus, documentState, automation });
});`,'install seam');
}

export async function applyChartDataEditUiPatches({root}){
 const path=join(root,'src/main.ts');await writeFile(path,patchChartDataEditUiSource(await readFile(path,'utf8')));
}
