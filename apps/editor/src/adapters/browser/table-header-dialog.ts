import {ModalDialog} from '../../../ui/dialog';
import type {AgentTableHeaderOp} from '../../modules/document/public/index.ts';
export class TableHeaderDialog extends ModalDialog {
 private firstRow!:HTMLInputElement;private repeat!:HTMLInputElement;private mode!:HTMLSelectElement;private status!:HTMLParagraphElement;
 constructor(private initial:AgentTableHeaderOp,private apply:(op:AgentTableHeaderOp)=>void){super('첫 제목 행·반복',480);}
 protected createBody():HTMLElement {
  const body=document.createElement('div');body.dataset.jueonyTableHeader='true';
  const help=document.createElement('p');help.textContent='첫 행 전체를 제목 행으로 지정합니다. 반복을 켜면 첫 제목 행과 행 단위 쪽 나눔을 함께 설정합니다. 내용·서식·크기·배치는 유지하며 한 번에 되돌립니다. 여러 제목 행·병합/중첩 등 복합 원본은 아직 지원하지 않습니다.';
  this.firstRow=document.createElement('input');this.firstRow.type='checkbox';this.firstRow.checked=this.initial.headerRows===1;this.firstRow.setAttribute('aria-label','첫 행 전체를 제목 행으로');
  this.repeat=document.createElement('input');this.repeat.type='checkbox';this.repeat.checked=this.initial.repeatHeader;this.repeat.setAttribute('aria-label','제목 행 반복');
  const title=document.createElement('label');title.append(this.firstRow,' 첫 행 전체를 제목 행으로');const repeat=document.createElement('label');repeat.append(this.repeat,' 다음 쪽에 제목 행 반복');
  this.mode=document.createElement('select');this.mode.setAttribute('aria-label','표 쪽 나눔');for(const [value,label]of [['none','나누지 않기'],['cell','셀 안에서 나눔'],['row','행 사이에서 나눔']]){const o=document.createElement('option');o.value=value;o.textContent=label;this.mode.append(o);}this.mode.value=this.initial.paginationMode;
  this.status=document.createElement('p');this.status.setAttribute('role','status');this.status.textContent='현재 문서의 설정을 읽었습니다. 값을 바꾼 뒤 설정을 누르세요.';
  this.repeat.onchange=()=>{if(this.repeat.checked){this.firstRow.checked=true;this.mode.value='row';}this.status.textContent='반복은 첫 제목 행·행 단위 쪽 나눔과 함께 설정됩니다.';};this.firstRow.onchange=()=>{if(!this.firstRow.checked)this.repeat.checked=false;};
  title.style.display=repeat.style.display='block';body.append(help,title,repeat,this.mode,this.status);return body;
 }
 protected onConfirm():boolean {try{this.apply({...this.initial,headerRows:this.firstRow.checked?1:0,repeatHeader:this.repeat.checked,paginationMode:this.mode.value as AgentTableHeaderOp['paginationMode']});return true;}catch(e){this.status.textContent=e instanceof Error?e.message:String(e);this.status.setAttribute('role','alert');return false;}}
}
