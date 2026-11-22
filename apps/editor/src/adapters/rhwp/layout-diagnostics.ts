import type { AuditAddress, LayoutDiagnostics, TableCellPathStep } from '../../modules/document/public/index.ts';

type Rect = { x: number; y: number; w: number; h: number };
type Cell = Rect & { row: number; col: number };
type Frame = Rect & { type: string; secIdx: number; paraIdx: number; controlIdx: number; cells?: Cell[]; stableIndex?: number[]; headerFooter?: unknown };
type NestedCell = Cell & { pageIndex: number };
type Run = Rect & { text: string; secIdx: number; paraIdx: number; charStart: number; parentParaIdx?: number; cellPath?: AuditAddress['path'] };
const finite = (value: number) => Number.isFinite(value);
const validRect = (rect: Rect) => [rect.x, rect.y, rect.w, rect.h].every(finite) && rect.w >= 0 && rect.h > 0;
const validIndex = (value: number) => Number.isSafeInteger(value) && value >= 0;
const parse = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T;
const MAX_PAGES = 100;
const MAX_RUNS = 60_000;
const MAX_NESTED_TABLES = 24;
const TOLERANCE = 0.5;
const crossesBoundary = (run: Rect, bounds: Rect) =>
  run.x < bounds.x - TOLERANCE || run.y < bounds.y - TOLERANCE ||
  run.x + run.w > bounds.x + bounds.w + TOLERANCE ||
  run.y + run.h > bounds.y + bounds.h + TOLERANCE;

