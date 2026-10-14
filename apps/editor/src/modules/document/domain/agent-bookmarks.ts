import type {Snapshot,AgentBookmarkOp} from '../public/types.ts';
export function validBookmarkName(name:unknown):name is string{return typeof name==='string'&&name.trim().length>0&&Array.from(name).length<=100&&!/[\u0000-\u001f\u007f-\u009f\u2028\u2029\ud800-\udfff]/u.test(name);}
export function validateAgentBookmark(op:AgentBookmarkOp,snapshot:Snapshot):void {
 const bookmarks=snapshot.structure?.bookmarks;
 if(bookmarks?.editable!==true)throw new Error(bookmarks?.reason??'조회된 일반 본문 책갈피만 편집합니다.');
 if(!validBookmarkName(op.name))throw new Error('책갈피 이름은 빈 값·제어문자 없는 올바른 Unicode 100자 이하입니다.');
 const found=bookmarks.items.filter(b=>b.name===op.name);
 if(op.kind==='add_bookmark'){
  if(found.length)throw new Error('같은 이름의 책갈피가 이미 있습니다.');
  if(bookmarks.items.length>=200)throw new Error('책갈피는 200개 이하에서 추가합니다.');
  const node=snapshot.nodes.find(n=>n.id===op.target);
  if(!node?.editable)throw new Error('새 책갈피는 현재 편집 가능한 일반 본문 문단에 추가합니다. 기존 책갈피 문단의 본문 보호는 유지합니다.');
  if(!Number.isSafeInteger(op.offset)||op.offset<0||op.offset>Array.from(node.text).length)throw new Error('책갈피 위치는 현재 본문의 Unicode 글자 범위 안이어야 합니다.');
 }else{
  if(found.length!==1||!found[0].editable||found[0].target===null||found[0].offset===null)throw new Error('현재 이름의 일반 본문 책갈피 하나가 필요합니다.');
  if(op.kind==='rename_bookmark'){
   if(!validBookmarkName(op.newName))throw new Error('새 책갈피 이름은 빈 값·제어문자 없는 올바른 Unicode 100자 이하입니다.');
   if(op.newName===op.name)throw new Error('책갈피 이름의 변경 내용이 없습니다.');
   if(bookmarks.items.some(b=>b.name===op.newName))throw new Error('새 이름의 책갈피가 이미 있습니다.');
  }
 }
}
