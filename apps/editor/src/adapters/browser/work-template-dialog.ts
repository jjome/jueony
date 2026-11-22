import { ModalDialog } from '../../../ui/dialog';
import { readWorkTemplate, workTemplates, workTemplateFields, type WorkTemplateId, type WorkTemplateValues } from '../../modules/document/public/work-templates.ts';
export class WorkTemplateDialog extends ModalDialog {
  private form!: ReturnType<typeof createTemplateForm>;
  constructor(private apply: (id: WorkTemplateId, values?: WorkTemplateValues) => void) { super('기본 업무 양식', 590); }
  protected createBody(): HTMLElement {
    this.form = createTemplateForm(true);
    const help = document.createElement('p');
    help.textContent = '새 빈 문서에 Jueony 기본 양식을 넣습니다. 기관 공식 서식이 필요한 경우 해당 파일을 별도로 사용하세요.';
    this.form.body.prepend(help);
    return this.form.body;
  }
  protected onConfirm(): boolean {
    try { this.apply(this.form.id(),this.form.values()); return true; }
    catch (error) { this.form.showError(error); return false; }
  }
}

function createTemplateForm(allowBlank: boolean) {
  const body = document.createElement('div');
  body.dataset.jueonyWorkTemplate = 'true';
  const select = document.createElement('select'); select.setAttribute('aria-label','업무 양식 선택');
  for (const template of workTemplates) select.add(new Option(template.name,template.id));
  const id = () => select.value as WorkTemplateId;
  const fill = document.createElement('input'); fill.type = 'checkbox'; fill.checked = !allowBlank;
  const mode = document.createElement('label'); mode.append(fill,' 업무 정보 입력'); mode.hidden = !allowBlank;
  const inputs = document.createElement('fieldset'); inputs.style.cssText = 'max-height:170px;overflow:auto';
  const preview = document.createElement('textarea'); preview.readOnly = true; preview.rows = 9; preview.style.width = '100%';
  preview.setAttribute('aria-label','업무 양식 미리보기');
  const status = document.createElement('p'); status.setAttribute('role','status');
  const showError = (error: unknown) => { status.textContent = error instanceof Error ? error.message : String(error); };
  const values = (): WorkTemplateValues | undefined => fill.checked
    ? Object.fromEntries([...inputs.querySelectorAll('input')].map(input=>[input.name,input.value])) : undefined;
  function update() {
    inputs.hidden = !fill.checked;
    const template = readWorkTemplate(id(),values(),true);
    preview.value = template.paragraphs.map(item=>item.text).join('\n')
      + (template.table ? '\n' + template.table.map(row=>row.join(' | ')).join('\n') : '');
    status.textContent = template.description + (template.table ? ` · ${template.table.length}행 ${template.table[0].length}열 표` : '');
  }
  function renderFields() {
    const legend = document.createElement('legend'); legend.textContent = '양식 입력 항목';
    inputs.replaceChildren(legend);
    for (const {name,required} of workTemplateFields(readWorkTemplate(id()))) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.name = name; input.maxLength = 180; input.required = required;
      label.style.display = 'block'; label.append(`${name}${required?' (필수)':''} `,input);
      input.oninput = update; inputs.append(label);
    }
    update();
  }
  select.onchange = renderFields;
  fill.onchange = update;
  body.append(select,mode,inputs,preview,status);
  renderFields();
  function fillSuggestions(values:WorkTemplateValues){
    for(const field of inputs.querySelectorAll('input')){
      if(!field.value.trim()&&Object.hasOwn(values,field.name))field.value=values[field.name];
    }
    update();
  }
  return {body,id,values,showError,fillSuggestions};
}

export function showWorkTemplateCopyDialog(
  openCopy:(id:WorkTemplateId,values:WorkTemplateValues)=>Promise<void>,
  suggest?:(id:WorkTemplateId,values:WorkTemplateValues,notes:string,signal:AbortSignal)=>Promise<WorkTemplateValues>,
): void {
  const dialog = document.createElement('dialog'); dialog.id = 'work-template-copy-dialog';
  const title = document.createElement('h2'); title.id = 'work-template-copy-title'; title.textContent = '기본 업무 양식 사본';
  dialog.setAttribute('aria-labelledby',title.id);
  const form = createTemplateForm(false);
  const open = document.createElement('button'); open.type = 'button'; open.id='open-work-template-copy'; open.textContent = 'HWPX 사본 열기';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기';
  close.onclick = () => dialog.close();
  let applying = false;
  let draft:AbortController|undefined;
  if(suggest){
    const details=document.createElement('details');
    const summary=document.createElement('summary');summary.textContent='AI로 본문 초안 제안 받기';
    const label=document.createElement('label');label.textContent='AI에 전달할 메모 ';
    const notes=document.createElement('textarea');notes.rows=3;notes.maxLength=4000;notes.style.width='100%';
    label.append(notes);
    const description=document.createElement('p');description.textContent='선택한 모델에 이 메모와 빈 본문 항목 이름을 보냅니다. 제안을 확인하고 사본을 여세요.';
    const draftStatus=document.createElement('p');draftStatus.setAttribute('role','status');
    const ask=document.createElement('button');ask.type='button';ask.id='suggest-work-template-draft';ask.textContent='본문 초안 제안 받기';
    ask.onclick=async()=>{
      if(draft){draft.abort();return;}
      if(applying)return;
      const job=new AbortController(),id=form.id(),memo=notes.value,values=form.values()??{};
      draft=job;open.disabled=true;ask.textContent='제안 요청 취소';draftStatus.textContent='본문 초안을 요청했습니다.';
      try{
        const result=await suggest(id,values,memo,job.signal);
        job.signal.throwIfAborted();
        if(!dialog.open)return;
        if(id!==form.id()||memo!==notes.value||JSON.stringify(values)!==JSON.stringify(form.values()))throw new Error('입력 내용이 바뀌었습니다. 초안 제안을 다시 요청하세요.');
        form.fillSuggestions(result);
        const count=Object.keys(result).length;
        draftStatus.textContent=count?`본문 초안 ${count}개를 채웠습니다. 내용을 확인해 주세요.`:'입력한 메모에서 채울 내용을 찾지 못했습니다.';
      }catch(error){
        draftStatus.textContent=job.signal.aborted?'초안 요청을 취소했습니다.':error instanceof Error?error.message:String(error);
      }finally{draft=undefined;open.disabled=false;ask.textContent='본문 초안 제안 받기';}
    };
    details.append(summary,label,description,ask,draftStatus);
    dialog.append(title,form.body,details,open,close);
  }else dialog.append(title,form.body,open,close);
  open.onclick = async () => {
    if (applying||draft) return;
    applying = form.body.inert = open.disabled = close.disabled = true;
    try { await openCopy(form.id(),form.values() ?? {}); dialog.close(); }
    catch (error) { form.showError(error); }
    finally { applying = form.body.inert = open.disabled = close.disabled = false; }
  };
  dialog.addEventListener('cancel',event=>{ if (applying) event.preventDefault(); });
  dialog.addEventListener('close',()=>{draft?.abort();dialog.remove();},{once:true});
  document.body.append(dialog); dialog.showModal();
}
