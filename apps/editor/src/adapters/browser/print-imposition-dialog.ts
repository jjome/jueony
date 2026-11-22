import { createPrintSurface, waitForPrintSurfaceReady } from '../../../command/print-surface';
import { planPrintImposition, type PrintImposition } from '../../modules/document/public/index.ts';

type PrintPage = { svg: string; width: number; height: number };
export function showPrintImposition(readPages: () => PrintPage[], token: () => string): void {
  const expected = token();
  const pages = readPages();
  if (token() !== expected) throw new Error('문서가 바뀌었습니다. 모아찍기를 다시 여세요.');
  const options: PrintImposition = { perSheet:2, orientation:'landscape', paper:'a4', marginMm:8, parity:'all', reverse:false };
  const dialog = document.createElement('dialog');
  dialog.id = 'jueony-print-imposition';
  dialog.style.cssText = 'width:min(760px,94vw);max-height:88vh';
  const title = document.createElement('h2');
  title.id = 'jueony-print-imposition-title';
  title.textContent = '모아찍기 미리보기';
  dialog.setAttribute('aria-labelledby',title.id);
  const status = document.createElement('p');status.setAttribute('role','status');
  const controls = document.createElement('form');controls.onsubmit = event => event.preventDefault();
  const preview = document.createElement('div');
  preview.style.cssText='background:#ebeff4;padding:8px;overflow:auto;max-height:55vh';
  const print = document.createElement('button');print.type='button';print.textContent='인쇄 · PDF 저장';
  const close = document.createElement('button');close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();
  const urls = pages.map(page => URL.createObjectURL(new Blob([page.svg],{type:'image/svg+xml'})));
  let busy = false;
  const plan = () => planPrintImposition(pages.length,options);
  function render(container:HTMLElement, percent:boolean) {
    const layout = plan();
    const doc = container.ownerDocument;
    container.replaceChildren();
    layout.sheets.forEach((slots,index)=>{
      const sheet = doc.createElement('section');
      sheet.dataset.sheet=String(index+1);
      sheet.setAttribute('aria-label', `출력 용지 ${index+1}`);
      const {widthMm,heightMm,rows,columns,marginMm}=layout;
      sheet.style.cssText=`box-sizing:border-box;display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));grid-template-rows:repeat(${rows},minmax(0,1fr));width:${percent?'100%':`${widthMm}mm`};aspect-ratio:${widthMm}/${heightMm};${percent?'':'height:'+heightMm+'mm;'}padding:${percent?`${marginMm/widthMm*100}%`:`${marginMm}mm`};background:#fff;overflow:hidden;break-after:${index+1===layout.sheets.length?'auto':'page'};`;
      if(percent){sheet.style.margin='0 auto 8px';sheet.style.maxWidth='640px';}
      for (const slot of slots) {
        const image=doc.createElement('img');image.alt=`문서 ${slot.page+1}쪽`;image.src=urls[slot.page];
        image.style.cssText=`width:100%;height:100%;min-width:0;min-height:0;object-fit:contain;grid-area:${slot.row+1}/${slot.column+1}`;
        sheet.append(image);
      }
      container.append(sheet);
    });
    if(percent){status.textContent=`${layout.sheets.length}장 · ${pages.length}쪽 중 ${layout.sheets.flat().length}쪽 선택`;print.disabled=busy||!layout.sheets.length;}
    return layout;
  }
  function select<T extends string>(label:string, values:readonly [T,string][], current:T, change:(value:T)=>void) {
    const field=document.createElement('label'), input=document.createElement('select');
    for(const [value,name] of values)input.add(new Option(name,value,value===current,value===current));
    input.onchange=()=>{change(input.value as T);render(preview,true);};
    field.append(` ${label} `,input);controls.append(field);
  }
  select('한 장에',[['2','2쪽'],['4','4쪽']],'2',value=>options.perSheet=value==='2'?2:4);
  select('용지',[['a4','A4'],['letter','Letter']],options.paper,value=>options.paper=value);
  select('방향',[['landscape','가로'],['portrait','세로']],options.orientation,value=>options.orientation=value);
  select('범위',[['all','모든 쪽'],['odd','홀수 쪽'],['even','짝수 쪽']],options.parity,value=>options.parity=value);
  select('여백',[['0','0mm'],['8','8mm'],['15','15mm']],'8',value=>options.marginMm=Number(value));
  const reverse=document.createElement('input');reverse.type='checkbox';
  reverse.onchange=()=>{options.reverse=reverse.checked;render(preview,true);};
  const reverseLabel=document.createElement('label');reverseLabel.append(reverse,' 역순');controls.append(reverseLabel);
  print.onclick=async()=>{
    let surface:Awaited<ReturnType<typeof createPrintSurface>>|undefined;
    busy=true;controls.inert=close.disabled=print.disabled=true;
    try {
      if(token()!==expected)throw new Error('문서가 바뀌었습니다. 모아찍기를 다시 여세요.');
      surface=await createPrintSurface();
      const layout=render(surface.document.body,false);
      const style=surface.document.createElement('style');style.textContent=`@page { size:${layout.widthMm}mm ${layout.heightMm}mm; margin:0 } body { margin:0 }`;
      surface.document.head.append(style);
      await Promise.all([...surface.document.images].map(img=>img.decode()));
      await waitForPrintSurfaceReady(surface);
      if(token()!==expected)throw new Error('문서가 바뀌었습니다. 모아찍기를 다시 여세요.');
      surface.window.print();
    } catch(error){status.textContent=error instanceof Error?error.message:String(error);}
    finally{surface?.dispose();busy=false;controls.inert=close.disabled=print.disabled=false;}
  };
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{for(const url of urls)URL.revokeObjectURL(url);dialog.remove();},{once:true});
  dialog.append(title,controls,status,preview,print,close);
  document.body.append(dialog);dialog.showModal();render(preview,true);
}
