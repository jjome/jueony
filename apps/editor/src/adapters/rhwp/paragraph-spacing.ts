type Target = {kind:'body';sec:number;para:number}|{kind:'cell';sec:number;parentPara:number;controlIdx:number;cellIdx:number;cellParaIdx:number};
type Native = {getSectionCount():number;getParagraphCount(section:number):number;getCursorModel():string;getParaShapeSet(list:number,paragraph:number):string};
/** The display API rounds px to one decimal. Never feed those values back into a relative edit. */
export function createParagraphSpacingReader(wasm:{borrowDocumentHandle():Native|null}) {
 const doc=wasm.borrowDocumentHandle();if(!doc)throw new Error('문서가 열려 있지 않습니다.');
 const model=JSON.parse(doc.getCursorModel()),offsets:number[]=[];
 let offset=0;for(let section=0;section<doc.getSectionCount();section++){offsets.push(offset);offset+=doc.getParagraphCount(section);}
 return (target:Target):{marginLeft:number;marginRight:number;indent:number}=>{
  if(!Number.isSafeInteger(target.sec)||target.sec<0||target.sec>=offsets.length)throw new Error('문단 구역을 확인하지 못했습니다.');
  let list=0,paragraph:number;
  if(target.kind==='body'){
   if(!Number.isSafeInteger(target.para)||target.para<0||target.para>=doc.getParagraphCount(target.sec))throw new Error('문단 위치를 확인하지 못했습니다.');
   paragraph=offsets[target.sec]+target.para;
  }
  else{
   const matches=model.lists.filter((entry:any)=>entry.isCell&&entry.hostListId===0&&entry.sectionIndex===target.sec&&entry.hostPara===target.parentPara&&entry.controlIndex===target.controlIdx&&entry.cellIndex===target.cellIdx);
   if(matches.length!==1)throw new Error('표 셀의 문단 위치를 확인하지 못했습니다.');
   list=matches[0].listId;paragraph=target.cellParaIdx;
  }
  const raw=JSON.parse(doc.getParaShapeSet(list,paragraph));
  if(![raw.LeftMargin,raw.RightMargin,raw.Indentation].every(Number.isSafeInteger))throw new Error('문단 여백의 원래 값을 확인하지 못했습니다.');
  return {marginLeft:raw.LeftMargin,marginRight:raw.RightMargin,indent:raw.Indentation};
 };
}
