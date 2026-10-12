import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStyleDefinition} from '../src/modules/document/public/index.ts';
import {styleDraftPreview} from '../src/adapters/rhwp/style-management.ts';
const styles=[{id:0,name:'바탕글',englishName:'Normal',type:0 as const,nextStyleId:0},{id:1,name:'강조',englishName:'Emphasis',type:1 as const,nextStyleId:0}];
test('style contracts reject duplicate, malformed and overflowing definitions before mutations',()=>{
  const value={name:'새 스타일',englishName:'',type:0 as const,nextStyleId:0};
  assert.deepEqual(validateStyleDefinition(styles,{...value,name:' 새 스타일 '}),value);
  for(const patch of [{name:''},{name:'바탕글'},{englishName:'Emphasis'},{name:'줄\n바꿈'},{name:'가'.repeat(251)},{nextStyleId:1},{nextStyleId:255}])assert.throws(()=>validateStyleDefinition(styles,{...value,...patch}));
  assert.throws(()=>validateStyleDefinition(Array.from({length:256},(_,id)=>({...styles[0],id,name:'스타일'+id})),value));
  assert.throws(()=>validateStyleDefinition(styles,{...value,type:1},0));
  assert.equal(validateStyleDefinition(styles,{...value,type:1,nextStyleId:1}).nextStyleId,0);
});
test('renaming a style preserves its identity and rejects names owned by other styles',()=>{
  assert.equal(validateStyleDefinition(styles,{...styles[0]},0).name,'바탕글');
  assert.throws(()=>validateStyleDefinition(styles,{...styles[0],name:'강조'},0));
});
test('draft preview preserves the original and converts paragraph raw values back to display units',()=>{
  const original={marginLeft:0,indent:0,lineSpacingType:'Percent',lineSpacing:160};
  assert.deepEqual(styleDraftPreview(original,{marginLeft:1500,indent:-750,lineSpacingType:'Fixed',lineSpacing:1500},'para'),{marginLeft:10,indent:-5,lineSpacingType:'Fixed',lineSpacing:20});
  assert.equal(original.marginLeft,0);
  const char={fontFamily:'기존',fontFamilies:Array(7).fill('기존'),ratios:Array(7).fill(100)};
  const preview=styleDraftPreview(char,{fontName:'새 글꼴',ratios:Array(7).fill(90)},'char');preview.ratios[0]=70;
  assert.equal(char.ratios[0],100);assert.equal(char.fontFamily,'기존');assert.equal(preview.fontFamily,'새 글꼴');
});
