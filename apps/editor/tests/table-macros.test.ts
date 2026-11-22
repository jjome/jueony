import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {createAutomationFacade} from '../src/modules/automation/public/index.ts';
import type {EditOp,Snapshot} from '../src/modules/document/public/index.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';

test('recorded native table commands validate explicit targets, play in one batch and survive HWP and HWPX save and undo',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const wasm=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await wasm.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const automation=createAutomationFacade();
 const original=wasm.HwpDocument.createEmpty();
 try{
  original.createBlankDocument();
  const table=JSON.parse(original.createTable(0,0,0,2,2));
  for(const [i,text] of ['항목','금액','사업','10'].entries())original.insertTextInCell(0,table.paraIdx,table.controlIdx,i,0,0,text);
  for(const format of ['hwp','hwpx']){
   const getBytes=(doc:any)=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
   const originalBytes=getBytes(original),live=new wasm.HwpDocument(originalBytes);
   try{
    const current=():Snapshot=>({name:'fixture.'+format,revision:'v1',nodes:[],limitations:[],structure:readStructure(live)});
    const base=current(),source=base.structure!.tables[0].id;
    const operations:EditOp[]=[
     {kind:'set_table_cell',target:source,row:1,column:1,originalText:'10',text:'{{기존 금액}}'},
     {kind:'insert_table_row',target:source,index:2,values:['추가','{{추가 금액}}']},
     {kind:'format_table_cells',target:source,startRow:2,startColumn:0,rowCount:1,columnCount:2,properties:{bold:true}},
    ];
    const template=automation.capture({message:'표 편집',operations,sourceIds:[]},base);
    assert.equal(template.version,3);
    assert.deepEqual(automation.variables(template),['기존 금액','추가 금액']);
    assert.match(automation.describe(template),/행.*추가/);
    const values={'기존 금액':'20','추가 금액':'30'};
    assert.throws(()=>automation.prepare(template,base,values),/직접 선택/);
    assert.throws(()=>automation.prepare(template,base,{'기존 금액':'20'},{},{[source]:source}),/변수/);
    const moved=structuredClone(base);
    const destination='s0p10t0';
    moved.structure!.tables[0].paragraph=10;
    moved.structure!.tables[0].id=destination;
    assert.deepEqual(automation.prepare(template,moved,values,{},{[source]:destination}).operations.map(op=>'target' in op?op.target:null),
     [destination,destination,destination]);
    moved.structure!.tables[0].cells[0].text='다른 표';
    assert.throws(()=>automation.prepare(template,moved,values,{},{[source]:destination}),/원문.*격자/);
    const parsed=JSON.parse(JSON.stringify(template));
    automation.validate(parsed);
    const proposal=automation.prepare(parsed,base,values,{},{[source]:source});
    const before=getBytes(live),undo=live.saveSnapshot();
    try{
     executeDocumentOperations(live,base,proposal.operations);
     const artifact=format==='hwp'?live.exportHwpWithReport():live.exportHwpxWithReport();
     try{
      const bytes=artifact.takeBytes();
      verifyPreservedExport(live,bytes,format,artifact.contentLoss(),bytes=>new wasm.HwpDocument(bytes));
      const saved=new wasm.HwpDocument(bytes);
      try{
       const result=readStructure(saved).tables[0];
       assert.deepEqual(result.cells.map(cell=>cell.text),['항목','금액','사업','20','추가','30']);
       assert.equal(result.cells[4].characters?.bold,true);
      }finally{saved.free();}
     }finally{artifact.free();}
     live.restoreSnapshot(undo);
     assert.deepEqual(getBytes(live),before);
    }finally{live.discardSnapshot(undo);}
    assert.deepEqual(getBytes(original),originalBytes);
   }finally{live.free();}
  }
 }finally{original.free();}
});

