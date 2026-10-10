export type TemporaryReference={id:string;workspaceId:string;chatId:string;file:File};
// Browser session only: bytes never enter workspace history or the credential store.
export class TemporaryReferences {
 private items:TemporaryReference[]=[];
 list(workspaceId:string,chatId:string){return this.items.filter(x=>x.workspaceId===workspaceId&&x.chatId===chatId);}
 add(workspaceId:string,chatId:string,files:File[]){
  const next=[...this.items];
  for(const file of files){
   if(!/\.(hwp|hwpx|txt|md)$/i.test(file.name))throw new Error('참고 첨부는 HWP/HWPX/TXT/MD만 지원합니다: '+file.name);
   if(file.size>16*1024*1024)throw new Error('첨부 파일은 16MB까지입니다: '+file.name);
   if(next.some(x=>x.workspaceId===workspaceId&&x.chatId===chatId&&x.file.name===file.name&&x.file.size===file.size&&x.file.lastModified===file.lastModified))continue;
   next.push({id:'attachment:'+crypto.randomUUID(),workspaceId,chatId,file});
  }
  if(next.filter(x=>x.workspaceId===workspaceId&&x.chatId===chatId).length>20)throw new Error('한 채팅의 임시 첨부는 20개까지입니다.');
  if(next.reduce((sum,x)=>sum+x.file.size,0)>64*1024*1024)throw new Error('열린 앱의 임시 첨부 합계는 64MB까지입니다. 사용하지 않는 첨부를 제거해 주세요.');
  this.items=next;
 }
 remove(workspaceId:string,chatId:string,id:string){this.items=this.items.filter(x=>!(x.workspaceId===workspaceId&&x.chatId===chatId&&x.id===id));}
}
