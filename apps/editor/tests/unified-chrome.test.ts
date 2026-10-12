import test from 'node:test';
import assert from 'node:assert/strict';
import {menuNavigationIndex,menuCommandEnabled} from '../src/unified-chrome.ts';

test('menu arrows skip unavailable items and wrap in both directions',()=>{
 assert.equal(menuNavigationIndex([true,false,true,false],0,'ArrowDown'),2);
 assert.equal(menuNavigationIndex([true,false,true,false],2,'ArrowDown'),0);
 assert.equal(menuNavigationIndex([true,false,true,false],0,'ArrowUp'),2);
 assert.equal(menuNavigationIndex([true,false,true,false],2,'ArrowLeft'),0);
 assert.equal(menuNavigationIndex([true,false,true,false],0,'ArrowRight'),2);
});
test('menu Home/End select boundaries without visiting disabled items',()=>{
 assert.equal(menuNavigationIndex([false,true,true,false],2,'Home'),1);
 assert.equal(menuNavigationIndex([false,true,true,false],1,'End'),2);
});
test('menu navigation tolerates a removed or disabled focused entry',()=>{
 assert.equal(menuNavigationIndex([false,true,false,true],0,'ArrowDown'),1);
 assert.equal(menuNavigationIndex([false,true,false,true],-1,'ArrowUp'),3);
 assert.equal(menuNavigationIndex([false,false],0,'Home'),-1);
 assert.equal(menuNavigationIndex([],0,'ArrowDown'),-1);
});
test('menu-specific gates cannot be overridden by a generally enabled command',()=>{
 assert.equal(menuCommandEnabled(false,true),false);
 assert.equal(menuCommandEnabled(true,false),false);
 assert.equal(menuCommandEnabled(true,undefined),false);
 assert.equal(menuCommandEnabled(true,true),true);
});
