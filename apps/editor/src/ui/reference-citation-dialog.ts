import type {OfficeCitation} from '../composition/reference-citations.ts';
import {describeSourceAddress} from '../modules/references/public/index.ts';
import {element} from './dom.ts';

const labels={xlsx:'인용한 Excel 셀',pdf:'인용한 PDF 쪽',docx:'인용한 Word 문단'};

export function showReferenceCitation({name,value,address}:OfficeCitation):void {
  if(document.querySelector('dialog[open]'))throw new Error('현재 창의 대화상자를 닫고 인용 위치를 다시 선택해 주세요.');
  element('spreadsheet-citation-title').textContent=labels[address.kind];
  element('spreadsheet-citation-file').textContent=name;
  element('spreadsheet-citation-address').textContent=describeSourceAddress(address);
  element('spreadsheet-citation-value').textContent=value;
  element<HTMLDialogElement>('spreadsheet-citation-dialog').showModal();
}
