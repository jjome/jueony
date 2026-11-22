import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { inspectDocumentLayout } from '../src/adapters/rhwp/layout-diagnostics.ts';

test('visible fragments distinguish a clipped cell from a supported row continuation and locate an isolated title', () => {
  const title = { text:'제목',secIdx:0,paraIdx:0,charStart:0,x:10,y:60,w:10,h:5 };
  const run = { text:'셀',secIdx:0,paraIdx:0,parentParaIdx:2,charStart:1,
    x:15,y:37,w:5,h:8,cellPath:[{controlIndex:0,cellIndex:24,cellParaIndex:0}] };
  const frame = (height:number) => ({type:'table',secIdx:0,paraIdx:2,controlIdx:0,x:10,y:20,w:25,h:height,
    cells:[{cellIdx:0,row:12,col:0,x:10,y:20,w:25,h:height}]});
  const doc = {
    pageCount:()=>2, getPageInfo:()=>({width:100,height:100}), getParagraphCount:()=>3,
    getPageControlLayout:(page:number)=>({controls:[frame(page===0?21:46)]}),
    getPageTextLayout:(page:number)=>({runs:page===0?[title,run]:[{...title,text:'본문',paraIdx:1,y:96},run]}),
    getCellInfo:(_section:number, _paragraph:number, _control:number, cell:number)=>{
      assert.equal(cell,24);return {row:12,col:0};
    },
    getStyleAt:()=>({name:'제목'}), getParaPropertiesAt:()=>({keepWithNext:true}),
  };
  const result=inspectDocumentLayout(doc);
  assert.deepEqual(result.findings.map(item=>[item.rule,item.page]),[['cell-overflow',0],['page-overflow',1],['isolated-heading',0]]);
  assert.deepEqual(result.findings[0].address.path,run.cellPath);
  assert.equal(result.checkedPages,2);
  assert.equal(inspectDocumentLayout({pageCount:()=>1}).status,'unavailable');
});

test('paper and cell boundaries include horizontal and upper clipping',()=>{
  const path=[{controlIndex:0,cellIndex:0,cellParaIndex:0}];
  const source={text:'검사 글줄',secIdx:0,paraIdx:0,charStart:0,w:10,h:8};
  const runs=[
    {...source,x:94,y:20},
    {...source,paraIdx:1,x:8,y:-2},
    {...source,parentParaIdx:2,x:36,y:31,cellPath:path,charStart:3},
  ];
  const frame={type:'table',secIdx:0,paraIdx:2,controlIdx:0,x:10,y:20,w:30,h:30,
    cells:[{row:0,col:0,x:10,y:20,w:30,h:30}]};
  const result=inspectDocumentLayout({
    pageCount:()=>1,getPageInfo:()=>({width:100,height:100}),getParagraphCount:()=>3,
    getPageControlLayout:()=>({controls:[frame]}),getPageTextLayout:()=>({runs}),
    getCellInfo:()=>({row:0,col:0}),getStyleAt:()=>({name:'본문'}),getParaPropertiesAt:()=>({}),
  });
  assert.deepEqual(result.findings.map(({rule,address})=>[rule,address.paragraph,address.offset]),[
    ['page-overflow',0,0],['page-overflow',1,0],['cell-overflow',2,3],
  ]);
  assert.deepEqual(result.findings[2].address.path,path);
});

test('page fragments, merged cells and expanded rows keep their document cell identities', {
  skip: !process.env.JUEONY_ENGINE_PACKAGE && 'requires the restored Jueony engine',
}, async () => {
  const pkg = resolve(process.env.JUEONY_ENGINE_PACKAGE!);
  const {default:init,HwpDocument} = await import(pathToFileURL(resolve(pkg,'rhwp.js')).href) as typeof import('@rhwp/core');
  await init({ module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm')) });
  const fixtures = [
    { rows:18, height:5000, pages:2 },
    { rows:3, height:4500, pages:1, merge:true, padding:true },
    { rows:3, height:1000, pages:2, padding:true, longText:true },
    { rows:2, height:4500, pages:1, paperOverflow:true },
  ];
  for (const fixture of fixtures) {
    const source=HwpDocument.createEmpty();
    try {
      source.createBlankDocument();
      source.splitParagraph(0,0,0);
      const at=[0,1,0] as const;
      source.createTable(...at,fixture.rows,2);
      if (fixture.merge) assert.equal(JSON.parse(source.mergeTableCells(...at,0,0,0,1)).ok,true);
      if (fixture.paperOverflow) assert.equal(JSON.parse(source.setTableProperties(...at,JSON.stringify({horzOffset:55000}))).ok,true);
      const {cellCount} = JSON.parse(source.getTableDimensions(...at));
      for (let index=0; index<cellCount; index++) {
        const text = fixture.longText ? '한글로 작성한 줄이 여러 줄로 보이도록 길게 입력한 본문 '.repeat(12) : `행 검사 ${index+1}`;
        source.insertTextInCell(...at,index,0,0,text);
        source.setCellProperties(...at,index,JSON.stringify({height:fixture.height,
          ...fixture.padding && {paddingTop:650,paddingBottom:650,applyInnerMargin:true}}));
      }
      for (const bytes of [source.exportHwp(),source.exportHwpx()]) {
        const opened = new HwpDocument(bytes);
        try {
          const originalFormat=opened.getSourceFormat();
          const snapshot=()=>originalFormat==='hwp'?opened.exportHwp():opened.exportHwpx();
          const before=snapshot();
          const result=inspectDocumentLayout(opened);
          assert.equal(result.checkedPages,fixture.pages);
          assert.equal(result.status,'checked',JSON.stringify(result));
          if (fixture.paperOverflow) {
            assert(result.findings.length>0);
            assert(result.findings.every(({rule,address})=>rule==='page-overflow'&&address.path?.length===1));
          } else assert.deepEqual(result.findings,[]);
          assert.deepEqual(snapshot(),before);
        } finally { opened.free(); }
      }
    } finally { source.free(); }
  }
});

test('same-numbered nested tables keep distinct ancestor paths and report only the clipped cell',()=>{
  const path=(outer:number)=>[{controlIndex:2,cellIndex:outer,cellParaIndex:1},{controlIndex:0,cellIndex:1,cellParaIndex:0}];
  const runs=[0,1].map(outer=>({text:'내부 글줄',secIdx:0,paraIdx:0,parentParaIdx:0,charStart:0,x:12,y:44,w:6,h:7,cellPath:path(outer)}));
  const lookup:string[]=[];
  const result=inspectDocumentLayout({
    pageCount:()=>1,getPageInfo:()=>({width:100,height:100}),getPageControlLayout:()=>({controls:[]}),getPageTextLayout:()=>({runs}),
    getCellInfoByPath:()=>({row:0,col:1}),
    getTableCellBboxesByPath:(_section:number,_paragraph:number,tablePath:string)=>{
      lookup.push(tablePath);
      const [parent,cell]=JSON.parse(tablePath);assert.equal(cell.cellIndex,0);
      return [{pageIndex:0,row:0,col:1,x:10,y:30,w:40,h:parent.cellIndex===0?18:40}];
    },
  });
  assert.equal(lookup.length,2);
  assert.equal(result.status,'checked');
  assert.deepEqual(result.findings.map(item=>[item.rule,item.address.path]),[['cell-overflow',path(0)]]);
});
