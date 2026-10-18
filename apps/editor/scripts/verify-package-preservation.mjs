// Own synthetic packages only. Inspect the ZIP independently of the document
// parser, so an exporter and parser cannot conceal the same metadata loss.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateRawSync,deflateRawSync} from 'node:zlib';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

for(const key of ['JUEONY_ENGINE_PACKAGE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[key]??''),`${key}: absolute path required`);
const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE),out=resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const wasm=await readFile(pkg+'/rhwp_bg.wasm'),js=await readFile(pkg+'/rhwp.js');
const engine=JSON.parse(await readFile(pkg+'/jueony-engine-build.json','utf8'));
assert.equal(sha(wasm),engine.wasmSha256);assert.equal(sha(js),engine.jsSha256);
const {default:init,HwpDocument}=await import(pathToFileURL(pkg+'/rhwp.js'));
await init({module_or_path:wasm});

const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function unzip(value){
 const b=Buffer.from(value),parts=new Map();let end=-1;
 for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(b.readUInt32LE(p)===0x06054b50){end=p;break;}
 assert.ok(end>=0,'EOCD');let p=b.readUInt32LE(end+16);
 for(let i=0;i<b.readUInt16LE(end+10);i++){
  assert.equal(b.readUInt32LE(p),0x02014b50);const method=b.readUInt16LE(p+10),size=b.readUInt32LE(p+20),length=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),local=b.readUInt32LE(p+42),name=b.subarray(p+46,p+46+nl).toString('utf8');
  assert.equal(b.readUInt32LE(local),0x04034b50);const offset=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28),compressed=b.subarray(offset,offset+size);
  const bytes=method===0?Buffer.from(compressed):method===8?inflateRawSync(compressed):assert.fail('ZIP compression');
  assert.equal(bytes.length,length);assert.equal(crc32(bytes),b.readUInt32LE(p+16));assert.ok(!parts.has(name),'duplicate ZIP entry');parts.set(name,bytes);p+=46+nl+el+cl;
 }
 return parts;
}
function zip(parts){
 const local=[],central=[];let offset=0;
 for(const[name,value]of parts){const bytes=Buffer.from(value),n=Buffer.from(name),packed=name==='mimetype'?bytes:deflateRawSync(bytes),method=name==='mimetype'?0:8,crc=crc32(bytes),l=Buffer.alloc(30),c=Buffer.alloc(46);
  l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(0x800,6);l.writeUInt16LE(method,8);l.writeUInt32LE(crc,14);l.writeUInt32LE(packed.length,18);l.writeUInt32LE(bytes.length,22);l.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(method,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  local.push(l,n,packed);central.push(c,n);offset+=l.length+n.length+packed.length;
 }
 const directory=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(parts.size,8);e.writeUInt16LE(parts.size,10);e.writeUInt32LE(directory.length,12);e.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,e]);
}
const blank=HwpDocument.createEmpty();blank.createBlankDocument();blank.insertText(0,0,0,'원본 본문 😀');const base=unzip(blank.exportHwpx());blank.free();
// These fixtures model independent external XML packages with deliberately
// replaced standard metadata, not a tampered raw-summary transport. Its strict
// binding/refusal cases are tested separately by verify-stored-information95.
base.delete('META-INF/jueony-summary-properties-v1.json');
const opf='http://www.idpf.org/2007/opf/',cust='urn:jueony:owned-preservation';
const cases=[
 {name:'metadata attributes and unknown child',metadata:`<opf:metadata id="owned-meta" xml:lang="ko"><opf:title>원본 제목</opf:title><x:opaque xmlns:x="${cust}" flag="&quot;&gt;">비표준 정보 😀</x:opaque></opf:metadata>`},
 {name:'self-closing metadata remains empty',metadata:'<opf:metadata id="owned-empty"/>'},
 {name:'metadata inherited extension namespace',root:` xmlns:x="${cust}"`,metadata:'<opf:metadata><x:opaque flag="keep">상속 namespace</x:opaque></opf:metadata>',namespace:['xmlns:x',cust]},
 {name:'alias OPF prefix metadata',root:` xmlns:p="${opf}"`,metadata:'<p:metadata><p:title>접두사 보존</p:title></p:metadata>',namespace:['xmlns:p',opf]},
 {name:'default OPF namespace metadata',metadata:`<metadata xmlns="${opf}"><title>기본 namespace</title></metadata>`},
 {name:'alias package root and summary namespace',root:` xmlns:p="${opf}"`,rootQName:'p:package',metadata:'<p:metadata><p:title>원본 접두사 제목</p:title></p:metadata>',namespace:['xmlns:p',opf]},
 {name:'foreign rebinding inside opaque metadata is not a summary field',metadata:`<opf:metadata><opf:title>실제 제목</opf:title><x:opaque xmlns:x="${cust}" xmlns:opf="urn:owned:foreign"><opf:title>요약으로 오인하면 안 됨</opf:title></x:opaque></opf:metadata>`},
 {name:'package identity and inherited namespaced attributes',root:` xmlns:x="${cust}"`,attributes:'version="1.0" unique-identifier="doc-id" id="owned-package" xml:lang="ko" x:policy="보존"',metadata:'<opf:metadata><opf:identifier id="doc-id">owned-document-identity</opf:identifier></opf:metadata>',namespace:['xmlns:x',cust]},
 {name:'comment decoy cannot replace real metadata',beforeMetadata:'<!-- <opf:metadata><opf:title>decoy</opf:title></opf:metadata> -->',metadata:'<opf:metadata id="actual"><opf:title>실제 제목</opf:title></opf:metadata>'},
 {name:'single-quoted script manifest',metadata:'<opf:metadata><opf:title>스크립트 원본</opf:title></opf:metadata>',script:"<opf:item id='owned-script' href='Scripts/owned.js' media-type='application/javascript'/>"},
 {name:'multiline script manifest with explicit end',metadata:'<opf:metadata/>',script:'<opf:item\n id="owned-script" href="Scripts/owned.js" media-type="application/javascript"></opf:item>'},
 {name:'alias script manifest and spine',root:` xmlns:p="${opf}"`,metadata:'<opf:metadata/>',script:'<p:item id="owned-script" href="Scripts/owned.js" media-type="application/javascript"/>',namespace:['xmlns:p',opf]},
 {name:'script reference retains original properties',metadata:'<opf:metadata/>',script:'<opf:item id="owned-script" href="Scripts/owned.js" media-type="application/javascript"/>',ref:'<opf:itemref idref="owned-script" linear="no" properties="owned-reference"/>'},
 {name:'unreferenced script is not added to spine',metadata:'<opf:metadata/>',script:'<opf:item id="owned-script" href="Scripts/owned.js" media-type="application/javascript"/>',noRef:true},
];
const results=[],failures=[];
for(const c of cases){try{
 const parts=new Map(base);let hpf=parts.get('Contents/content.hpf').toString('utf8');
 hpf=hpf.replace(/<opf:metadata\b[^>]*>[\s\S]*?<\/opf:metadata>/,c.metadata);
 if(c.beforeMetadata)hpf=hpf.replace(c.metadata,c.beforeMetadata+c.metadata);
 if(c.root)hpf=hpf.replace('<opf:package ','<opf:package'+c.root+' ');
 if(c.rootQName)hpf=hpf.replace('<opf:package','<'+c.rootQName).replace('</opf:package>','</'+c.rootQName+'>');
 if(c.attributes)hpf=hpf.replace('version="" unique-identifier="" id=""',c.attributes);
 const script=Buffer.from('// Owned fixture only. Never execute.\nconst keep = "원문 😀";\n');
 if(c.script){hpf=hpf.replace('</opf:manifest>',c.script+'</opf:manifest>');if(!c.noRef)hpf=hpf.replace('</opf:spine>',(c.ref??'<opf:itemref idref="owned-script"/>')+'</opf:spine>');parts.set('Scripts/owned.js',script);}
 parts.set('Contents/content.hpf',Buffer.from(hpf));const source=zip(parts),sourceHash=sha(source),doc=new HwpDocument(source);
 try{
  const before=doc.getTextFileUnicode();assert.match(before,/원본 본문/);doc.insertText(0,0,0,'편집 ');assert.match(doc.getTextFileUnicode(),/편집 원본 본문/);
  let bytes;
  for(let pass=0;pass<2;pass++){
   const current=pass===0?doc:new HwpDocument(bytes);try{const artifact=current.exportHwpxWithReport();try{const losses=JSON.parse(artifact.contentLoss());assert.equal(losses.count,0,JSON.stringify(losses));bytes=artifact.takeBytes();assert.equal(verifyPreservedExport(current,bytes,'hwpx',losses,b=>new HwpDocument(b)).status,'checked');}finally{artifact.free();}}finally{if(pass)current.free();}
   const output=unzip(bytes),text=output.get('Contents/content.hpf').toString('utf8');
   // A fragment moved from the old root must close its inherited namespace
   // scope. Only that known declaration may be added; every original byte of
   // metadata and every existing declaration/attribute remains required.
   let normalized=text;
   if(c.namespace){const declaration=` ${c.namespace[0]}="${c.namespace[1]}"`;if(!c.metadata.includes(declaration))normalized=normalized.replaceAll(declaration,'');}
   assert.ok(normalized.includes(c.metadata),'original metadata payload/attributes missing');
   if(c.namespace)assert.ok(text.includes(`${c.namespace[0]}="${c.namespace[1]}"`)||text.includes(`${c.namespace[0]}='${c.namespace[1]}'`),'inherited namespace lost');
   if(c.attributes){const root=text.match(/<opf:package\b[^>]*>/)?.[0];assert.ok(root,'package root missing');for(const attribute of c.attributes.match(/[^\s=]+="[^"]*"/g))assert.ok(root.includes(attribute),'original package attribute lost: '+attribute);}
   if(c.script){assert.ok(normalized.includes(c.script),'original script manifest item missing');assert.deepEqual(output.get('Scripts/owned.js'),script);assert.equal(/idref=["']owned-script["']/.test(text),!c.noRef,'script spine reference added/removed');if(c.ref)assert.ok(normalized.includes(c.ref),'original script reference attributes lost');}
   const reopened=new HwpDocument(bytes);try{assert.equal(reopened.getTextFileUnicode(),doc.getTextFileUnicode());}finally{reopened.free();}
  }
  // A caller must also be able to update the five supported summary strings
  // without destroying the extension payload or the source namespace owner.
  const state=JSON.parse(doc.getDocumentMetadata());assert.equal(state.editable,true);
  const values={title:'수정 제목 😀',subject:'검증 주제',author:'자체 시험',keywords:'파일,보존',description:'첫 줄\n둘째 줄 & <값>'};
  doc.setDocumentMetadata(state.fingerprint,JSON.stringify(values));assert.deepEqual(JSON.parse(doc.getDocumentMetadata()).values,values);
  const artifact=doc.exportHwpxWithReport();try{
   const losses=JSON.parse(artifact.contentLoss()),saved=artifact.takeBytes();assert.equal(losses.count,0);assert.equal(verifyPreservedExport(doc,saved,'hwpx',losses,b=>new HwpDocument(b)).status,'checked');
   const parts=unzip(saved),hpf=parts.get('Contents/content.hpf').toString('utf8');
   for(const opaque of c.metadata.match(/<x:opaque\b[\s\S]*?<\/x:opaque>/g)??[])assert.ok(hpf.includes(opaque),'unknown metadata payload changed by summary edit');
   if(c.script)assert.deepEqual(parts.get('Scripts/owned.js'),script);
   if(c.attributes){const root=hpf.match(/<opf:package\b[^>]*>/)?.[0];for(const attribute of c.attributes.match(/[^\s=]+="[^"]*"/g))assert.ok(root?.includes(attribute),'package identity changed by summary edit');}
   const reopened=new HwpDocument(saved);try{assert.deepEqual(JSON.parse(reopened.getDocumentMetadata()).values,values);assert.equal(reopened.getTextFileUnicode(),doc.getTextFileUnicode());}finally{reopened.free();}
  }finally{artifact.free();}
  assert.equal(sha(source),sourceHash);results.push({name:c.name,status:'PASS',exportsAndReopens:3,summaryEditPreservesExtensions:true,sourceUnchanged:true});
 }finally{doc.free();}
 }catch(e){results.push({name:c.name,status:'FAIL'});failures.push({name:c.name,error:String(e),stack:e.stack});}}
const sourceHashes=await Promise.all(['src/adapters/rhwp/preservation.ts','src/adapters/rhwp/document-save-layout.ts','src/adapters/rhwp/overlap-save-layout.ts'].map(async path=>({path,sha256:sha(await readFile(resolve(fileURLToPath(new URL('..',import.meta.url)),path)))})));
const report={engine,wasmSha256:sha(wasm),verifierSha256:sha(await readFile(fileURLToPath(import.meta.url))),sourceHashes,results,failures,scope:'Actual WASM body and summary edits, mandatory production preservation guard, three independent ZIP inspections and reopens for owned synthetic HWPX packages. Scripts are byte resources and are never executed. No user file or Hancom/OS UI interaction; no Hancom equivalence claim.'};
await writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,total:results.length,failures},null,2));if(failures.length)process.exitCode=1;
