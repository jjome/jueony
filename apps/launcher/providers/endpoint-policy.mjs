const localHosts=new Set(['127.0.0.1','localhost','[::1]']);
const blocked=()=>Object.assign(new Error('기관에서 허용한 모델 서버 주소를 사용하세요.'),{
  safeMessage:'기관에서 허용한 모델 서버 주소를 사용하세요.',
});

export function createEndpointPolicy(configuration) {
  if(configuration===undefined)return ()=>{};
  let sources;
  try { sources=JSON.parse(configuration); }
  catch { throw new Error('허용 모델 서버를 JSON 주소 목록으로 입력하세요.'); }
  if(!Array.isArray(sources)||sources.length>50)throw new Error('허용 모델 서버를 50개 이하의 주소 목록으로 입력하세요.');
  const origins=new Set(sources.map(source=>{
    let url;
    try {if(typeof source!=='string'||source.length>256)throw new Error();url=new URL(source);}
    catch {throw new Error('허용 모델 서버에 완전한 주소를 입력하세요.');}
    if((url.protocol!=='https:'&&!(url.protocol==='http:'&&localHosts.has(url.hostname)))||url.username||url.password||
        url.pathname!=='/'||url.search||url.hash)throw new Error('허용 모델 서버에는 프로토콜·호스트·포트만 지정하세요.');
    return url.origin;
  }));
  return endpoint=>{
    let url;
    try { url=new URL(endpoint); } catch { throw blocked(); }
    if(url.username||url.password||!origins.has(url.origin))throw blocked();
  };
}

export function compileInstitutionEndpoints(entries){
 if(!Array.isArray(entries)||entries.length>32)throw new Error('기관 모델 주소는 최대 32개의 주소와 경로 항목으로 입력하세요.');
 const rules=entries.map(entry=>{
  if(!entry||typeof entry!=='object'||Object.keys(entry).length!==2||typeof entry.origin!=='string'||typeof entry.pathPrefix!=='string')throw blocked();
  let origin;
  try{origin=new URL(entry.origin);}catch{throw blocked();}
  const path=entry.pathPrefix.replace(/\/+$/u,'')||'/';
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||
     entry.origin.includes('*')||entry.pathPrefix.length>240||!entry.pathPrefix.startsWith('/')||
     !/^\/[a-zA-Z0-9._/-]*$/u.test(path)||path.split('/').some(part=>part==='.'||part==='..')||path.includes('//'))throw blocked();
  return {origin:origin.origin,path};
 });
 if(new Set(rules.map(rule=>rule.origin+rule.path)).size!==rules.length)throw blocked();
 return endpoint=>{
  let url;
  try{url=new URL(endpoint);}catch{return false;}
  if(url.protocol!=='https:'||url.username||url.password||url.hash||/%(?:2f|5c|25)/iu.test(url.pathname))return false;
  return rules.some(rule=>rule.origin===url.origin&&(rule.path==='/'||url.pathname===rule.path||url.pathname.startsWith(rule.path+'/')));
 };
}
