import {MAX_SOURCE_LOCATIONS,type HwpReferenceAddress,type HwpReferenceCell,type SourceLocation} from '../../modules/references/public/index.ts';
import {findHitPath,readFindHits,type FindHit} from '../../editor-actions/basic-find.ts';

type ReferenceDocument = {
  getTextFileUnicode(): string;
  getSectionCount(): number;
  getParagraphCount(section: number): number;
  getParagraphLength(section: number, paragraph: number): number;
  getTextRange(section: number, paragraph: number, offset: number, length: number): string;
  getControls(): string;
  getControlTextPositions(section: number, paragraph: number): string;
  getTableDimensions(section: number, paragraph: number, control: number): string;
  getCellInfo(section: number, paragraph: number, control: number, cell: number): string;
  getCellParagraphCount(section: number, paragraph: number, control: number, cell: number): number;
  getCellParagraphLength(section: number, paragraph: number, control: number, cell: number, cellParagraph: number): number;
  getTextInCell(section: number, paragraph: number, control: number, cell: number, cellParagraph: number, offset: number, length: number): string;
  getCellInfoByPath?(section: number, paragraph: number, path: string): string;
  getCellParagraphLengthByPath?(section: number, paragraph: number, path: string): number;
  getTableDimensionsByPath?(section: number, paragraph: number, path: string): string;
  getTextInCellByPath?(section: number, paragraph: number, path: string, offset: number, length: number): string;
  searchAllText?(text: string, caseSensitive: boolean, includeCells: boolean): string;
};

type Control = {ctrlId:string; list:number; para:number; controlIndex:number};
type ReadReference = { text: string; locations?: SourceLocation[]; limitation: string };

const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function readHwpReferenceText(document: Pick<ReferenceDocument,'getTextFileUnicode'>): string {
  const value = JSON.parse(document.getTextFileUnicode());
  return typeof value === 'string' ? value : typeof value?.text === 'string' ? value.text : JSON.stringify(value);
}

export function readHwpReference(document: ReferenceDocument): ReadReference {
  const text = readHwpReferenceText(document);
  const result = {text,limitation:'한글 문서의 Unicode 추출문. 그림 속 글자는 제외했습니다.'};
  try {
    const locations = readVerifiedLocations(document,text);
    if (locations?.length) return {
      ...result,locations,
      limitation: result.limitation + (locations.length === MAX_SOURCE_LOCATIONS ? ' 앞쪽 근거 위치를 최대 160개 표시합니다.' : ' 주소가 표시되지 않은 부분은 추출문 줄 번호로 확인할 수 있습니다.'),
    };
  } catch { /* Legacy or unsupported native structures still have the existing text extraction. */ }
  return {...result,limitation:result.limitation + ' 이 자료는 추출문 줄 번호로 근거를 확인할 수 있습니다.'};
}

function readVerifiedLocations(document: ReferenceDocument,text: string): SourceLocation[] | undefined {
  if (!text.length || text.length > 120_000) return undefined;
  const fields = new Map<number,Control[]>();
  const controls=JSON.parse(document.getControls()) as Control[];
  if (controls.some(control=>control.ctrlId==='tbl'&&control.list!==0)) {
    if (controls.some(control=>!['secd','cold','tbl'].includes(control.ctrlId))) return undefined;
    return readVerifiedNestedLocations(document,text);
  }
  for (const control of controls) {
    if (['secd','cold'].includes(control.ctrlId)) continue;
    if (control.list !== 0 || control.ctrlId !== 'tbl') return undefined;
    const matching = fields.get(control.para) ?? [];
    matching.push(control);
    fields.set(control.para,matching);
  }
  const locations: SourceLocation[] = [];
  let position = 0;
  let remaining = 4000;
  function line(value: string, address: HwpReferenceAddress): boolean {
    const serialized = value + '\r\n';
    const expected = Math.min(serialized.length,text.length-position);
    if (--remaining < 0 || expected<value.length || !text.startsWith(serialized.slice(0,expected),position)) return false;
    if (value.trim() && locations.length < MAX_SOURCE_LOCATIONS) {
      locations.push({start:position,end:position+value.length,address});
    }
    position += serialized.length;
    return position <= text.length + 2;
  }
  let flatParagraph = 0;
  for (let section = 0; section < document.getSectionCount(); section++) {
    for (let paragraph = 0; paragraph < document.getParagraphCount(section); paragraph++, flatParagraph++) {
      const address = {kind:'hwp',section,paragraph} as const;
      const characters = Array.from(document.getTextRange(section,paragraph,0,document.getParagraphLength(section,paragraph)));
      const tables = fields.get(flatParagraph);
      const offsets = tables ? JSON.parse(document.getControlTextPositions(section,paragraph)) as number[] : [];
      let offset = 0;
      for (const table of tables ?? []) {
        const end = offsets[table.controlIndex];
        if (!integer(end) || end<offset || end>characters.length || !line(characters.slice(offset,end).join(''),{...address,offset})) return undefined;
        offset = end;
        const {cellCount} = JSON.parse(document.getTableDimensions(section,paragraph,table.controlIndex));
        if (!integer(cellCount) || !cellCount || cellCount>1000) return undefined;
        for (let cell = 0; cell < cellCount; cell++) {
          const {row,col} = JSON.parse(document.getCellInfo(section,paragraph,table.controlIndex,cell));
          if (!integer(row) || !integer(col)) return undefined;
          const count = document.getCellParagraphCount(section,paragraph,table.controlIndex,cell);
          for (let cellParagraph = 0; cellParagraph < count; cellParagraph++) {
            const length = document.getCellParagraphLength(section,paragraph,table.controlIndex,cell,cellParagraph);
            const value = document.getTextInCell(section,paragraph,table.controlIndex,cell,cellParagraph,0,length);
            if (!line(value,{...address,offset:0,cell:{controlIndex:table.controlIndex,cellIndex:cell,cellParagraph,row,column:col}})) return undefined;
          }
        }
      }
      if (!line(characters.slice(offset).join(''),{...address,offset})) return undefined;
    }
  }
  return position === text.length + 2 ? locations : undefined;
}

