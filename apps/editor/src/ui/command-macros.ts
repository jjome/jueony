import type {CommandMacro,CommandTemplate} from '../modules/automation/public/index.ts';
import type {Snapshot} from '../modules/document/public/index.ts';
import type {createAutomationFacade} from '../modules/automation/public/index.ts';

const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;

export function renderCommandMacros(list:HTMLElement,macros:readonly CommandMacro[],actions:{
  button:(label:string,action:()=>unknown)=>HTMLButtonElement;
  run:(macro:CommandMacro)=>void;
  rename:(macro:CommandMacro)=>Promise<void>;
  remove:(macro:CommandMacro)=>Promise<void>;
}) {
  const rows=macros.map(macro=>{
    const row=document.createElement('div');
    row.className='macro-row';
    const name=document.createElement('strong');
    name.textContent=macro.name;
    row.append(name,actions.button('실행',()=>actions.run(macro)),actions.button('이름',()=>actions.rename(macro)),
      actions.button('삭제',()=>actions.remove(macro)));
    return row;
  });
  list.replaceChildren(...rows);
  if(!rows.length)list.textContent='아직 저장한 반복 작업이 없습니다. 완료한 AI 변경에서 반복 작업으로 저장을 누르세요.';
}

export function showCommandMacroParameters(automation:ReturnType<typeof createAutomationFacade>,template:CommandTemplate,name:string,base:Snapshot) {
  const sections=automation.sections(template),tables=automation.tables(template,base),shapes=automation.shapes(template,base);
  const sectionList=element('macro-sections'),tableList=element('macro-tables');
  const shapeList=element('macro-shapes'),variableList=element('macro-variables');
  element('macro-parameters-title').textContent=name;
  element('macro-error').textContent='';
  for(const list of [sectionList,tableList,shapeList,variableList])list.replaceChildren();
  for(const original of sections){
    const label=document.createElement('label');
    label.textContent=`기록한 ${original+1}구역 → 대상 구역`;
    const select=document.createElement('select');
    select.required=true;
    select.dataset.section=String(original);
    select.setAttribute('aria-label',label.textContent);
    select.add(new Option('적용할 구역을 직접 선택해 주세요',''));
    for(const section of base.structure?.sections??[]){
      const paragraphs=base.nodes.filter(node=>node.section===section.index).length;
      select.add(new Option(`${section.index+1}구역 · ${paragraphs}개 본문 문단`,String(section.index)));
    }
    label.append(select);
    sectionList.append(label);
  }
  for(const [index,entry] of tables.entries()){
    const label=document.createElement('label');
    label.textContent=`기록 ${entry.nested?'중첩 표':'표'} ${index+1} · ${entry.rows}행 × ${entry.columns}열`;
    const select=document.createElement('select');
    select.required=true;
    select.dataset.table=entry.source;
    select.setAttribute('aria-label',label.textContent);
    select.add(new Option(entry.candidates.length?'적용할 표를 직접 선택해 주세요':'원문과 격자가 일치하는 표가 없습니다',''));
    for(const {id,section,paragraph,control,parent} of entry.candidates){
      const owner=parent?` · 표 ${parent.controlIndex+1}의 ${parent.cellIndex+1}번째 셀`:'';
      select.add(new Option(`${section+1}구역 · ${paragraph+1}문단${owner} · ${control+1}번 개체`,id));
    }
    label.append(select);
    tableList.append(label);
  }
  if(shapes){
    const label=document.createElement('label');
    label.textContent='대상 도형';
    const select=document.createElement('select');
    select.required=true;
    select.add(new Option(shapes.length?'색을 바꿀 도형을 직접 선택해 주세요':'기록한 속성과 일치하는 도형이 없습니다',''));
    for(const {id,section,paragraph,control} of shapes){
      select.add(new Option(`${section+1}구역 · ${paragraph+1}문단 · ${control+1}번 도형`,id));
    }
    label.append(select);
    shapeList.append(label);
  }
  for(const variable of automation.variables(template)){
    const label=document.createElement('label');
    label.textContent=variable;
    const input=document.createElement('input');
    input.dataset.variable=variable;
    input.required=true;
    input.maxLength=4000;
    input.placeholder=variable==='붙임'?'없으면 없음으로 입력':variable;
    label.append(input);
    variableList.append(label);
  }
  const scopeNote=shapes?'선택한 도형의 원본 속성을 대조합니다.':tables.length?'선택한 표의 원문·서식·격자를 대조합니다.'
    :sections.length?'선택한 구역에 적용하며 본문은 해당 구역에서 원문을 대조합니다.':'현재 문서에서 원문이 일치하는 문단에 적용합니다.';
  const note=template.operations[0].kind==='create_document'?'새 문서를 만듭니다.':scopeNote;
  element('macro-preview').textContent=automation.describe(template)+'\n\n'+note+
    '\n문서가 바뀌면 설정창을 다시 열어 주세요. 변경 후 요청 되돌리기로 복원할 수 있습니다. 파일 저장은 별도로 실행하세요.';
  element<HTMLDialogElement>('macro-dialog').close();
  element<HTMLDialogElement>('macro-parameters').showModal();
}

export function readCommandMacroParameters() {
  const values:Record<string,string>=Object.create(null);
  for(const input of element('macro-variables').querySelectorAll<HTMLInputElement>('input'))values[input.dataset.variable!]=input.value;
  const sections:Record<string,number>=Object.create(null);
  for(const select of element('macro-sections').querySelectorAll<HTMLSelectElement>('select')){
    if(!select.value)throw new Error('기록한 각 구역의 대상 구역을 직접 선택해 주세요.');
    sections[select.dataset.section!]=Number(select.value);
  }
  const tables:Record<string,string>=Object.create(null);
  for(const select of element('macro-tables').querySelectorAll<HTMLSelectElement>('select')){
    if(!select.value)throw new Error('기록한 각 표의 대상 표를 직접 선택해 주세요.');
    tables[select.dataset.table!]=select.value;
  }
  return {values,sections,tables,shape:element('macro-shapes').querySelector('select')?.value};
}
