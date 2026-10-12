import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPageGradient,validatePageBorderSettings,samePageBorderSettings,pageSpacingFromInput} from '../src/modules/document/public/index.ts';
import {readPageBorderSettings,writePageBorderSettings,collectPageBorderSettings} from '../src/adapters/rhwp/page-border-settings.ts';
const settings=()=>({kind:'both' as const,applyPage:'all' as const,fillType:'solid',spacingLeft:1417,spacingRight:1417,spacingTop:1417,spacingBottom:1417,fillColor:'#ffffff',patternType:-1});
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
