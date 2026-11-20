import type {EndnotePoint,EndnoteSelectionBookmark} from '../public/contracts.ts';

const integer=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=2147483647;
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const object=(value:any):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value:Record<string,unknown>,keys:string[])=>{const actual=Object.keys(value).sort(),expected=[...keys].sort();return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);};

function point(value:any):EndnotePoint|undefined{
 if(!object(value)||!exactKeys(value,['paragraph','offset','paragraphLength','before','after'])||!integer(value.paragraph)||!integer(value.offset)||!integer(value.paragraphLength)||value.offset>value.paragraphLength||typeof value.before!=='string'||typeof value.after!=='string'||[...value.before].length>32||[...value.after].length>32)return;
 return {paragraph:value.paragraph,offset:value.offset,paragraphLength:value.paragraphLength,before:value.before,after:value.after};
}

export function validateEndnoteSelectionBookmark(value:any):EndnoteSelectionBookmark|undefined{
 if(!object(value)||value.version!==1||value.kind!=='endnote-selection'||!exactKeys(value,['version','kind','section','parent','control','page','index','virtualParagraph','focus',...(value.anchor===undefined?[]:['anchor']),'locatorFingerprint','ownerFingerprint','storyFingerprint'])||![value.section,value.parent,value.control,value.page,value.index,value.virtualParagraph].every(integer)||!digest(value.locatorFingerprint)||!digest(value.ownerFingerprint)||!digest(value.storyFingerprint))return;
 const focus=point(value.focus),anchor=value.anchor===undefined?undefined:point(value.anchor);if(!focus||value.anchor!==undefined&&!anchor)return;
 return {version:1,kind:'endnote-selection',section:value.section,parent:value.parent,control:value.control,page:value.page,index:value.index,virtualParagraph:value.virtualParagraph,focus,...(anchor?{anchor}:{}),locatorFingerprint:value.locatorFingerprint,ownerFingerprint:value.ownerFingerprint,storyFingerprint:value.storyFingerprint};
}