function readVerifiedNestedLocations(document:ReferenceDocument,text:string):SourceLocation[]|undefined {
  if (text.length>48_000||!document.searchAllText||!document.getCellInfoByPath||!document.getTableDimensionsByPath||!document.getTextInCellByPath) return undefined;
  const lines=text.split('\r\n');
  if (lines.length>120) return undefined;
  const occurrences=new Map<string,number>();
  const repeatedHits=new Map<string,FindHit[]>();
  for (const line of lines) occurrences.set(line,(occurrences.get(line)??0)+1);
  const locations:SourceLocation[]=[];
  let end=0;
  for (const value of lines) {
    const start=end;
    end=start+value.length+2;
    if (!value.trim()||value.length>2_000) continue;
    const count=occurrences.get(value)!;
    let hit:FindHit|undefined;
    if(count===1){
      const hits=readFindHits(document,value,true);
      if(hits.length===1)hit=hits[0];
    }else{
      if(!repeatedHits.has(value)) repeatedHits.set(value,readRepeatedCellLines(document,value,count));
      hit=repeatedHits.get(value)?.shift();
    }
    if(!hit)continue;
    const path=findHitPath(hit);
    if (!path) continue;
    const cells:HwpReferenceCell[]=[];
    for (const [index,step] of path.entries()) {
      const {row,col}=JSON.parse(document.getCellInfoByPath(hit.sec,hit.para,JSON.stringify(path.slice(0,index+1))));
      if (!integer(row)||!integer(col)) return undefined;
      cells.push({controlIndex:step.controlIndex,cellIndex:step.cellIndex,cellParagraph:step.cellParaIndex,row,column:col});
    }
    const cell=cells.pop();
    locations.push({start,end:start+value.length,address:{kind:'hwp',section:hit.sec,paragraph:hit.para,offset:hit.charOffset,
      ...(cell?{cell}:{}),...(cells.length?{ancestors:cells}:{})}});
  }
  return locations;
}

function readRepeatedCellLines(document:ReferenceDocument,value:string,count:number):FindHit[]{
  if(!document.getCellParagraphLengthByPath)return [];
  const hits=readFindHits(document,value,true);
  if(hits.length!==count)return [];
  const sameTable=new Set<string>();
  const usedParagraphs=new Set<string>();
  const cells:Array<{hit:FindHit;cellIndex:number;cellParaIndex:number}>=[];
  for(const hit of hits){
    const path=findHitPath(hit);
    const cell=path?.at(-1);
    if(!path||path.length<2||!cell||hit.charOffset!==0)return [];
    try{
      if(document.getCellParagraphLengthByPath(hit.sec,hit.para,JSON.stringify(path))!==hit.length)return [];
    }catch{return [];}
    sameTable.add(JSON.stringify([hit.sec,hit.para,path.slice(0,-1),cell.controlIndex]));
    const paragraph=`${cell.cellIndex}/${cell.cellParaIndex}`;
    if(sameTable.size>1||usedParagraphs.has(paragraph))return [];
    usedParagraphs.add(paragraph);
    cells.push({hit,cellIndex:cell.cellIndex,cellParaIndex:cell.cellParaIndex});
  }
  // Unicode extraction visits the native cell array and each cell's paragraphs in order.
  return cells.sort((a,b)=>a.cellIndex-b.cellIndex||a.cellParaIndex-b.cellParaIndex).map(cell=>cell.hit);
}
