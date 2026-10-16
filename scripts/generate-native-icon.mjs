import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

// Original geometric page/J mark, no font or third-party graphic. A single
// 32-bit DIB image keeps the native resource build independent of PNG tooling.
const size=32,stride=size*4,maskStride=4,pixels=Buffer.alloc(size*stride),blue=[170,105,0,255],white=[255,255,255,255];
function rect(x,y,w,h,color){for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)for(let c=0;c<4;c++)pixels[(size-1-row)*stride+col*4+c]=color[c];}
rect(0,0,32,32,blue);rect(7,4,19,25,white);rect(21,4,5,5,blue);
rect(12,11,10,3,blue);rect(19,12,3,12,blue);rect(13,22,8,3,blue);rect(11,19,3,5,blue);
const dib=Buffer.alloc(40);dib.writeUInt32LE(40,0);dib.writeInt32LE(size,4);dib.writeInt32LE(size*2,8);dib.writeUInt16LE(1,12);dib.writeUInt16LE(32,14);dib.writeUInt32LE(pixels.length,20);
const image=Buffer.concat([dib,pixels,Buffer.alloc(maskStride*size)]),header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=size;header[7]=size;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(image.length,14);header.writeUInt32LE(22,18);
const icon=Buffer.concat([header,image]),path=resolve(fileURLToPath(new URL('..',import.meta.url)),'apps/editor/src-tauri/icons/icon.ico');
if(process.argv.includes('--check'))assert.deepEqual(await readFile(path),icon,'Native icon differs from its original generator');
else{await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,icon);}
console.log('Native original page/J icon: '+(process.argv.includes('--check')?'verified':'generated'));
