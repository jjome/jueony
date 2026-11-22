import {permission,type Reference} from '../adapters/files/references.ts';
import type {TemporaryReference} from '../adapters/files/temporary-references.ts';
import type {Folder} from '../adapters/storage/legacy-records.ts';
import {element as $} from './dom.ts';

type Scope={workspaceId:string;chatId:string};
type DirectoryEntries={
  entries():AsyncIterableIterator<[string,FileSystemDirectoryHandle|FileSystemFileHandle]>;
};

export function createReferencePanel(options:{
  scope():Scope;
  folders(workspaceId:string):Folder[];
  selected():readonly Reference[];
  attachments(scope:Scope):TemporaryReference[];
  removeAttachment(scope:Scope,id:string):void;
  choose(checked:boolean,reference:Reference):void;
  disconnect(folder:Folder):Promise<void>;
  openFile(handle:FileSystemFileHandle):Promise<void>;
  button(label:string,action:()=>unknown):HTMLButtonElement;
  status(message:string):void;
}){
  let treeVersion=0;

  function renderSummary(){
    const target=$('reference-summary');
    const selected=options.selected();
    const line=document.createElement('div');
    line.textContent=selected.length
      ?'연결 자료: '+selected.map(reference=>reference.path).join(', ')
      :'폴더에서 자료를 체크하거나 파일을 첨부하세요.';
    const scope=options.scope();
    const chips=options.attachments(scope).map(attachment=>{
      const chip=options.button(attachment.file.name+' ×',()=>options.removeAttachment(scope,attachment.id));
      chip.className='attachment-chip';
      chip.title='임시 참고 첨부 제거: '+attachment.file.name;
      return chip;
    });
    target.replaceChildren(line,...chips);
  }

  async function renderFolders(){
    const container=$('folder-tree');
    const scope=options.scope();
    const version=++treeVersion;
    const isCurrent=()=>{
      const current=options.scope();
      return version===treeVersion&&scope.workspaceId===current.workspaceId&&scope.chatId===current.chatId;
    };
    const folders=options.folders(scope.workspaceId);
    container.replaceChildren();

    function selection(reference:Reference,label:string){
      const checkbox=document.createElement('input');
      checkbox.type='checkbox';
      checkbox.title=label;
      checkbox.checked=options.selected().some(item=>item.id===reference.id);
      checkbox.onchange=()=>{
        if(isCurrent())options.choose(checkbox.checked,reference);
      };
      return checkbox;
    }

    async function renderEntries(directory:FileSystemDirectoryHandle,parent:HTMLElement,path:string,rootId:string){
      const entries:[string,FileSystemDirectoryHandle|FileSystemFileHandle][]=[];
      for await(const entry of (directory as FileSystemDirectoryHandle&DirectoryEntries).entries()){
        if(!isCurrent()||parent.hidden)return;
        if(entries.length>=1000)throw new Error('한 폴더의 표시는 1,000개로 제한됩니다. 하위 폴더를 연결해 주세요.');
        entries.push(entry);
      }
      if(!isCurrent()||parent.hidden)return;
      entries.sort(([leftName,left],[rightName,right])=>
        Number(right.kind==='directory')-Number(left.kind==='directory')||leftName.localeCompare(rightName,'ko'));

      const rows=document.createDocumentFragment();
      for(const [name,handle] of entries){
        const childPath=path+'/'+name;
        const child={id:rootId+'/'+childPath,workspaceId:scope.workspaceId,rootId,path:childPath,handle};
        const row=document.createElement('div');
        row.className='folder-row';
        row.append(selection(child,'참고 자료 지정'));
        if(handle.kind==='directory'){
          const {label,children}=directoryRow(name,handle as FileSystemDirectoryHandle,childPath,rootId,false);
          label.className='file-label';
          label.title=childPath;
          row.append(label);
          rows.append(row,children);
          continue;
        }
        const label=options.button(name,async()=>{
          if(!isCurrent())return;
          if(/\.(hwp|hwpx)$/i.test(name))await options.openFile(handle as FileSystemFileHandle);
          else options.status('이 파일은 참고 자료로 체크할 수 있습니다. 문서 편집기는 HWP/HWPX만 엽니다.');
        });
        label.className='file-label';
        label.title=childPath;
        row.append(label);
        rows.append(row);
      }
      parent.replaceChildren(rows);
    }

    function directoryRow(name:string,handle:FileSystemDirectoryHandle,path:string,rootId:string,checkPermission:boolean){
      const children=document.createElement('div');
      children.className='folder-children';
      children.hidden=true;
      let loading=false;
      const label=options.button('▸ '+name,async()=>{
        if(!isCurrent()||loading)return;
        if(!children.hidden){
          children.hidden=true;
          label.setAttribute('aria-expanded','false');
          return;
        }
        loading=true;
        try{
          if(checkPermission){
            const granted=await permission(handle,true);
            if(!isCurrent())return;
            if(!granted)throw new Error('폴더 접근 권한이 없습니다. 다시 연결해 주세요.');
          }
          children.hidden=false;
          children.replaceChildren();
          label.setAttribute('aria-expanded','true');
          await renderEntries(handle,children,path,rootId);
        }catch(error){
          if(!isCurrent())return;
          children.replaceChildren();
          children.hidden=true;
          label.setAttribute('aria-expanded','false');
          if(error instanceof DOMException){
            throw new Error('폴더를 읽을 수 없습니다. 위치와 접근 권한을 확인하거나 다시 연결해 주세요.',{cause:error});
          }
          throw error;
        }finally{loading=false;}
      });
      label.setAttribute('aria-expanded','false');
      return {label,children};
    }

    if(!folders.length){
      const hint=document.createElement('p');
      hint.className='hint';
      hint.textContent='로컬 폴더를 연결해 자료를 탐색하세요.';
      container.append(hint);
      return;
    }
    for(const folder of folders){
      if(!isCurrent())return;
      const root=document.createElement('div');
      root.className='folder-root';
      const row=document.createElement('div');
      row.className='folder-row';
      const {label,children}=directoryRow(folder.name,folder.handle,folder.name,folder.id,true);
      const disconnect=options.button('해제',()=>{if(isCurrent())return options.disconnect(folder);});
      row.append(selection({id:folder.id,workspaceId:scope.workspaceId,rootId:folder.id,path:folder.name,handle:folder.handle},
        '폴더를 이번 요청 참고 자료로 지정'),label,disconnect);
      root.append(row,children);
      container.append(root);
      if(!await permission(folder.handle).catch(()=>false)&&isCurrent()){
        const note=document.createElement('div');
        note.className='folder-warning';
        note.textContent='폴더 이름을 눌러 접근 권한을 다시 확인하세요.';
        root.append(note);
      }
    }
  }

  return {renderSummary,renderFolders};
}
