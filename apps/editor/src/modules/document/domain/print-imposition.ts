export type PrintImposition = { perSheet: 2 | 4; orientation: 'portrait' | 'landscape'; paper: 'a4' | 'letter'; marginMm: number; parity: 'all' | 'odd' | 'even'; reverse: boolean };
export type PrintSlot = { page: number; row: number; column: number };

export function planPrintImposition(pageCount: number, options: PrintImposition) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 60) throw new Error('모아찍기는 1~60쪽 문서를 지원합니다.');
  if (![2, 4].includes(options.perSheet) || !['portrait', 'landscape'].includes(options.orientation)
      || !['a4', 'letter'].includes(options.paper) || !['all','odd','even'].includes(options.parity)
      || !Number.isFinite(options.marginMm) || options.marginMm < 0 || options.marginMm > 25) throw new Error('모아찍기 설정이 올바르지 않습니다.');
  const [short, long] = options.paper === 'a4' ? [210,297] : [215.9,279.4];
  const landscape = options.orientation === 'landscape';
  const widthMm = landscape ? long : short, heightMm = landscape ? short : long;
  const columns = options.perSheet === 4 || landscape ? 2 : 1;
  const rows = options.perSheet / columns;
  const pages = Array.from({length:pageCount},(_,page)=>page).filter(page => options.parity === 'all' || (page % 2 === 0) === (options.parity === 'odd'));
  if (options.reverse) pages.reverse();
  const sheets: PrintSlot[][] = [];
  for (let i=0;i<pages.length;i+=options.perSheet) {
    sheets.push(pages.slice(i,i+options.perSheet).map((page,slot)=>({page,row:Math.floor(slot/columns),column:slot%columns})));
  }
  return { widthMm, heightMm, rows, columns, sheets, marginMm:options.marginMm };
}
