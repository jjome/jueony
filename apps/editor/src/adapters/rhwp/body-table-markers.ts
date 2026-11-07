type MarkerControl = {ctrlId:string;ctrlCh?:number;list:number;para:number;controlIndex:number};
const json=(v:any)=>typeof v==='string'?JSON.parse(v):v;
const index=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const invalid=()=>Error('본문 책갈피 또는 누름틀의 원래 위치와 값을 확인하지 못했습니다.');

/** Account for every body marker by its flattened control address and its
 * section-local document record. Table editing cannot change either anchor. */
export function readBodyTableMarkers(doc:any,controls:MarkerControl[],offsets:number[],fields:any[],bookmarks:any[]):unknown[]{
  if(!Array.isArray(fields)||!Array.isArray(bookmarks)||fields.length+bookmarks.length>200)throw invalid();
  const fieldSlots=new Map<number,Set<number>>(),bookmarkSlots=new Set<string>();
  for(const c of controls){
    if(c.ctrlId==='tbl'||(c.list===0&&['secd','cold'].includes(c.ctrlId)))continue;
    if(c.list!==0)throw invalid();
    if(c.ctrlId==='bokm'){
      const slot=c.para+'/'+c.controlIndex;
      if(!index(c.controlIndex)||bookmarkSlots.has(slot))throw invalid();
      bookmarkSlots.add(slot);
    }else if(c.ctrlId===''&&c.ctrlCh===0&&index(c.para)&&index(c.controlIndex)){
      const slots=fieldSlots.get(c.para)??new Set<number>();
      if(slots.has(c.controlIndex))throw invalid();
      slots.add(c.controlIndex);fieldSlots.set(c.para,slots);
    }else throw invalid();
  }
  const inBody=(s:number,p:number)=>index(s)&&s<offsets.length-1&&index(p)&&p<offsets[s+1]-offsets[s];
  for(const b of bookmarks){
    if(!b||typeof b.name!=='string'||!b.name||!inBody(b.sec,b.para)||!index(b.ctrlIdx)||!index(b.charPos)||
       b.charPos>doc.getParagraphLength(b.sec,b.para)||!bookmarkSlots.delete((offsets[b.sec]+b.para)+'/'+b.ctrlIdx))throw invalid();
  }
  const evidence:unknown[]=[...bookmarks],ids=new Set<number>();
  const positions=new Map<number,number[]>(),ranges=new Map<number,Array<[number,number]>>();
  for(const f of fields){
    const loc=f.location;
    if(f.fieldType!=='clickhere'||f.cellField!==false||f.listId!==0||!loc||loc.path?.length||
       !inBody(loc.sectionIndex,loc.paraIndex)||!index(f.fieldId)||ids.has(f.fieldId)||
       !index(f.startCharIdx)||!index(f.endCharIdx)||f.startCharIdx>f.endCharIdx||
       f.endCharIdx>doc.getParagraphLength(loc.sectionIndex,loc.paraIndex))throw invalid();
    const paragraph=offsets[loc.sectionIndex]+loc.paraIndex,slots=fieldSlots.get(paragraph);
    if(!slots?.size)throw invalid();
    // With multiple anonymous controls in a paragraph, bind each field to
    // exactly one stored control index on the native character axis.
    let anchors=positions.get(paragraph);
    if(!anchors&&slots.size>1){
      anchors=json(doc.getControlTextPositions(loc.sectionIndex,loc.paraIndex));
      if(!Array.isArray(anchors))throw invalid();
      positions.set(paragraph,anchors);
    }
    const candidates=anchors?[...slots].filter(i=>anchors[i]===f.startCharIdx):[...slots];
    if(candidates.length!==1)throw invalid();
    slots.delete(candidates[0]);
    const used=ranges.get(paragraph)??[];
    if(used.some(([start,end])=>start<=f.endCharIdx&&f.startCharIdx<=end))throw invalid();
    used.push([f.startCharIdx,f.endCharIdx]);ranges.set(paragraph,used);
    const info=json(doc.getFieldInfoAt(loc.sectionIndex,loc.paraIndex,f.startCharIdx));
    if(!info.inField||info.fieldId!==f.fieldId||info.fieldType!==f.fieldType||
       info.startCharIdx!==f.startCharIdx||info.endCharIdx!==f.endCharIdx||
       info.editableInForm!==f.editableInForm||info.guideName!==f.guide||typeof info.isGuide!=='boolean'||
       doc.getTextRange(loc.sectionIndex,loc.paraIndex,f.startCharIdx,f.endCharIdx-f.startCharIdx)!==f.value)throw invalid();
    ids.add(f.fieldId);
    evidence.push({field:f,info});
  }
  if(bookmarkSlots.size||[...fieldSlots.values()].some(slots=>slots.size))throw invalid();
  return evidence;
}
