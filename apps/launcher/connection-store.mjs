import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const storageError=()=>Object.assign(new Error('Windows 암호화 연결 저장소를 사용할 수 없습니다. 기존 파일을 보존했습니다. 평문으로 저장하지 않습니다.'),{safeMessage:'Windows 암호화 연결 저장소를 사용할 수 없습니다. 기존 파일을 보존했습니다. 평문으로 저장하지 않습니다.'});
function transform(mode,bytes){
 if(process.platform!=='win32')return Promise.reject(storageError());
 return new Promise((accept,reject)=>{
  const executable=join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const child=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./credential-protect.ps1',import.meta.url)),'-Mode',mode],{windowsHide:true,stdio:['pipe','pipe','ignore']});
  let output='',failed=false;
  const fail=()=>{failed=true;child.kill();reject(storageError());};
  const timer=setTimeout(fail,15000);
  child.on('error',()=>{clearTimeout(timer);fail();});child.stdin.on('error',()=>{});
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2_000_000)fail();});
  child.on('close',code=>{clearTimeout(timer);if(failed)return;if(code!==0||!output||!/^[A-Za-z0-9+/=\r\n]+$/.test(output)){reject(storageError());return;}accept(Buffer.from(output.trim(),'base64'));});
  child.stdin.end(bytes.toString('base64'));
 });
}
export const defaultConnectionPath=()=>process.env.JUEONY_CONNECTION_STORE==='memory'?null:(process.env.JUEONY_CONNECTION_STORE??(process.platform==='win32'&&process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'Jueony','connections.dpapi'):null));
export function createConnectionStore(path=defaultConnectionPath()){
 return {
  available:Boolean(path)&&process.platform==='win32',
  async load(){
   if(!path)return [];
   let bytes;try{bytes=await readFile(path);}catch(e){if(e.code==='ENOENT')return [];throw storageError();}
   if(bytes.length>1_000_000)throw storageError();
   let clear;try{clear=await transform('Unprotect',bytes);const data=JSON.parse(clear.toString('utf8'));if(data.version!==1||!Array.isArray(data.connections)||data.connections.length>64)throw storageError();return data.connections;}catch{throw storageError();}finally{clear?.fill(0);}
  },
  async save(connections){
   if(!path||connections.length>64)throw storageError();
   const clear=Buffer.from(JSON.stringify({version:1,connections}));let encrypted;
   try{if(clear.length>500_000)throw storageError();encrypted=await transform('Protect',clear);}finally{clear.fill(0);}
   const temporary=path+'.'+randomUUID()+'.tmp';
   try{await mkdir(dirname(path),{recursive:true});await writeFile(temporary,encrypted,{flag:'wx'});await rename(temporary,path);}catch{await unlink(temporary).catch(()=>{});throw storageError();}
  },
  async clear(){if(path)try{await unlink(path);}catch(e){if(e.code!=='ENOENT')throw storageError();}},
 };
}
