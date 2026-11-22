import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {executeDocumentOperations} from '../src/adapters/rhwp/execute.ts';
import {readStructure} from '../src/adapters/rhwp/structure.ts';
import {verifyPreservedExport} from '../src/adapters/rhwp/preservation.ts';
import {defaultPageGradient,validateEditOperations,type Snapshot} from '../src/modules/document/public/index.ts';

test('Agent page-border inclusion preserves parity layouts, text and flags in HWP and HWPX',{
  skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
  const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
  const engine=await import(pathToFileURL(resolve(pkg,'rhwp.js')).href);
  await engine.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
  const kinds=['both','even','odd'];
  const source=engine.HwpDocument.createEmpty();
  const read=(doc:any)=>kinds.map(kind=>JSON.parse(doc.getPageBorderFillEntry(0,kind)));
  try{
    source.createBlankDocument();
    source.insertText(0,0,0,'테두리를 제외한 내용은 그대로');
    for(const [index,kind] of kinds.entries()){
      const basis=JSON.parse(source.getPageBorderFillEntry(0,kind));
      source.setPageBorderFillEntry(0,kind,JSON.stringify({...basis,basis:'page',headerInside:false,footerInside:index===1,
        spacingTop:200+index*70,fillType:'solid',fillColor:['#fff2cc','#bbccdd','#efe9ed'][index]}));
    }
    for(const format of ['hwp','hwpx']){
      const encode=(doc:any)=>format==='hwpx'?doc.exportHwpx():doc.exportHwp();
      const doc=new engine.HwpDocument(encode(source));
      try{
        const snapshot:Snapshot={revision:'border',name:`a.${format}`,nodes:[],limitations:[],structure:readStructure(doc)};
        assert.equal(snapshot.structure!.sections[0].pageBorderInclusion?.editable,true);
        const op={kind:'set_page_setup',section:0,properties:{borderIncludesHeader:true}};
        assert.throws(()=>validateEditOperations([{...op,properties:{...op.properties,widthMm:210}}],snapshot),/속성/);
        const before=read(doc),beforeBytes=encode(doc),undo=doc.saveSnapshot();
        try{
          executeDocumentOperations(doc,snapshot,validateEditOperations([op],snapshot));
          const actual=read(doc);
          for(const [index,value] of actual.entries()){
            const {attr:bits,headerInside,...other}=value;
            const {attr:previousBits,headerInside:previousHeader,...original}=before[index];
            assert.equal(previousHeader,false);
            assert.equal(headerInside,true);
            assert.equal(bits^previousBits,2);
            assert.deepEqual(other,original);
          }
          const artifact=format==='hwpx'?doc.exportHwpxWithReport():doc.exportHwpWithReport();
          try{
            const bytes=artifact.takeBytes();
            verifyPreservedExport(doc,bytes,format,artifact.contentLoss(),content=>new engine.HwpDocument(content));
            const reopened=new engine.HwpDocument(bytes);
            try{assert.deepEqual(read(reopened),actual);}finally{reopened.free();}
          }finally{artifact.free();}
          doc.restoreSnapshot(undo);
          assert.deepEqual(encode(doc),beforeBytes);
        }finally{doc.discardSnapshot(undo);}
      }finally{doc.free();}
    }
    const paper=JSON.parse(source.getPageBorderFillEntry(0,'odd'));
    source.setPageBorderFillEntry(0,'odd',JSON.stringify({...paper,basis:'paper'}));
    const snapshot:Snapshot={revision:'paper',name:'paper.hwpx',nodes:[],limitations:[],structure:readStructure(source)};
    assert.throws(()=>validateEditOperations([{kind:'set_page_setup',section:0,properties:{borderIncludesFooter:true}}],snapshot),/쪽 기준/);
  }finally{source.free();}
});

