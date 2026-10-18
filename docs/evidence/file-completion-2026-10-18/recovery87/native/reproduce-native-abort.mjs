import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createNativeFilePickers} from '../../apps/editor/src/adapters/desktop/native-host.ts';
const calls=[];
const pickers=createNativeFilePickers(async(command,args)=>{calls.push({command,args});if(command==='pick_save_document')return{token:'own-headless-fixture',name:'own.hwpx'};});
const handle=await pickers.showSaveFilePicker();
const writer=await handle.createWritable();
let release;
const source={arrayBuffer:()=>new Promise(resolve=>{release=resolve;})};
await writer.write(source);
const closing=writer.close();
assert.equal(typeof release,'function');
await writer.abort();
release(new Uint8Array([1,2,3]).buffer);
let closeError;try{await closing;}catch(error){closeError={name:error.name,message:error.message};}
const observed=calls.filter(x=>x.command==='write_document');
await writeFile(new URL('./native-abort-baseline.json',import.meta.url),JSON.stringify({status:observed.length?'GENUINE_ABORT_BEFORE_IPC_STILL_DISPATCHES_WRITE':'NO_WRITE_AFTER_ABORT',writes:observed.length,closed:!closeError,closeError,actualOSWrite:false,GUIExecuted:false},null,2));
assert.equal(observed.length,0,'Abort completed before bytes were ready; native write must not be dispatched afterward.');
