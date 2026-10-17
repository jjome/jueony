import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine,hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';
const e=await loadReviewEngine(resolve('build/rhwp-engine/source-ad6186043c15532f/pkg')),d=e.HwpDocument.createEmpty();
try{d.createBlankDocument();d.insertText(0,0,0,'본문');d.createHeaderFooter(0,true,2);d.insertTextInHeaderFooter(0,true,2,0,0,'머😀리말');const rawStory=d.getSessionStoryEvidence(JSON.stringify({kind:'header',section:0,applyTo:2}));assert.equal(JSON.parse(rawStory).complete,true);await writeFile(resolve('build/session-font-provenance-closure84/legacy-v1-raw-wire83.json'),JSON.stringify({engine:e.metadata,rawStorySha256:hash(Buffer.from(rawStory)),rawStory,scope:'Actual old83 Rust JSON string retained exactly, including numeric spelling. It is not parsed/re-serialized before Native comparison.'},null,2),{flag:'wx'});}finally{d.free();}