test('selected and all existing sections keep different pages, parity settings, gradients and embedded backgrounds',{
  skip:!process.env.JUEONY_ENGINE_PACKAGE&&'requires the restored Jueony engine',
},async()=>{
  const pkg=resolve(process.env.JUEONY_ENGINE_PACKAGE!);
  const engine=await import(pathToFileURL(resolve(pkg,'rhwp.js')));
  await engine.default({module_or_path:await readFile(resolve(pkg,'rhwp_bg.wasm'))});
  const kinds=['both','even','odd'];
  const source=engine.HwpDocument.createEmpty();
  const read=(doc:any)=>Array.from({length:3},(_,section)=>kinds.map(kind=>JSON.parse(doc.getPageBorderFillEntry(section,kind))));
  const picture=await readFile(new URL('../fixtures/page-background/background-bands.png',import.meta.url));
  const readPictures=(doc:any)=>kinds.map(kind=>Buffer.from(doc.getPageBackgroundImageBytes(1,kind)));
  try{
    source.createBlankDocument();
    const asset=JSON.parse(source.registerPageBackgroundImage(picture,'png'));
    assert.equal(asset.ok,true);
    for(let section=0;section<3;section++){
      if(section){const parent=section-1;source.insertSectionBreak(parent,0,source.getParagraphLength(parent,0));}
      source.insertText(section,0,0,`${section+1}구역 본문`);
      source.setPageDef(section,JSON.stringify({marginLeft:8504+section*340,landscape:section===1}));
      for(const [index,kind] of kinds.entries()){
        const basis=JSON.parse(source.getPageBorderFillEntry(section,kind));
        const background=section===2?{fillType:'gradient',gradient:{...defaultPageGradient(),angle:index*45}}:
          section===1?{fillType:'image',image:{binDataId:asset.binDataId,mode:['tile','center','zoom'][index],brightness:0,contrast:0,effect:0}}:
            {fillType:'solid',fillColor:['#fff2cc','#bbccdd','#efe9ed'][index]};
        const set=source.setPageBorderFillEntry(section,kind,JSON.stringify({...basis,...background,basis:'page',
          headerInside:false,footerInside:index===1,spacingTop:300+section*160+index*70}));
        assert.equal(JSON.parse(set).ok,true);
      }
    }
    for(const format of ['hwp','hwpx']){
      const encode=(doc:any)=>format==='hwpx'?doc.exportHwpx():doc.exportHwp();
      const doc=new engine.HwpDocument(encode(source));
      try{
        const snapshot=():Snapshot=>({revision:'border',name:`a.${format}`,nodes:[],limitations:[],structure:readStructure(doc)});
        const before=read(doc),pages=[0,1,2].map(section=>doc.getPageDef(section)),text=doc.getTextFileUnicode();
        assert(before[2].every(item=>item.fillType==='gradient'));
        assert.deepEqual(readPictures(doc),[picture,picture,picture]);
        const originalBytes=encode(doc),undo=doc.saveSnapshot();
        const selective={kind:'set_page_border_inclusion',sections:[2,0],headerInside:true};
        const documentWide={kind:'set_page_border_inclusion',sections:[0,1,2],footerInside:true};
        try{
          assert.throws(()=>validateEditOperations([{...selective,sections:[0,0]}],snapshot()),/겹치지/);
          assert.throws(()=>validateEditOperations([{...selective,sections:[0,9]}],snapshot()),/쪽 기준/);
          assert.throws(()=>validateEditOperations([selective,documentWide],snapshot()),/다른 편집/);
          executeDocumentOperations(doc,snapshot(),validateEditOperations([selective],snapshot()));
          assert.deepEqual(read(doc)[1],before[1]);
          assert.deepEqual(read(doc).map(entries=>entries.map(entry=>entry.headerInside)),[[true,true,true],[false,false,false],[true,true,true]]);
          executeDocumentOperations(doc,snapshot(),validateEditOperations([documentWide],snapshot()));
          const actual=read(doc);
          for(const [section,entries] of actual.entries())for(const [index,value] of entries.entries()){
            const {attr:bits,borderFillId:actualId,headerInside,footerInside,...unchanged}=value;
            const {attr:oldBits,borderFillId:originalId,headerInside:oldHeader,footerInside:oldFooter,...original}=before[section][index];
            assert.deepEqual(unchanged,original);
            if(value.fillType==='solid')assert.equal(actualId,originalId);
            assert.equal(headerInside,section!==1);
            assert.equal(footerInside,true);
            assert.equal(bits^oldBits,(headerInside!==oldHeader?2:0)|(footerInside!==oldFooter?4:0));
          }
          assert.deepEqual([0,1,2].map(section=>doc.getPageDef(section)),pages);
          assert.equal(doc.getTextFileUnicode(),text);
          assert.deepEqual(readPictures(doc),[picture,picture,picture]);
          const artifact=format==='hwpx'?doc.exportHwpxWithReport():doc.exportHwpWithReport();
          try{
            const bytes=artifact.takeBytes();
            verifyPreservedExport(doc,bytes,format,artifact.contentLoss(),content=>new engine.HwpDocument(content));
            const reopened=new engine.HwpDocument(bytes);
            try{assert.deepEqual(read(reopened),actual);assert.deepEqual(readPictures(reopened),[picture,picture,picture]);}finally{reopened.free();}
          }finally{artifact.free();}
          doc.restoreSnapshot(undo);
          assert.deepEqual(encode(doc),originalBytes);
          const validTargets=snapshot();
          const paper={...read(doc)[2][2],basis:'paper'};
          doc.setPageBorderFillEntry(2,'odd',JSON.stringify(paper));
          const unsupportedBytes=encode(doc);
          assert.throws(()=>executeDocumentOperations(doc,validTargets,validateEditOperations([{...selective,sections:[0,2]}],validTargets)),/현재 설정/);
          assert.deepEqual(encode(doc),unsupportedBytes);
          const originalRead=doc.getPageBackgroundImageBytes.bind(doc);
          doc.getPageBackgroundImageBytes=()=>new Uint8Array();
          try{
            const pictureTarget={...selective,sections:[0,1]};
            assert.throws(()=>executeDocumentOperations(doc,snapshot(),validateEditOperations([pictureTarget],snapshot())),/기존 그림 배경/);
            assert.deepEqual(encode(doc),unsupportedBytes);
          }finally{doc.getPageBackgroundImageBytes=originalRead;}
        }finally{doc.discardSnapshot(undo);}
      }finally{doc.free();}
    }
  }finally{source.free();}
});
