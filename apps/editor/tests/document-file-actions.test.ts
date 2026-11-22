import assert from 'node:assert/strict';
import test from 'node:test';
import {createDocumentFileActions} from '../src/composition/document-file-actions.ts';

function fixture() {
  const events: string[]=[];
  const file=new File([Uint8Array.of(11,22)],'fixture.hwp');
  const handle={
    async isSameEntry(other: FileSystemFileHandle){return other===handle;},
    async getFile(){events.push('read');return file;},
  } as FileSystemFileHandle;
  let workspace='first';
  let permission=async()=>true;
  let save=async()=> 'saved';
  const tab={workspaceId:workspace,closed:false,initialized:true,handle:undefined as FileSystemFileHandle|undefined,api:{
    fileHandle:()=>tab.handle??null,
    async open(bytes: Uint8Array,name:string,source?:FileSystemFileHandle){
      assert.deepEqual([...bytes],[11,22]);
      assert.equal(name,file.name);
      assert.equal(source,handle);
      events.push('open');
    },
    save:()=>save(),
  }};
  const tabs: (typeof tab)[]=[];
  let active:typeof tab|undefined;
  const actions=createDocumentFileActions({currentWorkspace:()=>workspace,tabs:()=>tabs,activeTab:()=>active,
    allowOpen:()=>true,allowSave:()=>true,permission:()=>permission(),select:selected=>{active=selected;events.push('select');},
    async create(){tabs.push(tab);active=tab;events.push('create');return tab;},
    async persist(){events.push('persist');},status:message=>events.push(message),
  });
  return {actions,handle,tab,tabs,events,changeWorkspace:()=>{workspace='second';active=undefined;},
    setPermission(value:typeof permission){permission=value;},setSave(value:typeof save){save=value;}};
}

test('the selected file stays bound and reopening it selects the same document tab',async()=>{
  const f=fixture();
  await f.actions.openBound(f.handle);
  assert.equal(f.tab.handle,f.handle);
  await f.actions.openBound(f.handle);
  assert.deepEqual(f.events,['read','create','open','persist','문서를 열었습니다.','select']);
});

test('a workspace switch while permission or a picker is pending prevents opening into the new workspace',async()=>{
  const f=fixture();
  f.setPermission(async()=>{f.changeWorkspace();return true;});
  await f.actions.openBound(f.handle);
  await f.actions.openBound(f.handle,'first');
  assert.deepEqual(f.events,[]);
});

test('manual save keeps the conflict message with the document that completed the save',async()=>{
  const f=fixture();
  await f.actions.openBound(f.handle);
  f.events.length=0;
  f.setSave(async()=> 'source-conflict');
  await f.actions.saveActive();
  assert.deepEqual(f.events,['persist','다른 프로그램에서 원본 파일을 변경했습니다. 다른 이름으로 저장하거나 원본을 다시 열어 주세요.']);
  f.events.length=0;
  f.setSave(async()=>{f.changeWorkspace();return 'saved';});
  await f.actions.saveActive();
  assert.deepEqual(f.events,['persist']);
});
