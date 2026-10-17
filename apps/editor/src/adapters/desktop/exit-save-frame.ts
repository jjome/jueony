/** Only newly-created save dialogs receive input during exit. Existing editor
 * and host controls stay inert, including workspace and tab navigation. */
export async function withExitSaveFrame<T>(frame:HTMLIFrameElement,save:()=>Promise<T>):Promise<T>{
 const values=new Map<HTMLElement,boolean>(),hidden=new Map<HTMLIFrameElement,HTMLIFrameElement['hidden']>();
 const set=(element:HTMLElement,value:boolean)=>{if(!values.has(element))values.set(element,element.inert);element.inert=value;};
 try{
  for(const other of document.querySelectorAll<HTMLIFrameElement>('.editor-frame')){hidden.set(other,other.hidden);other.hidden=other!==frame;}
  for(let child:HTMLElement=frame,parent=child.parentElement;parent;child=parent,parent=parent.parentElement){for(const sibling of Array.from(parent.children))if(sibling instanceof HTMLElement)set(sibling,sibling!==child);set(child,false);}
  const body=frame.contentDocument?.body;if(!body)throw Error('저장할 문서 창을 확인할 수 없습니다.');
  for(const child of Array.from(body.children))if(child.nodeType===1&&'inert'in child)set(child as HTMLElement,true);
  return await save();
 }finally{for(const[element,inert]of values)element.inert=inert;for(const[element,wasHidden]of hidden)element.hidden=wasHidden;}
}
