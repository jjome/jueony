import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url))),sha=x=>createHash('sha256').update(x).digest('hex');
for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),key);
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT);await mkdir(out,{recursive:true});
const metadata=JSON.parse(await readFile(join(pkg,'jueony-engine-build.json'),'utf8')),wasm=await readFile(join(pkg,'rhwp_bg.wasm')),js=await readFile(join(pkg,'rhwp.js'));
assert.equal(sha(wasm),metadata.wasmSha256);assert.equal(sha(js),metadata.jsSha256);
const module=await import(pathToFileURL(join(pkg,'rhwp.js')));await module.default({module_or_path:wasm});
const fixtures=join(root,'apps/editor/tests/fixtures/n001-general125-own'),manifest=JSON.parse(await readFile(join(fixtures,'manifest.json'),'utf8')),f=manifest.fixtures.find(f=>f.file==='unequal-three-offset.hwp');
assert.ok(f);const input=await readFile(join(fixtures,f.file));assert.equal(sha(input),f.sha256);
const d=new module.HwpDocument(input);
function body(){const sections=[];for(let section=0;section<d.getSectionCount();section++){const paragraphs=[];for(let paragraph=0;paragraph<d.getParagraphCount(section);paragraph++)paragraphs.push(d.getTextRange(section,paragraph,0,d.getParagraphLength(section,paragraph)));sections.push(paragraphs);}return sections;}
try{
 d.insertText(0,0,d.getParagraphLength(0,0),'현재😀 𠮷 supplementary plain body reflows across columns. '.repeat(15));
 const tail=d.getParagraphCount(0);d.insertParagraph(0,tail);d.insertText(0,tail,0,'\n'.repeat(4100));
 const source=body(),events=d.getEventLog(),pages=d.pageCount();assert.ok(pages>1);
 let refusal=null;
 assert.throws(()=>d.getPageTextLayout(0),error=>{refusal=String(error);return /complete current formatter set unavailable or exceeds supported budgets/.test(refusal);},'An unavailable complete formatter set must explicitly fail, never repaint remapped row indices using the legacy formatter');
 assert.deepEqual(body(),source);assert.equal(d.getEventLog(),events);
 const result={metadata,inputSha256:sha(input),verifierSha256:sha(await readFile(fileURLToPath(import.meta.url))),status:'PASS',pages,appendedNewlines:4100,refusal,sourceAndEventsUnchanged:true,scope:'Actual public WASM edit exceeds the existing full trace budget after a smaller-frame suffix remap. Explicit RenderError required; this is a rejection test, not large-document geometry or storage support.'};
 await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,pages,refusal}));
}finally{d.free();}
