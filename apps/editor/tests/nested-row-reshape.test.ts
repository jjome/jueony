import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {validateEditOperations, type Snapshot} from '../src/modules/document/public/index.ts';

test('merge and split one nested row in HWP and HWPX with neighbor, original format and undo checks',{
  skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
  const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
  const module=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
  await module.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
  const {HwpDocument}=module;
  if(typeof HwpDocument.prototype.reshapeNestedTableCells!=='function')throw new Error('restored engine is missing nested reshape');
  const blank=HwpDocument.createEmpty();
  try{
    blank.createBlankDocument();
    const small=(value:string)=>'<table style="width:180px"><tr>'+[value,'두 번째','그대로'].map(text=>`<td style="width:60px">${text}</td>`).join('')+
      '</tr><tr><td style="width:60px">1</td><td style="width:60px">2</td><td style="width:60px">3</td></tr></table>';
    blank.pasteHtml(0,0,0,`<table style="width:420px"><tr><td style="width:210px">이웃${small('이웃 내용')}</td><td style="width:210px">대상${small('첫 내용')}</td></tr></table>`);
    for(const format of ['hwp','hwpx']){
      const exportBytes=(doc:any)=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
      const opened=new HwpDocument(exportBytes(blank));
      try{
        const snapshot=():Snapshot=>({name:`fixture.${format}`,revision:'test',nodes:[],limitations:[],structure:readStructure(opened)});
        const before=snapshot(), [neighbor,target]=before.structure!.nestedTables!;
        assert.equal(target.reshapeAvailable,true);
        const merge={kind:'merge_table_cells',target:target.id,startRow:0,startColumn:0,rowCount:1,columnCount:2};
        assert.throws(()=>validateEditOperations([{...merge,rowCount:2}],before),/한 행/);
        const original=exportBytes(opened),undo=opened.saveSnapshot();
        try{
          executeDocumentOperations(opened,before,validateEditOperations([merge],before));
          const merged=snapshot();
          const [newNeighbor,mergedTable]=merged.structure!.nestedTables!;
          assert.deepEqual(newNeighbor,neighbor);
          assert.deepEqual(mergedTable.cells.filter(cell=>cell.row===0).map(cell=>[cell.columnSpan,cell.text]),[[2,'첫 내용\n두 번째'],[1,'그대로']]);
          const split={kind:'split_table_cell',target:target.id,row:0,column:0};
          executeDocumentOperations(opened,merged,validateEditOperations([split],merged));
          const after=new HwpDocument(exportBytes(opened));
          try{
            const [nextNeighbor,splitTable]=readStructure(after).nestedTables!;
            assert.deepEqual(nextNeighbor,neighbor);
            assert.deepEqual(splitTable.cells.filter(cell=>cell.row===0).map(cell=>[cell.columnSpan,cell.text]),[[1,'첫 내용\n두 번째'],[1,''],[1,'그대로']]);
          }finally{after.free();}
          opened.restoreSnapshot(undo);
          assert.deepEqual(exportBytes(opened),original);
        }finally{opened.discardSnapshot(undo);}
      }finally{opened.free();}
    }
  }finally{blank.free();}
});
