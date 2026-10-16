import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
// Independent CFB/record inspection for our small HWP5 tab regression documents.
// No producer/parser APIs or public/user document acceptance logic is involved.
export function hwpTabCacheEvidence(input){
 const b=Buffer.from(input);assert.equal(b.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');const sector=1<<b.readUInt16LE(30),mini=1<<b.readUInt16LE(32),at=n=>b.subarray((n+1)*sector,(n+2)*sector),fats=[];
 for(let i=0;i<109;i++){const n=b.readUInt32LE(76+i*4);if(n<0xfffffffa)fats.push(at(n));}assert.equal(fats.length,b.readUInt32LE(44));const fat=Buffer.concat(fats),chain=(start,map)=>{const out=[];for(let n=start;n<0xfffffffa;n=map.readUInt32LE(n*4)){assert.ok(!out.includes(n));out.push(n);}return out;},dir=Buffer.concat(chain(b.readUInt32LE(48),fat).map(at)),entries=[];
 for(let p=0;p<dir.length;p+=128){const e=dir.subarray(p,p+128);if(e[66])entries.push({name:e.subarray(0,e.readUInt16LE(64)-2).toString('utf16le'),type:e[66],start:e.readUInt32LE(116),size:Number(e.readBigUInt64LE(120))});}const root=entries.find(e=>e.type===5),miniData=Buffer.concat(chain(root.start,fat).map(at)),miniFat=Buffer.concat(chain(b.readUInt32LE(60),fat).map(at)),sections=[];
 for(const e of entries.filter(e=>e.type===2&&/^Section\d+$/.test(e.name)).sort((a,b)=>a.name.localeCompare(b.name))){
  assert.ok(e.size<4096,'own tiny fixture compressed section size');const compressed=Buffer.concat(chain(e.start,miniFat).map(n=>miniData.subarray(n*mini,(n+1)*mini))).subarray(0,e.size),raw=inflateRawSync(compressed,{maxOutputLength:1024*1024}),paragraphs=[];let paragraph;
  for(let p=0;p<raw.length;){const h=raw.readUInt32LE(p);p+=4;const tag=h&1023,level=(h>>>10)&1023;let size=h>>>20;if(size===4095){size=raw.readUInt32LE(p);p+=4;}assert.ok(p+size<=raw.length);
   if(tag===66&&level===0){paragraph={index:paragraphs.length,headerLineCount:raw.readUInt16LE(p+16),lineCount:0,tabs:[]};paragraphs.push(paragraph);}
   if(paragraph&&tag===67&&level===1){const units=Array.from({length:size/2},(_,i)=>raw.readUInt16LE(p+i*2));for(let i=0;i<units.length;i++){if(units[i]!==9){if((units[i]>=1&&units[i]<=8)||(units[i]>=11&&units[i]<=12)||(units[i]>=14&&units[i]<=23)){assert.ok(i+7<units.length);i+=7;}continue;}assert.ok(i+7<units.length);const ext=units.slice(i+1,i+8);assert.equal(ext[6],9);paragraph.tabs.push({width:ext[0]+ext[1]*65536,words:ext,placeholder:ext[0]===0&&ext[1]===0&&(ext[2]===0||ext[2]===256)&&ext.slice(3,6).every(x=>x===0)});i+=7;}}
   if(paragraph&&tag===69&&level===1){assert.equal(size%36,0);paragraph.lineCount+=size/36;}p+=size;
  }
  for(const p of paragraphs)assert.equal(p.headerLineCount,p.lineCount,'PARA_HEADER count must match actual LINE_SEG rows');sections.push({name:e.name,compressedSha256:createHash('sha256').update(compressed).digest('hex'),uncompressedSha256:createHash('sha256').update(raw).digest('hex'),paragraphs});
 }
 return sections;
}
