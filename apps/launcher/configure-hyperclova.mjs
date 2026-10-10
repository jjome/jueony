// Local opt-in provisioning. No API call; key never appears in arguments or logs.
import {createConnectionStore,defaultConnectionPath} from './connection-store.mjs';
import {createHyperCLOVA} from './providers/hyperclova.mjs';
const modelId=process.argv[2]??'HCX-005';
const config={id:'naver-service',adapterId:'hyperclova',label:'NAVER 서비스 · '+modelId,endpoint:'https://clovastudio.stream.ntruss.com/v3/chat-completions',modelId,maxOutputTokens:4096};
async function hiddenKey(){
 if(!process.stdin.isTTY||!process.stdin.setRawMode)throw new Error('Interactive terminal required.');
 console.log('Service API key input ready (hidden). Saves encrypted for this Windows account.');
 process.stdin.setEncoding('utf8');process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((accept,reject)=>{
  let value='';
  const finish=error=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();error?reject(error):accept(value.trim());};
  const onData=chunk=>{for(const c of chunk){if(c==='\u0003'){finish(new Error('Cancelled'));return;}if(c==='\r'||c==='\n'){finish();return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;if(value.length>8192){finish(new Error('Key too long'));return;}}};
  process.stdin.on('data',onData);
 });
}
let key='';
try{
 const store=createConnectionStore();if(!store.available)throw new Error('Windows encrypted storage unavailable.');
 const records=await store.load();key=await hiddenKey();createHyperCLOVA(config,key);
 const next=records.filter(r=>r.config?.id!==config.id);next.push({config,key});await store.save(next);
 const restored=await store.load();if(restored.find(r=>r.config.id===config.id)?.key!==key)throw new Error('Encrypted read-back mismatch.');
 console.log(JSON.stringify({saved:true,modelId,path:defaultConnectionPath(),restartServer:true}));
}catch(error){console.error(error.safeMessage??'Connection setup failed. Existing encrypted store was not intentionally cleared.');process.exitCode=1;}
finally{key='';}
