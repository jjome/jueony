import {validateBodyCaret} from './body-caret.ts';
import type {TextBoxBookmark} from '../public/contracts.ts';
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=2147483647;
export function validateTextBoxBookmark(value:any):TextBoxBookmark|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value)||value.kind!=='textbox'||value.focus?.kind!=='body'||!integer(value.control)||typeof value.storyFingerprint!=='string'||!/^[a-f0-9]{64}$/u.test(value.storyFingerprint))return;
 const host=validateBodyCaret(value.focus.caret),caret=validateBodyCaret(value.caret),anchor=value.anchor===undefined?undefined:validateBodyCaret(value.anchor);
 if(!host||!caret||host.section!==caret.section||value.anchor!==undefined&&(!anchor||anchor.section!==caret.section))return;
 return {kind:'textbox',focus:{kind:'body',caret:host},control:value.control,caret,...(anchor?{anchor}:{}),storyFingerprint:value.storyFingerprint};
}
