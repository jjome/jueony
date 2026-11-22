import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {validateEditOperations,type Snapshot} from '../src/modules/document/public/index.ts';
import {captureTemplate} from '../src/modules/automation/public/index.ts';

test('Agent applies an exact stored character-style range and preserves its link on both formats',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const wasm=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await wasm.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const doc=wasm.HwpDocument.createEmpty();
 const text='가😀나다라';
 try{
  doc.createBlankDocument();
  doc.insertText(0,0,0,text);
  doc.splitParagraph(0,0,Array.from(text).length);
  doc.insertText(0,1,0,'표본');
  doc.applyCharFormat(0,1,0,2,JSON.stringify({bold:true,fontSize:1800,textColor:'#225588'}));
  const shape=JSON.parse(doc.getCharPropertiesAt(0,1,0)).charShapeId;
  const styleId=doc.createStyle(JSON.stringify({name:'업무 강조',englishName:'WorkEmphasis',type:1,nextStyleId:0,baseCharShapeId:shape}));
  doc.deleteParagraph(0,1);
  for(const format of ['hwp','hwpx']){
    const encode=(native:any)=>format==='hwpx'?native.exportHwpx():native.exportHwp();
    const current=new wasm.HwpDocument(encode(doc));
    try{
      const base:Snapshot={revision:'r1',name:'style.'+format,limitations:[],nodes:[{section:0,paragraph:0,id:'s0p0',text,editable:true}],structure:readStructure(current)};
      assert(base.structure!.storedCharacterStyles?.[styleId]);
      const properties={storedStyle:{styleId,start:1,count:2,originalText:'😀나'}};
      const op={kind:'format_characters',target:'s0p0',properties};
      for(const rejected of [{...op,properties:{...properties,bold:true}},
        {...op,properties:{storedStyle:{...properties.storedStyle,originalText:'가나'}}}]){
        assert.throws(()=>validateEditOperations([rejected],base),/글자 스타일|원문/);
      }
      assert.throws(()=>captureTemplate({message:'스타일',sourceIds:[],operations:validateEditOperations([op],base)},base),/아직 기록/);
      const before=encode(current),undo=current.saveSnapshot();
      try{
        executeDocumentOperations(current,base,validateEditOperations([op],base));
        const artifact=format==='hwpx'?current.exportHwpxWithReport():current.exportHwpWithReport();
        try{
          const bytes=artifact.takeBytes();
          verifyPreservedExport(current,bytes,format,artifact.contentLoss(),bytes=>new wasm.HwpDocument(bytes));
          const reopened=new wasm.HwpDocument(bytes);
          try{
            const stored=JSON.parse(reopened.getStyleList()).find((value:any)=>value.id===styleId);
            assert.equal(reopened.getTextRange(0,0,0,5),text);
            const shapes=Array.from({length:5},(_,offset)=>JSON.parse(reopened.getCharPropertiesAt(0,0,offset)).charShapeId);
            assert.deepEqual(shapes.map(id=>id===stored.charShapeId),[false,true,true,false,false]);
          }finally{reopened.free();}
        }finally{artifact.free();}
        current.restoreSnapshot(undo);
        assert.deepEqual(encode(current),before);
        current.updateStyle(styleId,JSON.stringify({name:'변경한 정의',type:1,nextStyleId:0}));
        const stale=encode(current);
        assert.throws(()=>executeDocumentOperations(current,base,validateEditOperations([op],base)),/정의가 바뀌었습니다/);
        assert.deepEqual(encode(current),stale);
      }finally{current.discardSnapshot(undo);}
    }finally{current.free();}
  }
 }finally{doc.free();}
});