/** Diagnostics concern rendered text, and never read from or change the saved file. */
export function inspectDocumentLayout(doc: any): LayoutDiagnostics {
  const findings: LayoutDiagnostics['findings'] = [];
  const limitations = new Set<string>();
  const observed = new Set<string>();
  const locations = new Map<string, { first: number; last: number; address: AuditAddress }>();
  const cellLocations = new Map<string, { row: number; col: number } | null>();
  const nestedBounds = new Map<string, NestedCell[]>();
  let checkedPages = 0;
  let count = 0;
  let runCount = 0;
  const pages = typeof doc.pageCount === 'function' ? doc.pageCount() : 0;
  if (!validIndex(pages) || pages === 0) return { findings, count, status: 'unavailable', checkedPages, limitations: ['현재 쪽의 배치를 읽을 수 없습니다.'] };

  function add(rule: LayoutDiagnostics['findings'][number]['rule'], label: string, page: number, address: AuditAddress) {
    const path = address.path;
    const owner = path?.map((step,index)=>[step.controlIndex,step.cellIndex,...(index<path.length-1?[step.cellParaIndex]:[])]);
    const key = JSON.stringify([rule, page, address.section, address.paragraph, owner]);
    if (observed.has(key)) return;
    observed.add(key);
    count++;
    if (findings.length < 80) findings.push({ rule, label: `${page + 1}쪽 · ${label}`, address, page });
  }

  function nestedFrames(section:number, paragraph:number, path:readonly TableCellPathStep[]): NestedCell[] | undefined {
    const address = [...path.slice(0,-1),{...path.at(-1)!,cellIndex:0,cellParaIndex:0}];
    const key = JSON.stringify([section,paragraph,address]);
    if (nestedBounds.has(key)) return nestedBounds.get(key);
    if (pages > MAX_PAGES || nestedBounds.size >= MAX_NESTED_TABLES) {
      limitations.add('중첩 표의 배치 조회 한도에 도달했습니다.');
      return undefined;
    }
    let cells: NestedCell[] = [];
    try {
      const parsed = parse<NestedCell[]>(doc.getTableCellBboxesByPath(section,paragraph,JSON.stringify(address)));
      if (Array.isArray(parsed)) cells=parsed.filter(cell=>validRect(cell)&&validIndex(cell.pageIndex)&&validIndex(cell.row)&&validIndex(cell.col));
    } catch { /* An unresolved inner path is displayed as a partial report. */ }
    nestedBounds.set(key,cells);
    return cells;
  }

  for (let page = 0; page < Math.min(MAX_PAGES, pages); page++) {
    try {
      const info = parse<{ width: number; height: number }>(doc.getPageInfo(page));
      const { controls } = parse<{ controls: Frame[] }>(doc.getPageControlLayout(page));
      const { runs } = parse<{ runs: Run[] }>(doc.getPageTextLayout(page));
      const paper = { x: 0, y: 0, w: info.width, h: info.height };
      if (!validRect(paper) || paper.w <= 0 || !Array.isArray(controls) || !Array.isArray(runs)) throw new Error();
      if (runCount + runs.length > MAX_RUNS) { limitations.add('글줄 검사 한도에 도달했습니다.'); break; }
      runCount += runs.length;
      checkedPages++;
      const cellFrames = new Map<string, Cell[]>();
      for (const frame of controls) {
        if (frame.type !== 'table' || frame.headerFooter || (frame.stableIndex && frame.stableIndex.length !== 3)) continue;
        for (const cell of frame.cells ?? []) {
          if (!validRect(cell) || !validIndex(cell.row) || !validIndex(cell.col)) continue;
          const key = [frame.secIdx, frame.paraIdx, frame.controlIdx, cell.row, cell.col].join('/');
          const fragments = cellFrames.get(key) ?? [];
          fragments.push(cell);
          cellFrames.set(key, fragments);
        }
      }
      for (const run of runs) {
        if (!run.text?.trim() || !validIndex(run.secIdx) || !validIndex(run.paraIdx) || !validIndex(run.charStart)) continue;
        if (!validRect(run)) { limitations.add('일부 글줄의 크기를 확인할 수 없습니다.'); continue; }
        if (run.cellPath?.length) {
          const path = run.cellPath;
          const cell = path.at(-1)!;
          if (!validIndex(run.parentParaIdx!) || cell.cellIndex === 65534) continue;
          const identity = [run.secIdx, run.parentParaIdx!, cell.controlIndex];
          const paths = [...path.slice(0,-1),{...cell,cellParaIndex:0}];
          const cellKey = JSON.stringify([run.secIdx,run.parentParaIdx,paths]);
          const address = { section:run.secIdx, paragraph:run.parentParaIdx!, path, offset:run.charStart };
          if (crossesBoundary(run, paper)) add('page-overflow','표의 글줄이 종이 경계를 벗어납니다.',page,address);
          // The render frame numbers cells inside each page fragment; text runs use document cell indices.
          if (!cellLocations.has(cellKey)) {
            let location = null;
            try {
              const source = parse<{ row: number; col: number }>(path.length === 1
                ? doc.getCellInfo(...identity,cell.cellIndex) : doc.getCellInfoByPath(run.secIdx,run.parentParaIdx,JSON.stringify(path)));
              if (validIndex(source.row) && validIndex(source.col)) location = source;
            } catch { /* An unreadable cell cannot be matched to a page fragment. */ }
            cellLocations.set(cellKey, location);
          }
          const location = cellLocations.get(cellKey);
          const bounds = !location ? undefined : path.length === 1 ? cellFrames.get([...identity,location.row,location.col].join('/'))
            : nestedFrames(run.secIdx,run.parentParaIdx!,path)?.filter(cell=>cell.pageIndex===page&&cell.row===location.row&&cell.col===location.col);
          const nearby = bounds?.length === 1 ? bounds : bounds?.filter(bound =>
            run.x >= bound.x - TOLERANCE && run.x <= bound.x + bound.w + TOLERANCE &&
            run.y >= bound.y - TOLERANCE && run.y <= bound.y + bound.h + TOLERANCE);
          if (!nearby?.length) { limitations.add('일부 셀 글줄을 표 조각에 연결할 수 없습니다.'); continue; }
          if (nearby.every(bound => crossesBoundary(run, bound))) {
            const first = nearby[0];
            add('cell-overflow', `표 ${first.row + 1}행 ${first.col + 1}열 글줄이 셀 경계를 벗어납니다.`, page, address);
          }
        } else {
          if (run.parentParaIdx !== undefined || !validIndex(run.secIdx) || run.paraIdx >= doc.getParagraphCount(run.secIdx)) continue;
          const address = { section: run.secIdx, paragraph: run.paraIdx, offset: run.charStart };
          if (crossesBoundary(run, paper)) add('page-overflow', '본문 글줄이 종이 경계를 벗어납니다.', page, address);
          const key = `${run.secIdx}/${run.paraIdx}`;
          const location = locations.get(key);
          if (location) location.last = page;
          else locations.set(key, { first: page, last: page, address });
        }
      }
    } catch { limitations.add(`${page + 1}쪽의 배치 정보 일부를 읽지 못했습니다.`); }
  }
  if (checkedPages < pages) limitations.add(`전체 ${pages}쪽 중 ${checkedPages}쪽의 배치를 읽었습니다.`);
  for (const location of locations.values()) {
    const { section, paragraph } = location.address;
    const next = locations.get(`${section}/${paragraph + 1}`);
    if (!next || next.first <= location.last) continue;
    try {
      const style = parse<{ name?: string }>(doc.getStyleAt(section, paragraph));
      const properties = parse<{ keepWithNext?: boolean }>(doc.getParaPropertiesAt(section, paragraph));
      if (properties.keepWithNext === true || /^(제목|표 제목|캡션|heading|caption)(\s|\d|$)/iu.test(style.name ?? '')) {
        add('isolated-heading', '제목 또는 다음 문단과 함께 배치할 문장이 쪽 끝에 따로 있습니다.', location.last, location.address);
      }
    } catch { limitations.add('일부 제목의 문단 속성을 읽지 못했습니다.'); }
  }
  limitations.add('편집기가 배치한 글줄과 위치를 확인할 수 있는 셀만 검사합니다. 인쇄 결과와 특수 영역은 별도 확인이 필요합니다.');
  return { findings, count, checkedPages, status: !checkedPages ? 'unavailable' : checkedPages < pages || limitations.size > 1 ? 'partial' : 'checked', limitations: [...limitations] };
}
