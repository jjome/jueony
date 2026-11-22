import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';

const address='127.0.0.1';
const callback='/gemini/callback';
const scope='https://www.googleapis.com/auth/generative-language.retriever';
const authorizeURL='https://accounts.google.com/o/oauth2/v2/auth';
const tokenURL='https://oauth2.googleapis.com/token';
const revokeURL='https://oauth2.googleapis.com/revoke';
export const geminiOAuthEndpoint='https://generativelanguage.googleapis.com/v1beta';
const loginFailure='Google 인증을 확인할 수 없습니다. 연결 설정에서 브라우저 인증을 다시 시작해 주세요.';
const issue=message=>Object.assign(new Error(message),{safeMessage:message});
const nonce=()=>randomBytes(32).toString('base64url');
const safeToken=value=>typeof value==='string'&&value.length>0&&value.length<=8192&&/^[\x21-\x7e]+$/u.test(value);

export function createGeminiOAuth({clientId,clientSecret,project,checkEndpoint,request=fetch,now=Date.now,ttl=180_000}={}){
 const registered=typeof clientId==='string'&&/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/u.test(clientId)
  &&safeToken(clientSecret)&&typeof project==='string'&&/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(project);
 let flow;
 const binding=registered?createHash('sha256').update(`${clientId}\n${project}`).digest('hex'):undefined;

 function checkGoogle(){
  if(!registered)throw issue('등록된 Google 데스크톱 앱과 Cloud 프로젝트가 필요합니다.');
  for(const url of [authorizeURL,tokenURL,revokeURL,geminiOAuthEndpoint])checkEndpoint?.(url);
 }
 async function googleRequest(url,params,signal){
  checkGoogle();
  try {
   return await request(url,{method:'POST',redirect:'error',body:new URLSearchParams(params),signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
  }catch{throw issue(loginFailure);}
 }
 async function exchange(fields,signal){
  const response=await googleRequest(tokenURL,{client_id:clientId,client_secret:clientSecret,...fields},signal);
  if(!response.ok)throw issue(loginFailure);
  const result=await response.json();
  if(!safeToken(result.access_token)||result.token_type?.toLowerCase()!=='bearer'||!Number.isInteger(result.expires_in)||result.expires_in<1||result.expires_in>86_400||
     (result.scope!==undefined&&(!result.scope.split(' ').includes(scope)||result.scope.split(' ').some(value=>value!==scope)))||
     (result.refresh_token!==undefined&&!safeToken(result.refresh_token)))throw issue(loginFailure);
  return {access:result.access_token,expiresAt:now()+result.expires_in*1000,refresh:result.refresh_token};
 }
 function cancel(id,discard=true){
  if(!flow||(id!==undefined&&flow.id!==id))return;
  const previous=flow;flow=undefined;
  previous.abort.abort();previous.server.close();clearTimeout(previous.timer);
  if(discard&&previous.tokens)void revoke(previous.tokens.refresh,AbortSignal.timeout(15000)).catch(()=>{});
 }
 async function begin(config,remember){
  checkGoogle();
  cancel();
  const id=nonce(),state=nonce(),verifier=nonce(),abort=new AbortController();
  const entry={id,config,remember,abort,status:'pending',expiresAt:now()+ttl};
  const server=createServer({maxHeaderSize:8192,requestTimeout:5000},async(req,res)=>{
   const write=(status,text,location)=>{
    res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
      'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...(location?{Location:location}:{})});
    res.end(text);
   };
   if(req.method!=='GET'||req.headers.host!==`${address}:${server.address()?.port}`||
      !(req.url==='/done'||req.url?.startsWith(callback+'?'))){
    write(400,'인증 요청을 확인할 수 없습니다.');return;
   }
   if(req.url==='/done'){write(200,'Jueony의 AI 연결 설정으로 돌아가 결과를 확인해 주세요.');return;}
   const url=new URL(req.url,redirect);
   const states=url.searchParams.getAll('state');
   if(flow!==entry||entry.status!=='pending'||now()>=entry.expiresAt||url.pathname!==callback||states.length!==1||
      states[0].length!==state.length||Buffer.byteLength(states[0])!==state.length||!timingSafeEqual(Buffer.from(states[0]),Buffer.from(state))){
    write(400,'인증 요청을 확인할 수 없습니다.');return;
   }
   const codes=url.searchParams.getAll('code'),code=codes.length===1&&codes[0];
   if(url.searchParams.has('error')||!safeToken(code)){
    entry.status='failed';write(303,'인증이 취소됐습니다.','/done');return;
   }
   entry.status='exchanging';
   write(303,'Jueony에서 인증 상태를 확인해 주세요.','/done');
   try {
    const tokens=await exchange({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:redirect},abort.signal);
    if(!tokens.refresh)throw issue(loginFailure);
    if(flow===entry&&!abort.signal.aborted){entry.tokens=tokens;entry.status='ready';}
   }catch{entry.status='failed';}
  });
  entry.server=server;server.maxConnections=8;
  let redirect;
  flow=entry;
  try {
   server.listen(0,address);await once(server,'listening');
   if(flow!==entry){server.close();throw issue(loginFailure);}
   redirect=`http://${address}:${server.address().port}${callback}`;
   entry.timer=setTimeout(()=>cancel(id),ttl);entry.timer.unref();
  }catch(error){cancel(id);throw error;}
  const url=new URL(authorizeURL);
  url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope,state,access_type:'offline',prompt:'consent',
   code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  return {id,url:url.href};
 }
 function take(id){
  if(!flow||flow.id!==id||now()>=flow.expiresAt)throw issue(loginFailure);
  if(flow.status==='pending'||flow.status==='exchanging')return;
  const {config,remember,tokens}=flow;cancel(id,false);
  if(!tokens)throw issue(loginFailure);
  return {config,remember,tokens};
 }
 async function revoke(refresh,signal){
  const response=await googleRequest(revokeURL,{token:refresh},signal);
  if(response.status===400){
   const result=await response.json().catch(()=>null);
   if(result?.error==='invalid_token')return;
  }
  if(!response.ok)throw issue('Google에서 인증을 철회할 수 없습니다. 연결을 유지했습니다.');
 }
 return {
  get available(){try{checkGoogle();return true;}catch{return false;}},binding,begin,take,cancel,
  async authorization(refresh,signal){
   return exchange({grant_type:'refresh_token',refresh_token:refresh},signal);
  },
  headers(access){return {Authorization:`Bearer ${access}`,'x-goog-user-project':project};},
  revoke,
 };
}
