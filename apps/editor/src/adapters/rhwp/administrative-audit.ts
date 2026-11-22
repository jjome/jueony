import type { AuditAddress, AuditOptions, AuditProfile, TableCellPathStep } from '../../modules/document/public/index.ts';

type CellList = {
  isCell: boolean; listId: number; hostListId: number; sectionIndex: number;
  hostPara: number; controlIndex: number; cellIndex: number; paraCount: number;
};
type Control = { ctrlId: string; list: number; para: number; controlIndex: number };
type ShapeRun = { startOffset: number; endOffset: number; charShapeId: number };

const decode = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T;
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function readAdministrativeAuditProfile(doc: any, options: AuditOptions): AuditProfile {
  const fonts: AuditProfile['fonts'][number][] = [];
  const nestedTables: AuditAddress[] = [];
  const tables: NonNullable<AuditProfile['tables']>[number][] = [];
  const limitations = new Set<string>();
  if (!options.fonts && !options.nestedTables && !options.mergedTables && !options.singleCellTables) return { fonts, nestedTables, limitations: [] };

  const lists = decode<CellList[]>(decode<{ lists: unknown }>(doc.getCursorModel()).lists);
  const controls = decode<Control[]>(doc.getControls());
  if (!Array.isArray(lists) || !Array.isArray(controls)) throw new Error('문서 구조를 읽지 못했습니다.');
  if (lists.length > 5000 || controls.length > 10000) {
    return { fonts, nestedTables, limitations: ['문서 구조가 검사 한도를 넘었습니다.'] };
  }
  const byId = new Map(lists.map(list => [list.listId, list]));
  if (byId.size !== lists.length) throw new Error('문서 영역의 주소가 중복되어 검사할 수 없습니다.');
  const sectionCount = doc.getSectionCount();
  if (!integer(sectionCount) || sectionCount > 1000) throw new Error('구역 수를 확인할 수 없습니다.');
  const paragraphs = Array.from({ length: sectionCount }, (_, section) => doc.getParagraphCount(section) as number);
  if (paragraphs.some(count => !integer(count))) throw new Error('문단 수를 확인할 수 없습니다.');

  if(options.mergedTables||options.singleCellTables){
    const groups=new Map<string,CellList[]>();
    for(const cell of lists){
      if(!cell.isCell)continue;
      const key=[cell.sectionIndex,cell.hostListId,cell.hostPara,cell.controlIndex].join('/');
      const group=groups.get(key)??[];
      group.push(cell);groups.set(key,group);
    }
    for(const cells of groups.values())try{
      const address=addressOf(cells[0],0);
      const dimension=decode<{rowCount:number;colCount:number;cellCount:number}>(
        doc.getTableDimensionsByPath(address.section,address.paragraph,JSON.stringify(address.path)));
      const rows=dimension.rowCount,columns=dimension.colCount;
      if(!integer(rows)||!rows||!integer(columns)||!columns||cells.length!==dimension.cellCount)throw new Error();
      const edges=options.mergedTables?cells.map(cell=>{
        const location=addressOf(cell,0);
        const size=decode<{row:number;rowSpan:number;colSpan:number}>(
          doc.getCellInfoByPath(location.section,location.paragraph,JSON.stringify(location.path)));
        if(!integer(size.row)||!integer(size.rowSpan)||!size.rowSpan||size.row+size.rowSpan>rows||
           !integer(size.colSpan)||!size.colSpan||size.colSpan>columns)throw new Error();
        return {row:size.row,rowSpan:size.rowSpan,columnSpan:size.colSpan};
      }):[];
      let hasText=false;
      if(options.singleCellTables&&rows===1&&columns===1)for(let paragraph=0;paragraph<cells[0].paraCount;paragraph++){
        const location=addressOf(cells[0],paragraph),path=JSON.stringify(location.path);
        const length=doc.getCellParagraphLengthByPath(location.section,location.paragraph,path);
        const text=doc.getTextInCellByPath(location.section,location.paragraph,path,0,length);
        if(typeof text==='string'&&text.trim()){hasText=true;break;}
      }
      tables.push({address,rows,columns,cells:edges,hasText});
    }catch{limitations.add('일부 표의 셀 구조를 확인하지 못했습니다.');}
  }
  function addressOf(list: CellList, paragraph: number): AuditAddress {
    const path: TableCellPathStep[] = [];
    let current = list;
    while (true) {
      if (!current.isCell || !integer(paragraph) || paragraph >= current.paraCount || path.length === 8
          || !integer(current.controlIndex) || !integer(current.cellIndex)) throw new Error('표의 주소를 확인할 수 없습니다.');
      path.unshift({ controlIndex: current.controlIndex, cellIndex: current.cellIndex, cellParaIndex: paragraph });
      if (current.hostListId === 0) {
        if (!integer(current.sectionIndex) || !integer(current.hostPara)
            || current.hostPara >= (paragraphs[current.sectionIndex] ?? 0)) throw new Error('표의 본문 위치를 확인할 수 없습니다.');
        return { section: current.sectionIndex, paragraph: current.hostPara, path, offset: 0 };
      }
      const parent = byId.get(current.hostListId);
      if (!parent) throw new Error('부모 셀을 찾을 수 없습니다.');
      paragraph = current.hostPara;
      current = parent;
    }
  }

  if (options.nestedTables) {
    for (const control of controls) {
      if (control.ctrlId !== 'tbl' || control.list === 0) continue;
      const list = byId.get(control.list);
      try {
        if (!list?.isCell) throw new Error('셀 밖의 특수 영역');
        nestedTables.push(addressOf(list, control.para));
      } catch {
        limitations.add('일부 특수 영역에 있는 표의 위치를 확인하지 못했습니다.');
      }
    }
  }

  if (options.fonts) {
    limitations.add('글꼴은 본문과 표 셀의 사용 구간을 검사합니다. 한글 전용 글꼴 목록은 호환성 참고용입니다.');
    if (lists.some(list => !list.isCell) || controls.some(control => !['secd', 'cold', 'tbl'].includes(control.ctrlId))) {
      limitations.add('머리말, 주석, 개체, 캡션 등 특수 영역의 글꼴은 검사 범위에서 제외됩니다.');
    }
    const shapes = new Set<number>();
    let budget = 15000;
    let visited = 0;
    const total = paragraphs.reduce((sum, count) => sum + count, 0)
      + lists.filter(list => list.isCell).reduce((sum, list) => sum + list.paraCount, 0);

    const collect = (address: AuditAddress) => {
      visited++;
      budget--;
      try {
        const { section, paragraph, path } = address;
        const args = [section, paragraph] as const;
        const encoded = path && JSON.stringify(path);
        const length = encoded ? doc.getCellParagraphLengthByPath(...args, encoded) : doc.getParagraphLength(...args);
        if (!integer(length)) throw new Error('문단 길이를 확인할 수 없습니다.');
        if (length === 0) return;
        const runs = decode<ShapeRun[]>(encoded
          ? doc.getCharShapeRunsInCellByPath(...args, encoded, 0, length)
          : doc.getCharShapeRuns(...args, 0, length));
        if (!Array.isArray(runs) || runs.length > budget) {
          budget = 0;
          limitations.add('글자 모양 검사 한도에 도달했습니다.');
          return;
        }
        budget -= runs.length;
        for (const run of runs) {
          if (!integer(run.startOffset) || !integer(run.endOffset) || run.startOffset >= run.endOffset
              || run.endOffset > length || !integer(run.charShapeId)) throw new Error('글자 모양 범위를 확인할 수 없습니다.');
          if (shapes.has(run.charShapeId)) continue;
          const props = decode<{ fontFamilies: string[]; charShapeId: number }>(encoded
            ? doc.getCellCharPropertiesAtByPath(...args, encoded, run.startOffset)
            : doc.getCharPropertiesAt(...args, run.startOffset));
          if (props.charShapeId !== run.charShapeId || !Array.isArray(props.fontFamilies)
              || props.fontFamilies.length !== 7 || props.fontFamilies.some(name => typeof name !== 'string')) {
            throw new Error('사용 글꼴을 확인할 수 없습니다.');
          }
          shapes.add(run.charShapeId);
          fonts.push({ names: props.fontFamilies, address: { ...address, offset: run.startOffset } });
        }
      } catch {
        limitations.add('일부 문단의 사용 글꼴을 읽지 못했습니다.');
      }
    };

    for (let section = 0; section < paragraphs.length && budget > 0; section++) {
      for (let paragraph = 0; paragraph < paragraphs[section] && budget > 0; paragraph++) collect({ section, paragraph, offset: 0 });
    }
    for (const list of lists) {
      if (!list.isCell || budget <= 0) continue;
      for (let paragraph = 0; paragraph < list.paraCount && budget > 0; paragraph++) {
        try { collect(addressOf(list, paragraph)); }
        catch {
          limitations.add('일부 셀의 글꼴을 읽지 못했습니다.');
          break;
        }
      }
    }
    if (visited < total && budget <= 0) limitations.add('글자 모양 검사 한도에 도달했습니다.');
  }
  return { fonts, nestedTables, tables, limitations: [...limitations] };
}
