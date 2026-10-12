import test from 'node:test';
import assert from 'node:assert/strict';
import {paragraphSpacingChange} from '../src/shortcuts/paragraph-spacing.ts';
import {HangulKeyResolver} from '../src/shortcuts/keymap.ts';

test('relative paragraph values use native 2x HWPUNIT without flattening existing differences',()=>{
 assert.deepEqual(paragraphSpacingChange({marginLeft:200,marginRight:400},'both-more'),{marginLeft:400,marginRight:600});
 assert.deepEqual(paragraphSpacingChange({indent:0},'indent-less'),{indent:-200});
 assert.deepEqual(paragraphSpacingChange({indent:-200},'indent-more'),{indent:0});
 assert.deepEqual(paragraphSpacingChange({marginLeft:2005},'left-more'),{marginLeft:2205});
 assert.deepEqual(paragraphSpacingChange({marginLeft:0},'left-less'),{});
 assert.deepEqual(paragraphSpacingChange({marginRight:199800},'right-more'),{});
 assert.throws(()=>paragraphSpacingChange({marginLeft:NaN},'left-more'));
 assert.throws(()=>paragraphSpacingChange({},'anything'));
});

test('official paragraph key aliases and repeat events resolve the same relative command',()=>{
 const resolver=new HangulKeyResolver(),ctx={table:false,cells:false,object:false};
 for(const [keys,operation] of [['Ctrl+Alt+F5','left-less'],['Ctrl+Shift+E','left-less'],['Ctrl+Alt+F6','left-more'],['Ctrl+Shift+G','left-more'],['Ctrl+Alt+F7','right-more'],['Ctrl+Shift+D','right-more'],['Ctrl+Alt+F8','right-less'],['Ctrl+Shift+F','right-less'],['Ctrl+F5','indent-less'],['Ctrl+Shift+O','indent-less'],['Ctrl+F6','indent-more'],['Ctrl+Shift+I','indent-more'],['Ctrl+F7','both-less'],['Ctrl+F8','both-more']]){
  const parts=keys.split('+'),key=parts.at(-1)!;
  const e={key,code:key.length===1?'Key'+key:key,ctrlKey:true,altKey:parts.includes('Alt'),shiftKey:parts.includes('Shift'),metaKey:false,repeat:true,isComposing:false};
  assert.equal(resolver.resolve(e,ctx).binding?.params?.operation,operation,keys);
 }
 assert.equal(resolver.resolve({key:'F6',code:'F6',ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,repeat:true,isComposing:false},ctx).binding,undefined);
});
