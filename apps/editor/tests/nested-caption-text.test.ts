import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readNestedCaptionTextSources,replaceNestedCaptionText} from '../src/adapters/rhwp/nested-caption-text.ts';
import {captionedSubdivisionNestedTable} from '../scripts/lib/subdivision-caption-fixture.mjs';
import {readOwnedZip,writeOwnedZip} from '../scripts/lib/owned-zip.mjs';

const pkg=process.env.JUEONY_ENGINE_PACKAGE??fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const bytes=(d:any,format:string):Uint8Array=>format==='hwp'?d.exportHwp():d.exportHwpx();

function uniformCaption(){
  const source=captionedSubdivisionNestedTable(HwpDocument),parts=readOwnedZip(source.exportHwpx());source.free();
  const section=parts.find(([name]:[string,Buffer])=>name==='Contents/section0.xml')!,xml=section[1].toString('utf8');
  let changed=false;
  section[1]=Buffer.from(xml.replace(/(<hp:caption side="TOP"[\s\S]*?<hp:p\b[^>]*>)[\s\S]*?(<hp:linesegarray>)/,
    (_match,start,lines)=>{changed=true;return start+'<hp:run charPrIDRef="0"><hp:t>접수 설명</hp:t></hp:run>'+lines;}));
  assert.equal(changed,true);return new HwpDocument(writeOwnedZip(parts));
}
function editable(doc:any,revision='r1'){
  const structure=readStructure(doc),sources=readNestedCaptionTextSources(doc,structure,revision);
  const value=Object.values(sources).find(v=>v.editable===true);
  assert.ok(value?.editable);return {structure,source:value};
}

for(const format of ['hwp','hwpx'])test(format+' changes only a verified plain nested-table caption and reopens it',()=>{
  const fixture=uniformCaption(),original=bytes(fixture,format),doc=new HwpDocument(original);fixture.free();
  try{
    const {structure,source}=editable(doc),before=bytes(doc,format),token=doc.saveSnapshot();
    try{
      const edit={target:source.target,revision:source.revision,path:source.path,originalText:source.originalText,text:'수정 설명'};
      const cursor=replaceNestedCaptionText(doc,structure,source,edit);
      assert.deepEqual(cursor.cellPath,source.path);assert.equal(cursor.charOffset,5);
      const saved=bytes(doc,format),reopened=new HwpDocument(saved);
      try{
        const next=readNestedCaptionTextSources(reopened,readStructure(reopened),'r2')[source.target];
        assert.ok(next?.editable);assert.equal(next.originalText,'수정 설명');
        assert.deepEqual(next.path,source.path);
      }finally{reopened.free();}
      doc.restoreSnapshot(token);assert.deepEqual(bytes(doc,format),before);
    }finally{doc.discardSnapshot(token);}
  }finally{doc.free();}
});

test('stale revision, path, original, empty text and mixed or complex captions fail closed',()=>{
  const doc=uniformCaption();
  try{
    const {structure,source}=editable(doc),old=doc.exportHwpx(),base={target:source.target,revision:source.revision,path:source.path,
      originalText:source.originalText,text:'새 설명'};
    for(const edit of [{...base,revision:'stale'},{...base,originalText:'다름'},
      {...base,path:[...base.path.slice(0,-1),{...base.path.at(-1)!,cellParaIndex:1}]},{...base,text:''}]){
      assert.throws(()=>replaceNestedCaptionText(doc,structure,source,edit));assert.deepEqual(doc.exportHwpx(),old);
    }
  }finally{doc.free();}
  for(const complex of [false,true]){
    const blocked=captionedSubdivisionNestedTable(HwpDocument,{complex});
    try{assert.equal(Object.values(readNestedCaptionTextSources(blocked,readStructure(blocked),'r1')).some(v=>v.editable),false);}
    finally{blocked.free();}
  }
});
