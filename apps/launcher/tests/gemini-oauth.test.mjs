import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {createGeminiOAuth,geminiOAuthEndpoint} from '../services/gemini-oauth.mjs';
import {createModelService} from '../services/model-service.mjs';
import {createGemini} from '../providers/gemini.mjs';
import {createEndpointPolicy} from '../providers/endpoint-policy.mjs';

const desktop={clientId:'123-fixture.apps.googleusercontent.com',clientSecret:'fixture-secret',project:'fixture-project'};
const config={id:'google-fixture',adapterId:'gemini',label:'Fixture Gemini',endpoint:geminiOAuthEndpoint,modelId:'gemini-fixture'};
const credentials={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,token_type:'Bearer'};
const settle=async read=>{
 for(let i=0;i<40;i++){
  const result=await read();
  if(result&&result.status!=='pending')return result;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 throw Error('The local callback did not settle');
};

test('Google desktop flow compares state and PKCE, encryptable credentials never appear in launcher responses, and the saved account refreshes after restart',async t=>{
 const requests=[];
 const calls=[];
 let stored=[];
 const store={available:true,load:async()=>structuredClone(stored),save:async records=>{stored=structuredClone(records);},clear:async()=>{stored=[];}};
 const registry=new Map([['gemini',(config,key,authorization)=>({async generate(_input,signal){
  calls.push(authorization?await authorization(signal):{'x-goog-api-key':key});return {operations:[]};
 }})]]);
 const request=async(url,{body,redirect})=>{
  assert.equal(redirect,'error');
  requests.push({url,body:Object.fromEntries(body)});
  if(url.endsWith('/revoke'))return new Response(null,{status:200});
  if(body.get('grant_type')==='refresh_token')return Response.json({...credentials,access_token:'refreshed-access',refresh_token:'rotated-refresh'});
  return Response.json(credentials);
 };
 const geminiOAuth=createGeminiOAuth({...desktop,request});t.after(()=>geminiOAuth.cancel());
 const models=await createModelService({registry,connectionStore:store,geminiOAuth});
 assert.equal(models.connections().geminiOAuth,true);
 await assert.rejects(models.beginGeminiOAuth({config:{...config,endpoint:'https://example.com'}}),/공식 Gemini/u);
 const {id,url}=await models.beginGeminiOAuth({config,remember:true});
 assert.doesNotMatch(JSON.stringify({id,url}),/fixture-secret/u);
 const link=new URL(url),params=link.searchParams;
 assert.equal(link.origin,'https://accounts.google.com');
 assert.equal(params.get('code_challenge_method'),'S256');
 assert.equal(params.get('scope'),'https://www.googleapis.com/auth/generative-language.retriever');
 const callback=new URL(params.get('redirect_uri'));
 assert.equal(callback.hostname,'127.0.0.1');
 callback.search=new URLSearchParams({code:'fake-code',state:'wrong-state'});
 assert.equal((await fetch(callback)).status,400);
 callback.search=new URLSearchParams({code:'fake-code',state:'한'.repeat(43)});
 assert.equal((await fetch(callback)).status,400);
 assert.equal(requests.length,0);
 assert.deepEqual(await models.finishGeminiOAuth(id),{status:'pending'});
 callback.search=new URLSearchParams({code:'fake-code',state:params.get('state')});
 const reply=await fetch(callback,{redirect:'manual'});
 assert.equal(reply.status,303);assert.equal(reply.headers.get('location'),'/done');
 await settle(()=>models.finishGeminiOAuth(id));
 assert.equal(requests[0].url,'https://oauth2.googleapis.com/token');
 assert.equal(requests[0].body.redirect_uri,params.get('redirect_uri'));
 assert.equal(createHash('sha256').update(requests[0].body.code_verifier).digest('base64url'),params.get('code_challenge'));
 await assert.rejects(models.finishGeminiOAuth(id),/다시 시작/u);
 assert.equal(stored[0].oauth.refresh,'fixture-refresh');
 assert.doesNotMatch(JSON.stringify(stored),/fixture-access|fixture-secret/u);
 assert.equal(models.connections().connections[0].auth,'gemini-oauth');
 assert.doesNotMatch(JSON.stringify(models.connections()),/fixture-access|fixture-refresh|fixture-secret/u);
 const signal=AbortSignal.timeout(1000);
 await models.generate(config.id,{},signal);
 assert.deepEqual(calls[0],{Authorization:'Bearer fixture-access','x-goog-user-project':desktop.project});
 const restarted=await createModelService({registry,connectionStore:store,geminiOAuth});
 await Promise.all([restarted.generate(config.id,{},signal),restarted.generate(config.id,{},signal)]);
 assert.equal(requests.filter(req=>req.body.grant_type==='refresh_token').length,1);
 assert.deepEqual(calls[1],{Authorization:'Bearer refreshed-access','x-goog-user-project':desktop.project});
 assert.equal(stored[0].oauth.refresh,'rotated-refresh');
 await restarted.removeConnection(config.id);
 assert.deepEqual(requests.at(-1),{url:'https://oauth2.googleapis.com/revoke',body:{token:'rotated-refresh'}});
 assert.deepEqual(stored,[]);
});

test('Google authentication denies network policy and rejects cancelled, denied and expired callbacks',async t=>{
 const blocked=createGeminiOAuth({...desktop,checkEndpoint:createEndpointPolicy('["https://generativelanguage.googleapis.com"]')});
 assert.equal(blocked.available,false);
 await assert.rejects(blocked.begin(config,false),/허용한 모델/u);
 let clock=0;
 const oauth=createGeminiOAuth({...desktop,request:()=>{assert.fail('No token exchange expected');},now:()=>clock,ttl:10_000});
 t.after(()=>oauth.cancel());
 const cancelled=await oauth.begin(config,false);
 oauth.cancel(cancelled.id);
 assert.throws(()=>oauth.take(cancelled.id),/다시 시작/u);
 const expired=await oauth.begin(config,false);
 clock=10_001;
 assert.throws(()=>oauth.take(expired.id),/다시 시작/u);
 const denied=await oauth.begin(config,false);
 const prompt=new URL(denied.url);
 const callback=new URL(prompt.searchParams.get('redirect_uri'));
 callback.search=new URLSearchParams({error:'access_denied',state:prompt.searchParams.get('state')});
 assert.equal((await fetch(callback,{redirect:'manual'})).status,303);
 assert.throws(()=>oauth.take(denied.id),/다시 시작/u);
});

test('Gemini uses bearer and quota project for doc-free probes and binds OAuth headers to the official model endpoint',async t=>{
 const headers={Authorization:'Bearer test-access','x-goog-user-project':'fixture-project'};
 assert.throws(()=>createGemini({...config,endpoint:'https://example.com/v1beta'},undefined,()=>headers),/공식 Gemini/u);
 const model=createGemini(config,undefined,()=>headers);
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url.href,`${geminiOAuthEndpoint}/models/gemini-fixture:generateContent`);
  assert.equal(options.redirect,'error');
  assert.equal(options.headers['x-goog-api-key'],undefined);
  assert.equal(options.headers.Authorization,headers.Authorization);
  assert.equal(options.headers['x-goog-user-project'],headers['x-goog-user-project']);
  const body=JSON.parse(options.body);
  const input=JSON.parse(body.contents[0].parts[0].text);
  assert.deepEqual(input.paragraphs,[{id:'jueony_probe',editable:false}]);
  return Response.json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{functionCall:{name:'read_paragraph',args:{id:'jueony_probe'}}}]}}]});
 });
 assert.deepEqual(await model.testDocumentTools(undefined,AbortSignal.timeout(1000)),{supported:true});
});
