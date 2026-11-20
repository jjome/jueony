import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {exportStylePackage,importStylePackage} from '../src/adapters/rhwp/style-package-native.ts';

const packageRoot=process.env.JUEONY_ENGINE_PACKAGE;

async function engine(){
  if(!packageRoot)throw new Error('JUEONY_ENGINE_PACKAGE is required');
  const root=resolve(packageRoot),module:any=await import(pathToFileURL(resolve(root,'rhwp.js')).href+`?n011=${Date.now()}`);
  await module.default({module_or_path:await readFile(resolve(root,'rhwp_bg.wasm'))});
  return module.HwpDocument;
}

const simpleDecoration={
  borderLeft:{type:1,width:5,color:'#123456'},borderRight:{type:0,width:0,color:'#000000'},
  borderTop:{type:1,width:3,color:'#654321'},borderBottom:{type:1,width:5,color:'#123456'},
  fillType:'solid',fillColor:'#abcdef',patternColor:'#000000',patternType:-1,
};

function createCharacterStyle(document:any,name:string,decoration:any){
  const inserted=JSON.parse(document.insertParagraph(0,document.getParagraphCount(0)-1)),paragraph=inserted.paraIdx;
  assert.equal(inserted.ok,true);assert.equal(JSON.parse(document.insertText(0,paragraph,0,'가')).ok,true);
  assert.equal(JSON.parse(document.applyCharFormat(0,paragraph,0,1,JSON.stringify(decoration))).ok,true);
  const charShapeId=JSON.parse(document.getCharPropertiesAt(0,paragraph,0)).charShapeId;
  const id=document.createStyle(JSON.stringify({name,englishName:name+'English',type:1,nextStyleId:0,baseCharShapeId:charShapeId}));
  assert.equal(JSON.parse(document.deleteParagraph(0,paragraph)).ok,true);
  return id;
}

test('simple character BorderFill imports through a real CharShape resource and survives HWP/HWPX', {skip:!packageRoot}, async()=>{
  const HwpDocument=await engine(),source=HwpDocument.createEmpty(),target=HwpDocument.createEmpty();source.createBlankDocument();target.createBlankDocument();
  try{
    const styleId=createCharacterStyle(source,'문자 테두리',simpleDecoration),beforeHwp=source.exportHwp(),beforeHwpx=source.exportHwpx();
    const value=exportStylePackage(source,[styleId]);
    assert.deepEqual(value.styles[0].char.decoration,simpleDecoration);
    assert.deepEqual(source.exportHwp(),beforeHwp);assert.deepEqual(source.exportHwpx(),beforeHwpx);
    target.insertText(0,0,0,'기존 본문');const targetText=target.getTextFileUnicode(),ids=importStylePackage(target,value);
    assert.equal(target.getTextFileUnicode(),targetText);
    for(const method of ['exportHwp','exportHwpx']){
      const reopened=new HwpDocument(target[method]());
      try{
        const detail=JSON.parse(reopened.getStyleDetail(ids[0])).charProps;
        for(const key of ['borderLeft','borderRight','borderTop','borderBottom'])assert.deepEqual(detail[key],simpleDecoration[key],method+':'+key);
        assert.equal(detail.fillType,'solid',method);assert.equal(detail.fillColor,'#abcdef',method);assert.equal(detail.patternType,-1,method);
        assert.equal(reopened.getTextFileUnicode(),targetText,method);
      }finally{reopened.free();}
    }
  }finally{source.free();target.free();}
});

test('advanced character borders and paragraph outline/number references remain exact fail-closed capabilities', {skip:!packageRoot}, async()=>{
  const HwpDocument=await engine(),document=HwpDocument.createEmpty();document.createBlankDocument();
  try{
    const advanced=createCharacterStyle(document,'고급 문자 테두리',{...simpleDecoration,borderLeft:{type:2,width:5,color:'#123456'}}),before=document.exportHwpx();
    assert.throws(()=>exportStylePackage(document,[advanced]),/고급 테두리·무늬·그라데이션/);
    assert.deepEqual(document.exportHwpx(),before);
    const numberingDefinitions=JSON.parse(document.getAgentNumberingDefinitions());
    assert.equal(numberingDefinitions.find((item:any)=>item.id===1)?.editable,false);
    assert.deepEqual(JSON.parse(document.getAgentOutlineDefinition(0)),{definitionId:1});
    assert.throws(()=>exportStylePackage(document,[2]),/번호·개요/);
    document.insertParagraph(0,0);assert.equal(JSON.parse(document.applyParaFormat(0,1,JSON.stringify({headType:'Number',numberingId:1,paraLevel:0}))).ok,true);
    const paraShapeId=JSON.parse(document.getParaPropertiesAt(0,1)).paraShapeId,numbered=document.createStyle(JSON.stringify({name:'번호 스타일',englishName:'Numbered',type:0,nextStyleId:0,baseParaShapeId:paraShapeId}));
    document.deleteParagraph(0,1);const numberedBefore=document.exportHwpx();
    assert.throws(()=>exportStylePackage(document,[numbered]),/번호·개요/);
    assert.deepEqual(document.exportHwpx(),numberedBefore);
  }finally{document.free();}
});

test('malformed portable character BorderFill fails before target mutation', {skip:!packageRoot}, async()=>{
  const HwpDocument=await engine(),source=HwpDocument.createEmpty(),target=HwpDocument.createEmpty();source.createBlankDocument();target.createBlankDocument();
  try{
    const id=createCharacterStyle(source,'검증 문자 테두리',simpleDecoration),value:any=exportStylePackage(source,[id]);
    const update=target.updateStyleShapes.bind(target),rollbackHwp=target.exportHwp(),rollbackHwpx=target.exportHwpx();target.updateStyleShapes=()=>false;
    try{assert.throws(()=>importStylePackage(target,value),/모양 또는 다음 스타일/);}finally{target.updateStyleShapes=update;}
    assert.deepEqual(target.exportHwp(),rollbackHwp);assert.deepEqual(target.exportHwpx(),rollbackHwpx);
    value.styles[0].char.decoration.borderLeft.type=2;
    const beforeHwp=target.exportHwp(),beforeHwpx=target.exportHwpx(),beforeStyles=target.getStyleList();
    assert.throws(()=>importStylePackage(target,value),/허용 범위|기본 없음 또는 실선/);
    assert.deepEqual(target.exportHwp(),beforeHwp);assert.deepEqual(target.exportHwpx(),beforeHwpx);assert.equal(target.getStyleList(),beforeStyles);
  }finally{source.free();target.free();}
});
