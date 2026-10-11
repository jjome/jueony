import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { providerRegistry as registry } from './providers/registry.mjs';
import { createModelService } from './services/model-service.mjs';
import { createConnectionStore } from './connection-store.mjs';

const here=resolve(fileURLToPath(new URL('.',import.meta.url)));
const root=await realpath(process.env.JUEONY_DIST??join(here,'dist'));
const port=Number(process.env.JUEONY_PORT??4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
const origins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
const token=randomBytes(32).toString('hex');
const models=await createModelService({registry,connectionStore:createConnectionStore()});
const csp="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
function reply(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':csp,'Referrer-Policy':'no-referrer'});res.end(type==='application/json'?JSON.stringify(data):data);}
function caller(req){const origin=req.headers.origin;if(origin)return origins.has(origin);return req.headers['sec-fetch-site']==='same-origin'&&['cors','same-origin'].includes(req.headers['sec-fetch-mode']);}
function authorized(req){const supplied=req.headers['x-jueony-token'];return typeof supplied==='string'&&supplied.length===token.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(token));}
async function body(req){if(req.headers['content-type']!=='application/json')throw new Error('JSON 요청이 필요합니다.');let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>2_000_000)throw new Error('요청 크기 제한을 넘었습니다.');parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
const server=http.createServer({maxHeaderSize:16384,requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
 try{
  if(!hosts.has(req.headers.host)){reply(res,403,{error:'허용되지 않은 Host'});return;}
  const path=req.url?.split('?')[0]??'/';
  if(path==='/api/health'){reply(res,200,{application:'jueony',apiVersion:1,connectionStorageVersion:1,documentControlVersion:1,providerCatalogVersion:1});return;}
  if(path.startsWith('/api/')){
   if(!caller(req)){reply(res,403,{error:'앱 화면에서만 요청할 수 있습니다.'});return;}
   if(path==='/api/session'&&req.method==='GET'&&req.headers['x-jueony-bootstrap']==='1'){reply(res,200,{token,documentControlVersion:1,providerCatalogVersion:1});return;}
   if(req.method!=='POST'||!authorized(req)){reply(res,403,{error:'세션 인증이 필요합니다. 앱을 다시 열어 주세요.'});return;}
   const data=await body(req);
   if(path==='/api/connections'){reply(res,200,models.connections());return;}
   if(path==='/api/clear-credentials'){reply(res,200,await models.clearCredentials());return;}
   if(path==='/api/remove-connection'){reply(res,200,await models.removeConnection(data.configId));return;}
   if(path==='/api/configure'){reply(res,200,await models.configure(data));return;}
   if(path==='/api/generate'||path==='/api/test-connection'){
    const abort=new AbortController();res.on('close',()=>abort.abort());
    const result=path==='/api/test-connection'?await models.testConnection(data,abort.signal):await models.generate(data.configId,data.input,abort.signal);
    if(!res.destroyed)reply(res,200,result);return;
   }
   reply(res,404,{error:'없는 API'});return;
  }
  if(!['GET','HEAD'].includes(req.method)){reply(res,404,{error:'없는 경로'});return;}
  let decoded;try{decoded=decodeURIComponent(path);}catch{reply(res,404,{error:'잘못된 경로'});return;}
  if(!decoded.startsWith('/')||/[\\:\0]/.test(decoded)||decoded.split('/').some(p=>p==='..'||p==='.')){reply(res,404,{error:'잘못된 경로'});return;}
  let file;try{file=await realpath(join(root,decoded==='/'?'index.html':decoded.slice(1)));}catch{reply(res,404,{error:'파일 없음'});return;}
  if(!file.startsWith(root+sep)||!(await stat(file)).isFile()){reply(res,404,{error:'파일 없음'});return;}
  const bytes=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':csp,'Referrer-Policy':'no-referrer'});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch(error){if(!res.headersSent&&!res.destroyed)reply(res,error?.statusCode===429?429:400,{error:error?.safeMessage??(error instanceof SyntaxError?'잘못된 JSON 요청입니다.':'요청을 처리하지 못했습니다. 연결 설정과 자료 크기를 확인해 주세요.')});}
});
server.maxConnections=32;
server.listen(port,'127.0.0.1');
