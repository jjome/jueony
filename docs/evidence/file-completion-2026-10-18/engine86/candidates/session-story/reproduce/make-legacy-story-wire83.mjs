import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadReviewEngine} from '../../apps/editor/scripts/lib/hancom-review.mjs';
const e=await loadReviewEngine(resolve('build/rhwp-engine/source-ad6186043c15532f/pkg')),d=e.HwpDocument.createEmpty();
try{d.createBlankDocument();d.insertText(0,0,0,'본문');d.createHeaderFooter(0,true,2);d.insertTextInHeaderFooter(0,true,2,0,0,'머😀리말');const story=JSON.parse(d.getSessionStoryEvidence(JSON.stringify({kind:'header',section:0,applyTo:2})));assert.equal(story.complete,true);const fonts=story.context[0].host.characters[0].properties.fonts,paragraph=story.context[0].paragraphProperties;assert.ok(fonts.every(x=>!Object.hasOwn(x,'hwpx_type_origin')));assert.ok(!Object.hasOwn(paragraph,'hwpx_text_direction'));await writeFile(resolve('build/session-font-provenance-closure84/legacy-v1-wire83.json'),JSON.stringify({engine:e.metadata,fontResources:fonts,paragraphResource:paragraph,scope:'Own native blank-template header context. Actual pre-new-field formal83 WASM v1 wire; no fields removed or rewritten.'},null,2),{flag:'wx'});}finally{d.free();}
