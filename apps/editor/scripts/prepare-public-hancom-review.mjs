import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capturePreservationEvidence,verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {absolutePath,loadReviewEngine,hash,snapshot,compareSnapshots,writeJSON,ensureNewOutputDirectory} from './lib/hancom-review.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url)),out=await ensureNewOutputDirectory(process.env.JUEONY_TEST_OUTPUT),engine=await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const sources=JSON.parse(await readFile(join(root,'.tools/public-documents/manifest.json'),'utf8')),cases=[['mcst-bid-2026','hwpx'],['python-hwpx-0','hwp'],['python-hwpx-1','hwp'],['python-hwpx-3','hwp']];
const manifest={createdAt:new Date().toISOString(),engine:engine.metadata,enginePackage:engine.pkg,redistribution:'PUBLIC ORIGINALS AND DERIVATIVES MUST REMAIN IGNORED. Do not add these documents, snapshots containing document text, or derived binaries to Git or product distribution.',cases:[],failures:[],verifierSha256:hash(await readFile(new URL(import.meta.url))),helperSha256:hash(await readFile(new URL('./lib/hancom-review.mjs',import.meta.url))),externalCompareVerifierSha256:hash(await readFile(new URL('./compare-hancom-file.mjs',import.meta.url)))};
async function writeUnchangedOrNew(path,bytes){try{const existing=await readFile(path);if(hash(existing)!==hash(bytes))throw Error('Refusing to overwrite different existing review file: '+path);return;}catch(error){if(error.code!=='ENOENT')throw error;}await writeFile(path,bytes,{flag:'wx'});}
for(const [id,format] of cases){
 let doc,reopened;
 try{
  const source=sources.find(value=>value.id===id&&value.status==='downloaded');if(!source)throw Error('Downloaded manifest entry absent: '+id);
  const input=absolutePath(resolve(root,source.localFile),'input'),bytes=await readFile(input);if(hash(bytes)!==source.sha256)throw Error('Input SHA mismatch: '+id);
  doc=new engine.HwpDocument(bytes);const before=snapshot(doc),beforeLive=capturePreservationEvidence(doc),artifact=format==='hwp'?doc.exportHwpWithReport():doc.exportHwpxWithReport();let output,loss;
  try{loss=JSON.parse(artifact.contentLoss());output=artifact.takeBytes();}finally{artifact.free();}
  const strict=verifyPreservedExport(doc,output,format,loss,value=>new engine.HwpDocument(value));if(strict.status!=='checked')throw Error('Strict export not checked');
  if(JSON.stringify(capturePreservationEvidence(doc))!==JSON.stringify(beforeLive))throw Error('Strict export mutated live semantic state');
  reopened=new engine.HwpDocument(output);const after=snapshot(reopened),sourceCopy=join(out,'source-'+id+'.'+source.format),target=join(out,id+'-'+format+'.'+format),expectedHancom=join(out,id+'-'+format+'-hancom.'+format);
  await writeUnchangedOrNew(sourceCopy,bytes);await writeUnchangedOrNew(target,output);
  await writeJSON(join(out,id+'-source-snapshot.json'),before);await writeJSON(join(out,id+'-'+format+'-snapshot.json'),after);
  const conversionComparison=compareSnapshots(before,after);await writeJSON(join(out,id+'-'+format+'-conversion-comparison.json'),conversionComparison);
  manifest.cases.push({id,format,title:source.title,sourceUrl:source.url,sourcePage:source.page,input,sourceCopy,inputSha256:source.sha256,inputBytes:bytes.length,output:target,outputSha256:hash(output),outputBytes:output.length,expectedHancom,strictReport:strict,serializerLossReport:loss,sourcePages:before.pages,outputPages:after.pages,conversionSemanticDifferences:conversionComparison.semantic.count,conversionGeometryDifferences:conversionComparison.geometry.count,geometryTolerance:0.2,originalSnapshot:join(out,id+'-source-snapshot.json'),outputSnapshot:join(out,id+'-'+format+'-snapshot.json')});
  console.log('PREPARED',id,'->',format,'strict='+strict.status,'pages='+before.pages+'/'+after.pages,'geometryDifferences='+conversionComparison.geometry.count);
 }catch(error){manifest.failures.push({id,format,error:String(error),...(error.report?{strictReport:error.report}:{})});console.error('FAILED',id,'->',format,String(error).slice(0,300));}
 finally{reopened?.free();doc?.free();}
}
await writeJSON(join(out,'manifest.json'),manifest);if(manifest.failures.length)process.exitCode=1;
