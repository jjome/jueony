type Stamp = {generation: unknown; revision: unknown; input: unknown; selection: string};

/** Ordinary shape dialogs may outlive a concurrent Agent edit. Never retarget them. */
export function createFormatDialogTarget(read: () => Stamp) {
 let expected=read();
 const sameDocument=(actual:Stamp)=>actual.generation===expected.generation&&actual.input===expected.input;
 return {
  assertCurrent(){const actual=read();if(!sameDocument(actual)||actual.revision!==expected.revision||actual.selection!==expected.selection)throw new Error('문서나 선택이 변경되어 적용하지 않았습니다. 취소한 뒤 대화상자를 다시 열어 주세요.');},
  // Called only after the nested default-tab dialog validates and commits its own edit.
  acceptOwnChange(){const actual=read();if(!sameDocument(actual))throw new Error('다른 문서에는 적용하지 않습니다. 대화상자를 다시 열어 주세요.');expected=actual;},
 };
}

export function captureFormatDialogTarget(services:any){
 return createFormatDialogTarget(()=>{const input=services.getInputHandler();return{generation:services.wasm.documentGeneration,revision:(window as any).jueonyEditor?.revision?.(),input,selection:JSON.stringify({selection:input?.getSelection?.(),cursor:input?.getCursorPosition?.()})};});
}

export function showFormatDialogError(dialog:any,error:unknown):void{
 let label=dialog.overlay.querySelector('[data-format-dialog-error]');
 if(!label){label=document.createElement('p');label.dataset.formatDialogError='true';label.setAttribute('role','alert');label.style.cssText='color:#b43b2e;padding:8px 16px;max-width:480px;white-space:normal;';(dialog.overlay.querySelector('.modal-dialog')??dialog.overlay.firstElementChild??dialog.overlay).append(label);}
 label.textContent=error instanceof Error?error.message:String(error);
}
