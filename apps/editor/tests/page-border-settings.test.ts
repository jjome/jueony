import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPageGradient,validatePageBorderSettings,samePageBorderSettings,pageSpacingFromInput} from '../src/modules/document/public/index.ts';
import {readPageBorderSettings,writePageBorderSettings,collectPageBorderSettings,planPageBorderEdits,executePageBorderEdits,supportsPageBorderInclusion,supportsPageBorderFillArea} from '../src/adapters/rhwp/page-border-settings.ts';
const settings=()=>({kind:'both' as const,applyPage:'all' as const,fillType:'solid',spacingLeft:1417,spacingRight:1417,spacingTop:1417,spacingBottom:1417,fillColor:'#ffffff',patternType:-1});

test('border-region filling requires engine capability while existing stored values remain preservable',()=>{
 let writes=0;const wasm={getPageBorderFillEntry:()=>JSON.stringify({...settings(),fillArea:'paper'}),setPageBorderFillEntry:()=>{writes++;return '{"ok":true}';}};
 assert.equal(supportsPageBorderFillArea(undefined),false);assert.equal(supportsPageBorderFillArea(wasm),false);
 assert.throws(()=>writePageBorderSettings(wasm,0,'both',{...settings(),fillArea:'border'}),/배경 배치/);assert.equal(writes,0);
 const capable={...wasm,pageBorderFillAreaEnabled:()=>true};assert.equal(supportsPageBorderFillArea(capable),true);writePageBorderSettings(capable,0,'both',{...settings(),fillArea:'border'});assert.equal(writes,1);
 const existing={...wasm,getPageBorderFillEntry:()=>JSON.stringify({...settings(),fillArea:'border'})};writePageBorderSettings(existing,0,'both',{...settings(),fillArea:'border',fillColor:'#123456'});assert.equal(writes,2);
});
test('validates two-color native gradients and rejects unsupported stop fidelity or invalid coordinates',()=>{
 const value={...settings(),fillType:'gradient',gradient:defaultPageGradient()};assert.deepEqual(validatePageBorderSettings(value),value);
 for(const gradient of [{...value.gradient,colors:['#fff','#000000']},{...value.gradient,colors:['#ffffff','#123456','#000000']},{...value.gradient,angle:361},{...value.gradient,centerX:-1},{...value.gradient,positions:[0,100]}])assert.throws(()=>validatePageBorderSettings({...value,gradient}));
});
test('unmodified spacing retains sub-display-unit raw HWP values; invalid mm is rejected',()=>{
 assert.equal(pageSpacingFromInput(1418,'5'),1418);assert.equal(pageSpacingFromInput(1418,'6'),1701);
 for(const value of ['','NaN','-1','26'])assert.throws(()=>pageSpacingFromInput(1417,value));
});
test('semantic no-op ignores native reference allocation and unrelated attr bits',()=>{
 assert.equal(samePageBorderSettings({...settings(),borderFillId:3,attr:0},{...settings(),borderFillId:6,attr:32}),true);
 assert.equal(samePageBorderSettings(settings(),{...settings(),headerInside:true}),false);
 assert.equal(samePageBorderSettings(settings(),{...settings(),kind:'even'}),false);
 assert.equal(samePageBorderSettings({...settings(),borderTop:{type:0,width:0,color:'#000000'}},{...settings(),borderTop:{type:1,width:0,color:'#000000'}}),false);
});
test('adapter reads native entry and routes parity settings through new capability',()=>{
 const calls:any[]=[];const wasm={getPageBorderFillEntry:(s:number,k:string)=>JSON.stringify({...settings(),kind:k}),setPageBorderFillEntry:(...args:any[])=>{calls.push(args);return '{"ok":true}';}};
 assert.equal(readPageBorderSettings(wasm,0,'odd').kind,'odd');writePageBorderSettings(wasm,0,'odd',settings());
 assert.equal(calls[0][1],'odd');assert.equal(JSON.parse(calls[0][2]).kind,'odd');
});
test('legacy engine exposes all/except-first only and refuses unsupported commands',()=>{
 let count=0;const wasm={getPageBorderFill:settings,setPageBorderFill:()=>{count++;return {ok:true};}};
 writePageBorderSettings(wasm,0,'both',settings());assert.equal(count,1);
 assert.throws(()=>readPageBorderSettings(wasm,0,'odd'));
 assert.throws(()=>writePageBorderSettings(wasm,0,'both',{...settings(),applyPage:'firstOnly'}));
 assert.throws(()=>writePageBorderSettings(wasm,0,'both',{...settings(),fillType:'gradient',gradient:defaultPageGradient()}));assert.equal(count,1);
});
test('explicit application changes reset all scope flags while unchanged mixed visibility is preserved',()=>{
 const calls:any[]=[];const mixed={...settings(),hideBorder:true,hideFill:false,firstPageBorder:false,firstPageFill:true};
 const wasm={getPageBorderFillEntry:()=>JSON.stringify(mixed),setPageBorderFillEntry:(s:number,k:string,json:string)=>{calls.push(JSON.parse(json));return '{"ok":true}';}};
 writePageBorderSettings(wasm,0,'both',mixed);
 assert.deepEqual(['hideBorder','hideFill','firstPageBorder','firstPageFill'].map(key=>calls[0][key]),[true,false,false,true]);
 writePageBorderSettings(wasm,0,'both',{...mixed,applyPage:'firstOnly'});
 assert.deepEqual(['hideBorder','hideFill','firstPageBorder','firstPageFill'].map(key=>calls[1][key]),[false,false,true,true]);
});
test('dialog collection preserves untouched no-hatch raw values and mixed section flags',()=>{
 const border={type:0,width:0,color:'#000000'},current={...settings(),patternType:0,fillArea:'paper',basis:'paper',patternColor:'#000000',headerInside:false,footerInside:false,hideBorder:true,hideFill:false,firstPageBorder:false,firstPageFill:true,applyPage:'firstOnly' as const,
  ...Object.fromEntries(['Left','Right','Top','Bottom'].map(side=>[`border${side}`,border]))};
 const dialog={settings:current,jueonyKind:'both',jueonyApplicationChanged:false,radioValue:(name:string)=>name==='page-border-apply'?'firstOnly':'paper',basisPaper:{checked:true},spacingInputs:Object.fromEntries(['Left','Right','Top','Bottom'].map(side=>[side,{value:'5'}])),borderNoneCheck:{checked:true},borderEdits:{Left:border,Right:border,Top:border,Bottom:border},jueonyHeaderInside:{checked:false},jueonyFooterInside:{checked:false},bgColorRadio:{checked:true},bgNoneRadio:{checked:false},bgColorInput:{value:'#ffffff'},bgPatternColorInput:{value:'#000000'},bgPatternSelect:{value:'0'}};
 const next=collectPageBorderSettings(dialog);assert.equal(next.patternType,0);assert.equal(samePageBorderSettings(current,next),true);
 const newSolid=collectPageBorderSettings({...dialog,settings:{...current,fillType:'none'}});assert.equal(newSolid.patternType,-1,'new solid fill must explicitly encode no hatch for both formats');
});

