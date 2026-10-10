import type { ModelConfig, Snapshot, Source, Message } from './model.ts';
export type LLMInput={request:string; document:Snapshot; references:Source[]; history:Message[]};
export interface LLMPort {generate(input:LLMInput,model:ModelConfig,signal:AbortSignal):Promise<unknown>;}
export class LocalLLMPort implements LLMPort {
 private token='';
 async connect(){const r=await fetch('/api/session',{headers:{'X-Jueony-Bootstrap':'1'}});if(!r.ok)throw new Error('새 Jueony 실행기로 다시 시작해야 AI 연결을 사용할 수 있습니다.');this.token=(await r.json()).token;}
 async call(path:string,body:unknown,signal?:AbortSignal){if(!this.token)await this.connect();const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Jueony-Token':this.token},body:JSON.stringify(body),signal});const result=await r.json();if(!r.ok)throw new Error(result.error??'AI 연결 실패');return result;}
 async testConnection(config:ModelConfig,key:string,signal?:AbortSignal){return this.call('test-connection',{config,key},signal);}
 async clearCredentials(){return this.call('clear-credentials',{});}
 async configure(config:ModelConfig,key:string){return this.call('configure',{config,key});}
 async generate(input:LLMInput,config:ModelConfig,signal:AbortSignal){return (await this.call('generate',{configId:config.id,input},signal)).result;}
}
