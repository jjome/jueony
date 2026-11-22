const exitChoices=[
  ['cancel','취소'],
  ['save','파일에 모두 저장하고 종료'],
  ['discard','저장하지 않고 종료'],
  ['checkpoint','복구본을 저장하고 종료'],
] as const;

type ExitChoice=(typeof exitChoices)[number][0];

export function chooseNativeExit(documentNames:string[]):Promise<ExitChoice>{
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');
    dialog.id='native-exit-confirm';
    dialog.className='jueony-page-dialog';
    const title=document.createElement('h2');
    title.textContent='변경한 문서를 저장할까요?';
    const message=document.createElement('p');
    message.textContent=documentNames.join(', ')+' — 파일에 모두 저장하면 원본 파일(새 문서는 선택한 위치)에 저장합니다. 저장하지 않으면 해당 문서의 로컬 복구본도 폐기합니다. 복구본 보관은 원본 파일에 저장하지 않고 이 Windows 계정에 최신 내용을 보관합니다.';
    const buttons=exitChoices.map(([choice,label])=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=label;
      if(choice==='save')button.dataset.exitChoice=choice;
      button.onclick=()=>dialog.close(choice);
      return button;
    });
    dialog.append(title,message,...buttons);
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{
      const choice=exitChoices.find(([value])=>value===dialog.returnValue)?.[0]??'cancel';
      dialog.remove();
      resolve(choice);
    },{once:true});
    dialog.showModal();
    buttons[0].focus();
  });
}
