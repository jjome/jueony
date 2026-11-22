import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {readShapeFillSources} from '../src/adapters/rhwp/agent-shape-fill.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {createAutomationFacade} from '../src/modules/automation/public/index.ts';
import type {Snapshot,EditOp} from '../src/modules/document/public/index.ts';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('a saved solid shape recolor keeps its other properties and checks the destination in HWP and HWPX',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const wasm=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await wasm.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const {HwpDocument}=wasm,doc=HwpDocument.createEmpty(),automation=createAutomationFacade();
 try{
  doc.createBlankDocument();doc.insertText(0,0,0,'도형 옆 본문');
  for(const width of [6000,7000])doc.createShapeControl(JSON.stringify({sectionIdx:0,paraIdx:0,charOffset:0,shapeType:'rectangle',width,height:3500}));
  for(const format of ['hwp','hwpx'] as const){
   const exportBytes=target=>format==='hwp'?target.exportHwp():target.exportHwpx();
   const original=exportBytes(doc),live=new HwpDocument(original);
   try{
    const liveBytesBefore=digest(exportBytes(live));
    const current=():Snapshot=>({name:'shape.'+format,revision:'test',nodes:[],limitations:[],shapeFillSources:readShapeFillSources(live,true)});
    const before=current();
    const [[target,source],[other,unchanged]]=Object.entries(before.shapeFillSources!);
    const op:EditOp={kind:'set_shape_fill',target,color:'#336699',originalFingerprint:source.fingerprint};
    const template=automation.capture({message:'도형 색 변경',sourceIds:[],operations:[op]},before);
    assert.equal(template.version,4);
    assert.deepEqual(automation.shapes(template,before)?.map(item=>item.id),[target]);
    assert.throws(()=>automation.prepare(template,before,{}, {}, {}, other),/직접 선택/u);
    assert.throws(()=>automation.capture({message:'변경',sourceIds:[],operations:[{...op,originalFingerprint:'0'.repeat(64)}]},before),/확인/u);
    const generation=automation.prepare(template,before,{}, {}, {}, target);
    const snapshot=live.saveSnapshot();
    try{
     executeDocumentOperations(live,before,generation.operations);
     assert.equal(current().shapeFillSources![target].color,'#336699');
     assert.deepEqual(current().shapeFillSources![other],unchanged);
     const artifact=format==='hwp'?live.exportHwpWithReport():live.exportHwpxWithReport();
     try{
      const output=artifact.takeBytes();
      verifyPreservedExport(live,output,format,artifact.contentLoss(),bytes=>new HwpDocument(bytes));
      const reopened=new HwpDocument(output);
      try{assert.equal(readShapeFillSources(reopened,true)?.[target].color,'#336699');}
      finally{reopened.free();}
     }finally{artifact.free();}
    }finally{live.restoreSnapshot(snapshot);live.discardSnapshot(snapshot);}
    assert.equal(digest(exportBytes(live)),liveBytesBefore);
   }finally{live.free();}
  }
 }finally{doc.free();}
});
