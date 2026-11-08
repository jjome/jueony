import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {readNestedCaptionTextSources,replaceNestedCaptionText} from '../src/adapters/rhwp/nested-caption-text.ts';
import {captionedSubdivisionNestedTable} from '../scripts/lib/subdivision-caption-fixture.mjs';
import {labeledSubdivisionNestedTable} from '../scripts/lib/subdivision-nested-table.mjs';
import {readOwnedZip,writeOwnedZip} from '../scripts/lib/owned-zip.mjs';

const pkg=process.env.JUEONY_ENGINE_PACKAGE??fileURLToPath(new URL('../node_modules/@rhwp/core/',import.meta.url));
const {default:init,HwpDocument}=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
await init({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
const hasCaptionPathEvidence=typeof HwpDocument.prototype.getTableAxisCaptionEvidenceByPath==='function';
const patchedOnly={skip:hasCaptionPathEvidence?false:'requires the Jueony Rust caption-path evidence contract'};
const bytes=(d:any,format:string):Uint8Array=>format==='hwp'?d.exportHwp():d.exportHwpx();

function uniformCaption(paragraphs=['접수 설명']){
  const source=captionedSubdivisionNestedTable(HwpDocument),parts=readOwnedZip(source.exportHwpx());source.free();
  const section=parts.find(([name]:[string,Buffer])=>name==='Contents/section0.xml')!,xml=section[1].toString('utf8');
  let changed=false;
  section[1]=Buffer.from(xml.replace(/(<hp:caption side="TOP"[\s\S]*?<hp:subList\b[^>]*>)([\s\S]*?)(<\/hp:subList><\/hp:caption>)/,
    (_match,start,body,end)=>{changed=true;const lines=body.match(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/)?.[0];assert.ok(lines);
      return start+paragraphs.map((text,index)=>'<hp:p id="'+(980+index)+'" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'+
        '<hp:run charPrIDRef="0"><hp:t>'+text+'</hp:t></hp:run>'+lines+'</hp:p>').join('')+end;}));
  assert.equal(changed,true);return new HwpDocument(writeOwnedZip(parts));
}
function editable(doc:any,revision='r1'){
  const structure=readStructure(doc),sources=readNestedCaptionTextSources(doc,structure,revision);
  const value=Object.values(sources).find(v=>v.editable===true);
  assert.ok(value?.editable);return {structure,source:value};
}

for(const format of ['hwp','hwpx'])test(format+' changes only a verified plain nested-table caption and reopens it',patchedOnly,()=>{
  const fixture=uniformCaption(),original=bytes(fixture,format),doc=new HwpDocument(original);fixture.free();
  try{
    const {structure,source}=editable(doc),before=bytes(doc,format),token=doc.saveSnapshot();
    try{
      const paragraph=source.paragraphs[0],edit={target:source.target,revision:source.revision,paragraph:0,
        path:paragraph.path,originalText:paragraph.originalText,text:'수정 설명'};
      const cursor=replaceNestedCaptionText(doc,structure,source,edit);
      assert.deepEqual(cursor.cellPath,paragraph.path);assert.equal(cursor.charOffset,5);
      const saved=bytes(doc,format),reopened=new HwpDocument(saved);
      try{
        const next=readNestedCaptionTextSources(reopened,readStructure(reopened),'r2')[source.target];
        assert.ok(next?.editable);assert.equal(next.paragraphs[0].originalText,'수정 설명');
        assert.deepEqual(next.paragraphs[0].path,paragraph.path);
      }finally{reopened.free();}
      doc.restoreSnapshot(token);assert.deepEqual(bytes(doc,format),before);
    }finally{doc.discardSnapshot(token);}
  }finally{doc.free();}
});

for(const format of ['hwp','hwpx'])test(format+' changes one verified paragraph of a multi-paragraph plain caption',patchedOnly,()=>{
  const fixture=uniformCaption(['첫 문단','둘째 문단']),doc=new HwpDocument(bytes(fixture,format));fixture.free();
  try{
    const original=bytes(doc,format),{structure,source}=editable(doc),paragraph=source.paragraphs[1],token=doc.saveSnapshot();
    assert.deepEqual(source.paragraphs.map(p=>p.originalText),['첫 문단','둘째 문단']);
    try{
      replaceNestedCaptionText(doc,structure,source,{target:source.target,revision:source.revision,paragraph:1,
        path:paragraph.path,originalText:paragraph.originalText,text:'수정 둘째'});
      const reopened=new HwpDocument(bytes(doc,format));
      try{
        const next=readNestedCaptionTextSources(reopened,readStructure(reopened),'r2')[source.target];
        assert.ok(next?.editable);assert.deepEqual(next.paragraphs.map(p=>p.originalText),['첫 문단','수정 둘째']);
        assert.deepEqual(next.paragraphs.map(p=>p.path),source.paragraphs.map(p=>p.path));
      }finally{reopened.free();}
      doc.restoreSnapshot(token);assert.deepEqual(bytes(doc,format),original);
    }finally{doc.discardSnapshot(token);}
  }finally{doc.free();}
});

for(const format of ['hwp','hwpx'])test(format+' replaces an equal-length multi-run caption and preserves every run',patchedOnly,()=>{
  const fixture=captionedSubdivisionNestedTable(HwpDocument),doc=new HwpDocument(bytes(fixture,format));fixture.free();
  try{
    const original=bytes(doc,format),{structure,source}=editable(doc),paragraph=source.paragraphs[0],token=doc.saveSnapshot();
    assert.equal(paragraph.originalText,'접수 설명');assert.equal(paragraph.runs.length,2);
    const beforeRuns=structuredClone(paragraph.runs);
    try{
      replaceNestedCaptionText(doc,structure,source,{target:source.target,revision:source.revision,paragraph:0,
        path:paragraph.path,originalText:paragraph.originalText,text:'검토 내용'});
      const reopened=new HwpDocument(bytes(doc,format));
      try{
        const next=readNestedCaptionTextSources(reopened,readStructure(reopened),'r2')[source.target];
        assert.ok(next?.editable);assert.equal(next.paragraphs[0].originalText,'검토 내용');
        assert.deepEqual(next.paragraphs[0].path,paragraph.path);assert.deepEqual(next.paragraphs[0].runs,beforeRuns);
        assert.deepEqual(next.placement,source.placement);
      }finally{reopened.free();}
      doc.restoreSnapshot(token);assert.deepEqual(bytes(doc,format),original);
    }finally{doc.discardSnapshot(token);}
  }finally{doc.free();}
});

for(const format of ['hwp','hwpx'])test(format+' fills one existing verified blank caption paragraph and reopens it',patchedOnly,()=>{
  const fixture=uniformCaption(['']),doc=new HwpDocument(bytes(fixture,format));fixture.free();
  try{
    const original=bytes(doc,format),{structure,source}=editable(doc),paragraph=source.paragraphs[0],token=doc.saveSnapshot();
    assert.equal(paragraph.originalText,'');
    const last=paragraph.path.at(-1)!;
    assert.ok(Number.isSafeInteger(last.controlIndex));assert.equal(last.cellIndex,65534);assert.equal(last.cellParaIndex,0);
    assert.ok(Number.isSafeInteger(paragraph.paragraphShape));
    assert.ok(Number.isSafeInteger(paragraph.style));
    assert.ok(Number.isSafeInteger(paragraph.charShape));
    const encoded=JSON.stringify(paragraph.path);
    assert.equal(doc.getCellParagraphLengthByPath(source.section,source.paragraph,encoded),0);
    assert.equal(doc.getTextInCellByPath(source.section,source.paragraph,encoded,0,0),'');
    try{
      replaceNestedCaptionText(doc,structure,source,{target:source.target,revision:source.revision,paragraph:0,
        path:paragraph.path,originalText:'',text:'새 캡션'});
      const reopened=new HwpDocument(bytes(doc,format));
      try{
        const next=readNestedCaptionTextSources(reopened,readStructure(reopened),'r2')[source.target];
        assert.ok(next?.editable);assert.equal(next.paragraphs[0].originalText,'새 캡션');
        assert.deepEqual(next.paragraphs[0].path,paragraph.path);
        assert.equal(next.paragraphs[0].paragraphShape,paragraph.paragraphShape);
        assert.equal(next.paragraphs[0].style,paragraph.style);
        assert.equal(next.paragraphs[0].charShape,paragraph.charShape);
      }finally{reopened.free();}
      doc.restoreSnapshot(token);assert.deepEqual(bytes(doc,format),original);
    }finally{doc.discardSnapshot(token);}
  }finally{doc.free();}
});

test('missing captions and multiple blank caption paragraphs remain fail closed',()=>{
  const missing=labeledSubdivisionNestedTable(HwpDocument,'접수 제목',4400),missingBytes=missing.exportHwpx();
  try{
    const sources=readNestedCaptionTextSources(missing,readStructure(missing),'r1');
    assert.equal(Object.values(sources).some(value=>value.editable),false);
    assert.deepEqual(missing.exportHwpx(),missingBytes);
  }finally{missing.free();}
  for(const format of ['hwp','hwpx'])for(const paragraphs of [['',''],['','둘째 문단']]){
    const fixture=uniformCaption(paragraphs),doc=new HwpDocument(bytes(fixture,format));fixture.free();
    try{
      const sources=readNestedCaptionTextSources(doc,readStructure(doc),'r1');
      assert.equal(Object.values(sources).some(value=>value.editable),false);
    }finally{doc.free();}
  }
});

test('an engine without caption-path evidence keeps every nested caption fail closed',
  {skip:hasCaptionPathEvidence?'unpatched-engine guard':false},()=>{
    const doc=captionedSubdivisionNestedTable(HwpDocument),before=doc.exportHwpx();
    try{
      const sources=readNestedCaptionTextSources(doc,readStructure(doc),'r1');
      assert.ok(Object.keys(sources).length>0);assert.equal(Object.values(sources).some(value=>value.editable),false);
      assert.deepEqual(doc.exportHwpx(),before);
    }finally{doc.free();}
  });

test('stale revision, path, original, empty text and mixed or complex captions fail closed',patchedOnly,()=>{
  const doc=uniformCaption();
  try{
    const {structure,source}=editable(doc),old=doc.exportHwpx(),paragraph=source.paragraphs[0],base={target:source.target,
      revision:source.revision,paragraph:0,path:paragraph.path,originalText:paragraph.originalText,text:'새 설명'};
    for(const edit of [{...base,revision:'stale'},{...base,originalText:'다름'},
      {...base,path:[...base.path.slice(0,-1),{...base.path.at(-1)!,cellParaIndex:1}]},{...base,text:''}]){
      assert.throws(()=>replaceNestedCaptionText(doc,structure,source,edit));assert.deepEqual(doc.exportHwpx(),old);
    }
  }finally{doc.free();}
  const mixed=captionedSubdivisionNestedTable(HwpDocument);
  try{
    const {structure,source}=editable(mixed),before=mixed.exportHwpx(),paragraph=source.paragraphs[0],base={target:source.target,
      revision:source.revision,paragraph:0,path:paragraph.path,originalText:paragraph.originalText};
    for(const text of ['길이가 다름','검😀 내용','검토\u0007내용']){
      assert.throws(()=>replaceNestedCaptionText(mixed,structure,source,{...base,text}));assert.deepEqual(mixed.exportHwpx(),before);
    }
    assert.equal(Object.values(readNestedCaptionTextSources(mixed,structure,'r1')).some(v=>!v.editable),true);
  }finally{mixed.free();}
  const complex=captionedSubdivisionNestedTable(HwpDocument,{complex:true});
  try{assert.equal(Object.values(readNestedCaptionTextSources(complex,readStructure(complex),'r1')).some(v=>v.editable),false);}
  finally{complex.free();}
});
