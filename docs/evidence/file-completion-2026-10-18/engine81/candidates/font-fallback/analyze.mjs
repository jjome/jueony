import {readFile,writeFile} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import {loadReviewEngine,hash} from '../../apps/editor/scripts/lib/hancom-review.mjs';
import {hwpLogicalStreams} from '../../apps/editor/scripts/lib/hwp-summary-evidence.mjs';
const pkg='C:/Users/jjome/Documents/work/jueony/build/rhwp-engine/source-20fddc2d172763e6/pkg';
const input=await readFile('build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx');
const engine=await loadReviewEngine(pkg),d=new engine.HwpDocument(input);
let r;
try {
 const artifact=d.exportHwpWithReport();let bytes,loss;try{bytes=artifact.takeBytes();loss=JSON.parse(artifact.contentLoss());}finally{artifact.free();}
 const streams=hwpLogicalStreams(bytes), header=streams.get('FileHeader'), raw=streams.get('DocInfo');
 const docInfo=(header.readUInt32LE(36)&1)?inflateRawSync(raw):raw;
 const records=[];for(let offset=0;offset<docInfo.length;){const h=docInfo.readUInt32LE(offset);offset+=4;let size=h>>>20;if(size===0xfff){size=docInfo.readUInt32LE(offset);offset+=4;}records.push({tag:h&1023,bytes:docInfo.subarray(offset,offset+size)});offset+=size;}
 const mappings=records.find(x=>x.tag===17).bytes,counts=Array.from({length:7},(_,i)=>mappings.readUInt32LE(4+4*i));
 let index=0;const matching=[];
 for(let slot=0;slot<7;slot++)for(let id=0;id<counts[slot];id++){
  const record=records.filter(x=>x.tag===19)[index++], b=record.bytes;let at=1;
  const string=()=>{const n=b.readUInt16LE(at);at+=2;const s=b.subarray(at,at+2*n).toString('utf16le');at+=2*n;return s;};
  const face=string();let altType=null,altName=null,typeInfo=null,defaultName=null;
  if(b[0]&128){altType=b[at++];altName=string();}if(b[0]&64){typeInfo=[...b.subarray(at,at+10)];at+=10;}if(b[0]&32)defaultName=string();
  if(face==='HY중고딕')matching.push({languageSlot:slot,fontId:id,name:face,attr:b[0],altType,altName,typeInfo,defaultName,recordSha256:hash(b),parsedAllBytes:at===b.length});
 }
 r=new engine.HwpDocument(bytes);
 const before=JSON.parse(d.getPageTextLayout(7)).runs,after=Array.from({length:r.pageCount()},(_,page)=>JSON.parse(r.getPageTextLayout(page)).runs).flat();
 const selected=[30,31,32].map(index=>{
  const choose=x=>{const {secIdx,paraIdx,parentParaIdx,cellIdx,charStart,charShapeId,paraShapeId,fontFamily,fontSize,bold,italic,x:x0,y,w,h}=x;return {secIdx,paraIdx,parentParaIdx,cellIdx,charStart,charShapeId,paraShapeId,fontFamily,fontSize,bold,italic,x:x0,y,w,h};};
  const source=before[index];
  const matches=after.filter(v=>v.secIdx===source.secIdx&&v.paraIdx===source.paraIdx&&v.parentParaIdx===source.parentParaIdx&&v.cellIdx===source.cellIdx&&v.charStart===source.charStart);
  if(matches.length!==1)throw Error('non-unique exact run owner: '+index+' count='+matches.length);
  return {index,before:choose(source),after:choose(matches[0])};
 });
 const result={engine:engine.metadata,inputSha256:hash(input),outputSha256:hash(bytes),loss,fontCounts:counts,rawMatchingFontFaces:matching,targetRuns:selected};
 await writeFile('build/mcst-font-chain-readonly80/result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({matching,selected}));
}finally{r?.free();d.free();}
