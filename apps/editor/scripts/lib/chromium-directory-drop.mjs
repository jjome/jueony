import assert from 'node:assert/strict';
import {basename} from 'node:path';

// Obtain a real browser handle for an isolated Windows fixture without using
// the user's profile or modifying Chromium permission settings.
export async function supplyDirectoryToPicker(page,path){
  await page.evaluate(()=>{
    const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
    const events=new AbortController();
    document.addEventListener('dragenter',stop,{capture:true,signal:events.signal});
    document.addEventListener('dragover',stop,{capture:true,signal:events.signal});
    window.nativeTestFolder=new Promise((resolve,reject)=>{
      document.addEventListener('drop',event=>{
        stop(event);
        const item=event.dataTransfer.items[0];
        events.abort();
        if(!item)reject(Error('No dropped folder was supplied'));
        else resolve(item.getAsFileSystemHandle());
      },{capture:true,signal:events.signal});
    });
  });
  const point=await page.$eval('#folder-tree',tree=>{
    const rect=tree.getBoundingClientRect();
    return {x:Math.floor(rect.left)+3,y:Math.floor(rect.top)+3};
  });
  const cdp=await page.createCDPSession();
  try{
    const data={items:[],files:[path],dragOperationsMask:1};
    for(const type of ['dragEnter','dragOver','drop'])await cdp.send('Input.dispatchDragEvent',{type,...point,data});
  }finally{await cdp.detach();}
  const result=await page.evaluate(async()=>{
    const handle=await Promise.race([window.nativeTestFolder,new Promise((_,reject)=>setTimeout(()=>reject(Error('Folder drop was not delivered')),4000))]);
    if(handle?.kind!=='directory')throw Error('Windows directory handle was not received');
    window.nativeTestHandles??={};
    window.nativeTestHandles[handle.name]=handle;
    window.showDirectoryPicker=async options=>{
      if(options.mode!=='read')throw Error('Expected read-only folder access');
      return handle;
    };
    return {name:handle.name,permission:await handle.queryPermission({mode:'read'})};
  });
  assert.deepEqual(result,{name:basename(path),permission:'granted'});
}