test('nested plain cell and axis macros stay bound to a matching nested table and survive save and undo',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const engine=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await engine.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const automation=createAutomationFacade();
 const source=engine.HwpDocument.createEmpty();
 try{
  source.createBlankDocument();
  source.pasteHtml(0,0,0,'<table><tr><td>바깥<table><tr><td>원래 금액</td><td>보존 셀</td></tr></table></td></tr></table>');
  for(const format of ['hwp','hwpx']){
   const encode=(doc:any)=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
   const original=encode(source),live=new engine.HwpDocument(original);
   try{
    const witnesses:Record<string,string>={};
    const base:Snapshot={name:`nested.${format}`,revision:'v1',nodes:[],limitations:[],structure:readStructure(live,witnesses),nestedTableTemplateEvidence:witnesses};
    const table=base.structure!.nestedTables![0],target=table.id;
    assert.match(witnesses[target],/^[a-f0-9]{64}$/u);
    const op:EditOp={kind:'set_table_cell',target,row:0,column:0,originalText:'원래 금액',text:'{{금액}}'};
    const template=automation.capture({message:'중첩 표 변경',operations:[op],sourceIds:[]},base);
    assert.equal(template.version,3);
    const persisted=JSON.parse(JSON.stringify(template));
    automation.validate(persisted);
    const falseTarget=structuredClone(base);
    falseTarget.nestedTableTemplateEvidence![target]='0'.repeat(64);
    assert.throws(()=>automation.prepare(persisted,falseTarget,{'금액':'42'},{},{[target]:target}),/원문.*격자/);
    assert.throws(()=>automation.prepare(persisted,base,{'금액':'42'},{},{[target]:base.structure!.tables[0].id}),/원문.*격자/);
    const plan=automation.prepare(persisted,base,{'금액':'42'},{},{[target]:target});
    const before=encode(live),undo=live.saveSnapshot();
    try{
     executeDocumentOperations(live,base,plan.operations);
     const artifact=format==='hwp'?live.exportHwpWithReport():live.exportHwpxWithReport();
     try{
      const bytes=artifact.takeBytes();
      verifyPreservedExport(live,bytes,format,artifact.contentLoss(),content=>new engine.HwpDocument(content));
      const reopened=new engine.HwpDocument(bytes);
      try{assert.deepEqual(readStructure(reopened).nestedTables?.[0].cells.map(cell=>cell.text),['42','보존 셀']);}
      finally{reopened.free();}
     }finally{artifact.free();}
     live.restoreSnapshot(undo);
     assert.deepEqual(encode(live),before);
    }finally{live.discardSnapshot(undo);}
    assert.equal(table.axisEditable,true);
    const axisCases:[EditOp,Record<string,string>,number,number,string[]][]=[
     [{kind:'insert_table_row',target,index:1,values:['{{추가값}}','합계']},{'추가값':'75'},2,2,['원래 금액','보존 셀','75','합계']],
     [{kind:'insert_table_column',target,index:1,values:['입력']},{},1,3,['원래 금액','입력','보존 셀']],
     [{kind:'delete_table_column',target,index:1},{},1,1,['원래 금액']],
    ];
    for(const [axis,values,rows,columns,texts] of axisCases){
     const saved=JSON.parse(JSON.stringify(automation.capture({message:'중첩 표 구조 변경',operations:[axis],sourceIds:[]},base)));
     const locked=structuredClone(base);delete locked.structure!.nestedTables![0].axisEditable;
     assert.throws(()=>automation.prepare(saved,locked,values,{},{[target]:target}),/원문.*격자/);
     const next=automation.prepare(saved,base,values,{},{[target]:target}),token=live.saveSnapshot();
     try{
      executeDocumentOperations(live,base,next.operations);
      const artifact=format==='hwp'?live.exportHwpWithReport():live.exportHwpxWithReport();
      try{
       const bytes=artifact.takeBytes();
       verifyPreservedExport(live,bytes,format,artifact.contentLoss(),content=>new engine.HwpDocument(content));
       const reopened=new engine.HwpDocument(bytes);
       try{
        const structure=readStructure(reopened),nested=structure.nestedTables![0];
        assert.deepEqual([nested.rows,nested.columns],[rows,columns]);
        assert.deepEqual([...nested.cells].sort((a,b)=>a.row-b.row||a.column-b.column).map(cell=>cell.text),texts);
        assert.equal(structure.tables[0].cells[0].text,base.structure!.tables[0].cells[0].text);
       }finally{reopened.free();}
      }finally{artifact.free();}
      live.restoreSnapshot(token);assert.deepEqual(encode(live),before);
     }finally{live.discardSnapshot(token);}
    }
   }finally{live.free();}
  }
 }finally{source.free();}
});

