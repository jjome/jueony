import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {loadReviewEngine,hash,writeJSON} from '../../apps/editor/scripts/lib/hancom-review.mjs';
const out=resolve('build/document-metadata-final68/unsafe-summary-diff');await mkdir(out,{recursive:true});
const old=await loadReviewEngine(resolve('build/rhwp-engine/source-8deeb52a09ba2b75/pkg')),current=await loadReviewEngine(resolve('build/rhwp-engine/source-cda65172283c6657/pkg'));
const input=await readFile(resolve('build/outer-native-candidate48/permanent-staging/fixtures/outer-hwpx.hwpx')),results=[];
for(const[name,alter]of[['protected-cell',d=>d.setCellProperties(0,1,0,0,'{"cellProtect":true}')],['field-cell',d=>d.setCellProperties(0,1,0,0,'{"fieldName":"source"}')],['object-lock',d=>d.setControlLock(1,0,true)],['row-break',d=>d.setTableProperties(0,1,0,'{"pageBreak":2}')]]){
 const a=new old.HwpDocument(input),b=new current.HwpDocument(input);
 try{alter(a);alter(b);const before=a.exportHwp(),after=b.exportHwp();await writeFile(join(out,name+'-baseline63.hwp'),before);await writeFile(join(out,name+'-formal68.hwp'),after);results.push({name,inputSha256:hash(input),beforeSha256:hash(before),afterSha256:hash(after),beforeBytes:before.length,afterBytes:after.length,sameWholeBytes:Buffer.from(before).equals(Buffer.from(after)),currentMetadata:JSON.parse(b.getDocumentMetadata()).values});}finally{a.free();b.free();}
}
await writeJSON(join(out,'generated.json'),{results,baseline:old.metadata,current:current.metadata,scope:'Exact same self-authored HWPX source and four unsafe alterations as the production G073 verifier. Original pkg and source fixtures unchanged.'});console.log(results.map(r=>[r.name,r.sameWholeBytes,r.beforeBytes,r.afterBytes]));