test('whole-document border plan retains explicit parity after a both reset and refuses stale baselines',()=>{
 const kinds=['both','even','odd'] as const;
 const sections=[0,1].map(section=>new Map(kinds.map(kind=>[kind,{...settings(),kind,fillColor:section?'#333333':kind==='odd'?'#aa0000':'#ffffff'}])));
 const wasm={getSectionCount:()=>2,getPageBorderFillEntry:(section:number,kind:any)=>JSON.stringify(sections[section].get(kind)),setPageBorderFillEntry:(section:number,kind:any,json:string)=>{const value=JSON.parse(json);if(kind==='both')for(const key of kinds)sections[section].set(key,{...value,kind:key});else sections[section].set(kind,value);return '{"ok":true}';}};
 const odd={...readPageBorderSettings(wasm,0,'odd'),fillColor:'#00aa00'};
 const edits=planPageBorderEdits(wasm,0,new Map([['odd',odd]]),'document');executePageBorderEdits(wasm,edits);
 for(const s of sections){assert.equal(s.get('both')!.fillColor,'#ffffff');assert.equal(s.get('even')!.fillColor,'#ffffff');assert.equal(s.get('odd')!.fillColor,'#00aa00');}
 assert.deepEqual(planPageBorderEdits(wasm,0,new Map([['odd',odd]]),'document'),[]);
 const pending=planPageBorderEdits(wasm,0,new Map([['odd',{...odd,fillColor:'#123456'}]]),'document');
 sections[1].set('odd',{...odd,fillColor:'#999999'});assert.throws(()=>executePageBorderEdits(wasm,pending),/바뀌었습니다/);assert.equal(sections[0].get('odd')!.fillColor,'#00aa00');
 assert.throws(()=>planPageBorderEdits(wasm,0,new Map([['odd',{...odd,fillType:'image'}]]),'document'),/그림 배경/);
 assert.equal(supportsPageBorderInclusion(undefined),false);assert.equal(supportsPageBorderInclusion({pageBorderInclusionEnabled:()=>true}),true);
});
