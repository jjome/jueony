import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {strFromU8,unzipSync} from 'fflate';
import {createInstitutionReviewBundle} from '../src/adapters/files/institution-review-bundle.ts';

test('a review archive stores only the selected document and attachments with verifiable original byte digests',async()=>{
 const document={name:'검토 공문.hwpx',bytes:new Uint8Array([5,6,7])};
 const attachments=[new File(['보존할 내용'],'현황.txt')];
 const result=await createInstitutionReviewBundle(document,attachments,'첨부 확인');
 const files=unzipSync(result.archive),manifest=JSON.parse(strFromU8(files['검토 기록.json']));
 assert.deepEqual(Object.keys(files).sort(),['검토 기록.json','본문/검토 공문.hwpx','붙임/현황.txt'].sort());
 assert.equal(manifest.status,'draft');
 assert.equal(manifest.notes,'첨부 확인');
 assert.deepEqual(files[manifest.document.path],document.bytes);
 for(const entry of [manifest.document,...manifest.attachments]){
  assert.equal(entry.sha256,createHash('sha256').update(files[entry.path]).digest('hex'));
  assert.equal(entry.bytes,files[entry.path].length);
 }
 await assert.rejects(createInstitutionReviewBundle(document,[new File(['a'],'../escape.txt')],''),/파일 이름/u);
 await assert.rejects(createInstitutionReviewBundle(document,[new File(['a'],'자료.txt'),new File(['b'],'자료.TXT')],''),/이름이 같은/u);
 await assert.rejects(createInstitutionReviewBundle(document,attachments,'',AbortSignal.abort()),/aborted/iu);
});
