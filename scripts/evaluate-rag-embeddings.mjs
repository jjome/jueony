import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

function runEmbeddings(python,assets,input){
  return new Promise((resolve,reject)=>{
    const runner=fileURLToPath(new URL('./evaluate-rag-embeddings.py',import.meta.url));
    const child=spawn(python,['-B',runner,assets],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='',errors='';
    child.stdout.setEncoding('utf8').on('data',chunk=>{output+=chunk;});
    child.stderr.setEncoding('utf8').on('data',chunk=>{errors+=chunk;});
    child.on('error',reject);
    child.stdin.on('error',reject);
    child.on('close',code=>{
      if(code!==0){reject(new Error(`Local embedding evaluation exited with ${code}: ${errors.trim()}`));return;}
      try{resolve(JSON.parse(output));}catch(error){reject(error);}
    });
    child.stdin.end(JSON.stringify(input));
  });
}

function fusion(lexical,semantic){
  if(!lexical.length)return [];
  const scores=new Map();
  for(const ranking of [lexical,semantic])ranking.forEach((id,index)=>scores.set(id,(scores.get(id)??0)+1/(61+index)));
  return [...scores.keys()].sort((left,right)=>scores.get(right)-scores.get(left)||left.localeCompare(right));
}

function selectChunks(ranking,chunks){
  const selected=[],counts=new Map();
  let characters=0;
  for(const id of ranking){
    if(selected.length>=8)break;
    const chunk=chunks.get(id),count=counts.get(chunk.sourceId)??0;
    if(count===3||characters+chunk.text.length>8000)continue;
    selected.push(chunk);counts.set(chunk.sourceId,count+1);characters+=chunk.text.length;
  }
  return selected;
}

function quality(ids,query){
  const chunks=selectChunks(ids,query.chunks);
  const sources=[...new Set(chunks.map(chunk=>query.idToDoc.get(chunk.sourceId)))];
  assert(sources.every(Boolean),'Candidate returned a source outside the selected case');
  const rank=sources.findIndex(id=>query.expectedDocs.includes(id));
  const normalize=text=>text.normalize('NFKC').replace(/[\s,]/gu,'');
  const authority=chunks.filter(chunk=>query.expectedDocs.includes(query.idToDoc.get(chunk.sourceId))).map(chunk=>chunk.text).join('\n');
  return {firstSource:sources[0]??null,rank,sourceCount:sources.length,
    answerSpanRecall:query.expectedEvidence.length?query.expectedEvidence.filter(span=>normalize(authority).includes(normalize(span))).length/query.expectedEvidence.length:null};
}

export async function evaluateEmbeddingRanking(cases,python,assets){
  assert(python&&assets,'Set JUEONY_RAG_PYTHON and JUEONY_RAG_EMBEDDING_ASSETS for offline comparison');
  const passages=Object.fromEntries(cases.flatMap(item=>[...item.chunks.values()].map(chunk=>[chunk.id,`${chunk.name}\n${chunk.text}`])));
  const {queries,...model}=await runEmbeddings(python,assets,{passages,queries:cases.map(item=>({id:item.id,text:item.query,allowed:[...item.chunks.keys()]}))});
  assert.equal(queries.length,cases.length);
  const results=cases.map((item,index)=>{
    const {id,ranked,milliseconds}=queries[index];
    assert.equal(id,item.id);
    assert.equal(ranked.length,item.chunks.size);
    assert.equal(new Set(ranked).size,ranked.length);
    assert(ranked.every(id=>item.chunks.has(id)),'Embedding search returned a chunk outside the selected case');
    const start=performance.now(),hybrid=fusion(item.bm25,ranked),fusionMs=performance.now()-start;
    return {id,noAnswer:item.expectedDocs.length===0,
      bm25:{...quality(item.bm25,item),milliseconds:item.bm25Milliseconds},
      embedding:{...quality(ranked,item),milliseconds},
      hybrid:{...quality(hybrid,item),milliseconds:item.bm25Milliseconds+milliseconds+fusionMs}};
  });
  const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  const summary=Object.fromEntries(['bm25','embedding','hybrid'].map(method=>{
    const answerable=results.filter(item=>!item.noAnswer).map(item=>item[method]);
    return [method,{
      sourceHitAt1:average(answerable.map(item=>Number(item.rank===0))),
      sourceHitAt8:average(answerable.map(item=>Number(item.rank>=0&&item.rank<8))),
      meanReciprocalRank:average(answerable.map(item=>item.rank<0?0:1/(item.rank+1))),
      answerSpanRecall:average(answerable.map(item=>item.answerSpanRecall).filter(value=>value!==null)),
      unanswerableFalsePositiveQueries:results.filter(item=>item.noAnswer&&item[method].sourceCount>0).length,
      meanSearchMilliseconds:average(results.map(item=>item[method].milliseconds)),
    }];
  }));
  return {model,summary,results,selection:'Same selected chunks. Fusion uses reciprocal ranks (constant 60) and requires at least one BM25 hit. Embedding-only has no abstention threshold.'};
}
