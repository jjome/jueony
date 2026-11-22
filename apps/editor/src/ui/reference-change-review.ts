import type {ReferenceChangeReview} from '../modules/agent/public/index.ts';
import {sectionChangeReceipt} from '../modules/document/public/index.ts';
import {describeStructureChanges} from './agent-changes.ts';
import {describeReferenceOperation} from './reference-change-details.ts';
import {element as $} from './dom.ts';

export function reviewReferenceChanges(review:ReferenceChangeReview,signal:AbortSignal):Promise<boolean>{
 const dialog=$<HTMLDialogElement>('reference-change-review');
 if(signal.aborted||dialog.open)return Promise.resolve(false);
 $('reference-change-request').textContent=review.request;
 $('reference-change-document').textContent=review.document.name;
 $('reference-change-sources').textContent=review.referenceNames.join(', ');
 const list=review.operations.map(operation=>{
  const {heading:title,description}=describeReferenceOperation(operation,review);
  const item=document.createElement('li');
  const heading=document.createElement('strong');
  heading.textContent=title;
  item.append(heading);
  if(description){
   const details=document.createElement('pre');
   details.textContent=description;
   item.append(details);
  }
  return item;
 });
 const changes=$('reference-change-operations');
 changes.replaceChildren(...list);
 const structure=$<HTMLDetailsElement>('reference-change-structure');
 const structureItems=$('reference-change-structure-items');
 const preview=review.verifiedStructure;
 const lines=preview?describeStructureChanges({beforeStructure:preview.before,afterStructure:preview.after,
  ...sectionChangeReceipt(review.operations.length===1?review.operations[0]:undefined,review.document.nodes)}):[];
 structureItems.replaceChildren(...lines.map(line=>Object.assign(document.createElement('li'),{textContent:line})));
 structure.hidden=!lines.length;
 structure.open=lines.length>0;
 return new Promise((resolve,reject)=>{
  const cancel=()=>dialog.close('cancel');
  const close=()=>{
   signal.removeEventListener('abort',cancel);
   changes.replaceChildren();
   structureItems.replaceChildren();
   resolve(dialog.returnValue==='apply'&&!signal.aborted);
  };
  dialog.returnValue='cancel';
  dialog.addEventListener('close',close,{once:true});
  signal.addEventListener('abort',cancel,{once:true});
  try {
   dialog.showModal();
   $('reference-change-cancel').focus();
  } catch(error) {
   dialog.removeEventListener('close',close);
   signal.removeEventListener('abort',cancel);
   changes.replaceChildren();
   structureItems.replaceChildren();
   reject(error);
  }
 });
}
