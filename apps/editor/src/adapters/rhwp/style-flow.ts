/** Selection styles use existing native shape IDs; paragraph style and text stay intact. */
type Position = {sectionIndex:number;paragraphIndex:number;charOffset:number;parentParaIndex?:number;controlIndex?:number;cellIndex?:number;cellParaIndex?:number;cellPath?:{controlIndex:number;cellIndex:number;cellParaIndex:number}[];isTextBox?:boolean};
type Span = {section:number;paragraph:number;start:number;end:number;parent?:number;path?:Position['cellPath']};
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0;
export function characterStyleSpans(wasm:any,start:Position,end:Position):Span[] {
  if([start,end].some(p=>p.isTextBox||![p.sectionIndex,p.paragraphIndex,p.charOffset].every(integer)))throw new Error('글자 스타일을 적용할 선택 범위를 다시 지정하세요.');
  const cell=start.parentParaIndex!==undefined||end.parentParaIndex!==undefined;
  const spans:Span[]=[];let count=0;
  if(cell){
    const path=(p:Position)=>p.cellPath?.length?p.cellPath:[{controlIndex:p.controlIndex!,cellIndex:p.cellIndex!,cellParaIndex:p.cellParaIndex!}];
    const a=path(start),b=path(end);
    if(start.sectionIndex!==end.sectionIndex||!integer(start.parentParaIndex)||start.parentParaIndex!==end.parentParaIndex||a.length!==b.length||a.length>8
      ||a.some((p,i)=>![p.controlIndex,p.cellIndex,p.cellParaIndex].every(integer)||p.controlIndex!==b[i].controlIndex||p.cellIndex!==b[i].cellIndex||(i<a.length-1&&p.cellParaIndex!==b[i].cellParaIndex)))throw new Error('같은 표 셀 안의 글자를 선택하세요.');
    const first=a.at(-1)!.cellParaIndex,last=b.at(-1)!.cellParaIndex;
    if(first>last||first===last&&start.charOffset>end.charOffset)throw new Error('선택 범위의 순서가 올바르지 않습니다.');
    for(let paragraph=first;paragraph<=last;paragraph++){
      const current=a.map(p=>({...p}));current.at(-1)!.cellParaIndex=paragraph;
      const length=wasm.getCellParagraphLengthByPath(start.sectionIndex,start.parentParaIndex,JSON.stringify(current));
      add({section:start.sectionIndex,paragraph,parent:start.parentParaIndex,path:current,start:paragraph===first?start.charOffset:0,end:paragraph===last?end.charOffset:length},length);
    }
  }else{
    if(start.sectionIndex>end.sectionIndex||start.sectionIndex===end.sectionIndex&&start.paragraphIndex>end.paragraphIndex||start.sectionIndex===end.sectionIndex&&start.paragraphIndex===end.paragraphIndex&&start.charOffset>end.charOffset)throw new Error('선택 범위의 순서가 올바르지 않습니다.');
    if(end.sectionIndex>=wasm.getSectionCount())throw new Error('구역 위치가 바뀌었습니다.');
    for(let section=start.sectionIndex;section<=end.sectionIndex;section++){
      const total=wasm.getParagraphCount(section),first=section===start.sectionIndex?start.paragraphIndex:0,last=section===end.sectionIndex?end.paragraphIndex:total-1;
      if(last>=total)throw new Error('문단 위치가 바뀌었습니다.');
      for(let paragraph=first;paragraph<=last;paragraph++){
        const length=wasm.getParagraphLength(section,paragraph);
        add({section,paragraph,start:section===start.sectionIndex&&paragraph===first?start.charOffset:0,end:section===end.sectionIndex&&paragraph===last?end.charOffset:length},length);
      }
    }
  }
  return spans;
  function add(span:Span,length:number){
    if(!integer(length)||span.start>span.end||span.end>length||++count>1000)throw new Error('선택 범위가 변경되었거나 너무 큽니다.');
    if(span.end>span.start)spans.push(span);
  }
}
export function applySelectedCharacterStyle(input:any,wasm:any,styleId:number):boolean {
  const style=wasm.getStyleList().find((s:any)=>s.id===styleId);
  if(!style||style.type!==1||!integer(style.charShapeId))throw new Error('적용할 글자 스타일을 다시 선택하세요.');
  if(input.cursor.isInHeaderFooter()||input.cursor.isInFootnote()||input.cursor.isInTextBox()||input.cursor.isInCellSelectionMode()||input.cursor.isInTableObjectSelection()||input.cursor.isInPictureObjectSelection())throw new Error('본문 또는 같은 표 셀의 글자를 선택하세요.');
  const range=input.getSelection();if(!range)return false;
  const spans=characterStyleSpans(wasm,range.start,range.end);if(!spans.length)return true;
  const position=input.getPosition();
  input.executeOperation({kind:'snapshot',operationType:'applySelectedCharacterStyle',operation:(native:any)=>{
    for(const span of spans){
      const runs=[{startOffset:span.start,endOffset:span.end,charShapeId:style.charShapeId}];
      const response=span.path?native.setCharShapeRunsInCellByPath(span.section,span.parent,JSON.stringify(span.path),span.start,span.end,runs):native.setCharShapeRuns(span.section,span.paragraph,span.start,span.end,runs);
      const result=typeof response==='string'?JSON.parse(response):response;
      if(result?.ok===false)throw new Error('선택한 글자 스타일을 적용하지 못했습니다.');
    }
    return position;
  }});
  return true;
}

/** Enter at the end of ordinary body text follows a valid paragraph next-style edge. */
export function nextParagraphStyle(wasm:any,section:number,paragraph:number,offset:number):number|undefined {
  if(offset!==wasm.getParagraphLength(section,paragraph))return;
  const current=wasm.getStyleAt(section,paragraph),style=wasm.getStyleList().find((s:any)=>s.id===current.id);
  if(!style||style.type!==0||style.nextStyleId===style.id)return;
  const next=wasm.getStyleList().find((s:any)=>s.id===style.nextStyleId&&s.type===0);
  return next?.id;
}