test('deleting a nested row remeasures its outer cell and preserves the published layout on save',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const engine=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await engine.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const original=engine.HwpDocument.createEmpty();
 try{
  original.createBlankDocument();
  original.pasteHtml(0,0,0,'<table><tr><td>바깥<table><tr><td>처음 왼쪽</td><td>처음 오른쪽</td></tr><tr><td>둘째 왼쪽</td><td>둘째 오른쪽</td></tr></table></td></tr></table>');
  for(const format of ['hwp','hwpx'] as const){
   const encoded=format==='hwp'?original.exportHwp():original.exportHwpx();
   for(const index of [0,1]){
    const live=new engine.HwpDocument(encoded);
    const undo=live.saveSnapshot();
    try{
     const structure=readStructure(live), target=structure.nestedTables![0].id;
     const base:Snapshot={name:`nested.${format}`,revision:'v1',nodes:[],limitations:[],structure};
     const initialLayout=JSON.parse(live.getPageControlLayout(0));
     const owner=initialLayout.controls.find((item:{type:string})=>item.type==='table');
     const originalBytes=format==='hwp'?live.exportHwp():live.exportHwpx();
     executeDocumentOperations(live,base,[{kind:'delete_table_row',target,index}]);
     const artifact=format==='hwp'?live.exportHwpWithReport():live.exportHwpxWithReport();
     try{
      const saved=artifact.takeBytes();
      verifyPreservedExport(live,saved,format,artifact.contentLoss(),bytes=>new engine.HwpDocument(bytes));
      const reopened=new engine.HwpDocument(saved);
      try{
       const updated=readStructure(reopened);
       const expected=index===0?['둘째 왼쪽','둘째 오른쪽']:['처음 왼쪽','처음 오른쪽'];
       assert.deepEqual(updated.nestedTables?.[0].cells.map(cell=>cell.text),expected);
       assert.equal(updated.tables[0].cells[0].text,structure.tables[0].cells[0].text);
       const resized=JSON.parse(reopened.getPageControlLayout(0)).controls.find((item:{type:string})=>item.type==='table');
       assert(resized.h<owner.h,`${format} ${index}: the parent row should shrink with the nested table`);
      }finally{reopened.free();}
     }finally{artifact.free();}
     live.restoreSnapshot(undo);
     assert.deepEqual(format==='hwp'?live.exportHwp():live.exportHwpx(),originalBytes);
     assert.deepEqual(JSON.parse(live.getPageControlLayout(0)),initialLayout);
    }finally{live.discardSnapshot(undo);live.free();}
   }
  }
 }finally{original.free();}
});

test('a deeper nested cell macro verifies the entire owner path before replay',{
 skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
 const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
 const engine=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
 await engine.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
 const automation=createAutomationFacade(),source=engine.HwpDocument.createEmpty();
 try{
  source.createBlankDocument();
  source.pasteHtml(0,0,0,'<table><tr><td>바깥<table><tr><td>가운데<table><tr><td>안쪽</td></tr></table></td></tr></table></td></tr></table>');
  for(const format of ['hwp','hwpx']){
   const encode=(doc:any)=>format==='hwp'?doc.exportHwp():doc.exportHwpx();
   const live=new engine.HwpDocument(encode(source));
   try{
    const evidence:Record<string,string>={},structure=readStructure(live,evidence);
    const base:Snapshot={name:`nested.${format}`,revision:'v1',nodes:[],limitations:[],structure,nestedTableTemplateEvidence:evidence};
    const deep=structure.nestedTables!.find(table=>table.ancestors.length===2)!;
    const outer=structure.nestedTables!.find(table=>table.ancestors.length===1)!;
    const op:EditOp={kind:'set_table_cell',target:deep.id,row:0,column:0,originalText:'안쪽',text:'{{새 값}}'};
    const template=automation.capture({message:'가장 안쪽 셀',sourceIds:[],operations:[op]},base);
    assert.throws(()=>automation.prepare(template,base,{'새 값':'재생'},{},{[deep.id]:outer.id}),/원문.*격자/);
    const plan=automation.prepare(template,base,{'새 값':'재생'},{},{[deep.id]:deep.id});
    executeDocumentOperations(live,base,plan.operations);
    const reopened=new engine.HwpDocument(encode(live));
    try{
     const tables=readStructure(reopened).nestedTables!;
     assert.equal(tables.find(table=>table.id===deep.id)!.cells[0].text,'재생');
     assert.deepEqual(tables.find(table=>table.id===outer.id),outer);
    }finally{reopened.free();}
   }finally{live.free();}
  }
 }finally{source.free();}
});
