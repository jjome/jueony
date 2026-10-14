import {ModalDialog} from '../../../ui/dialog';
import type {AgentTableHeaderOp} from '../../modules/document/public/index.ts';
export class TableHeaderDialog extends ModalDialog {
 private firstRow!:HTMLInputElement;private count!:HTMLInputElement;private repeat!:HTMLInputElement;private mode!:HTMLSelectElement;private status!:HTMLParagraphElement;
 constructor(private initial:AgentTableHeaderOp,private rows:number,private apply:(op:AgentTableHeaderOp)=>void){super('제목 행·반복',480);}
 protected createBody():HTMLElement {
  const body=document.createElement('div');body.dataset.jueonyTableHeader='true';
  const help=document.createElement('p');help.textContent='맨 위부터 연속된 전체 행을 제목 행으로 지정합니다. 반복을 켜면 행 단위 쪽 나눔을 함께 설정하며 별도 본문 행이 필요합니다. 내용·서식·크기·배치는 유지하며 한 번에 되돌립니다. 부분 셀/흩어진 제목·병합/중첩 등 복합 원본은 아직 지원하지 않습니다.';
  this.firstRow=document.createElement('input');this.firstRow.type='checkbox';this.firstRow.checked=this.initial.headerRows>0;this.firstRow.setAttribute('aria-label','제목 행 지정');
  this.count=document.createElement('input');this.count.type='number';this.count.min='1';this.count.max=String(this.rows);this.count.step='1';this.count.value=String(this.initial.headerRows||1);this.count.disabled=!this.firstRow.checked;this.count.setAttribute('aria-label','제목 행 수');
  this.repeat=document.createElement('input');this.repeat.type='checkbox';this.repeat.checked=this.initial.repeatHeader;this.repeat.setAttribute('aria-label','제목 행 반복');
  const title=document.createElement('label');title.append(this.firstRow,' 맨 위부터 제목 행 지정');const count=document.createElement('label');count.append('제목 행 수 ',this.count);const repeat=document.createElement('label');repeat.append(this.repeat,' 다음 쪽에 제목 행 반복');
  this.mode=document.createElement('select');this.mode.setAttribute('aria-label','표 쪽 나눔');for(const [value,label]of [['none','나누지 않기'],['cell','셀 안에서 나눔'],['row','행 사이에서 나눔']]){const o=document.createElement('option');o.value=value;o.textContent=label;this.mode.append(o);}this.mode.value=this.initial.paginationMode;
  this.status=document.createElement('p');this.status.setAttribute('role','status');this.status.textContent='현재 문서의 설정을 읽었습니다. 값을 바꾼 뒤 설정을 누르세요.';
  this.repeat.onchange=()=>{if(this.repeat.checked){this.firstRow.checked=true;this.count.disabled=false;this.mode.value='row';}this.status.textContent='반복은 맨 위 연속 제목 행·행 단위 쪽 나눔과 함께 설정됩니다. 본문 행을 남겨 주세요.';};this.firstRow.onchange=()=>{this.count.disabled=!this.firstRow.checked;if(!this.firstRow.checked)this.repeat.checked=false;};
  title.style.display=count.style.display=repeat.style.display='block';body.append(help,title,count,repeat,this.mode,this.status);return body;
 }
 protected onConfirm():boolean {try{this.apply({...this.initial,headerRows:this.firstRow.checked?this.count.valueAsNumber:0,repeatHeader:this.repeat.checked,paginationMode:this.mode.value as AgentTableHeaderOp['paginationMode']});return true;}catch(e){this.status.textContent=e instanceof Error?e.message:String(e);this.status.setAttribute('role','alert');return false;}}
}
