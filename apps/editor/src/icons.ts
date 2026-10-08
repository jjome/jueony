// 직접 작성한 단순 선 아이콘. 특정 제품의 이미지 자산을 포함하지 않는다.
const paths: Record<string, string> = {
  'file:open': 'M3 7h6l2 3h10l-3 10H3Z M3 7V4h7l2 3h7v3',
  'file:new-doc': 'M6 2h8l5 5v15H6Z M14 2v6h5 M9 15h7 M12.5 11.5v7',
  'file:save-as': 'M4 3h13l3 3v5 M4 3v18h7 M7 3v6h9V3 M7 21v-8h6 M14 17l6-6 3 3-6 6-4 1Z',
  'table:cell-props': 'M3 4h18v16H3Z M3 9h18 M9 4v16 M15 4v16 M3 14h18',
  'table:cell-merge': 'M3 4h18v16H3Z M3 9h18 M3 15h18 M12 4v5 M12 15v5 M7 12h10 M7 12l2-2 M7 12l2 2 M17 12l-2-2 M17 12l-2 2',
  'table:cell-split': 'M3 4h18v16H3Z M3 12h18 M12 4v16',
  'table:insert-row-col': 'M3 3h15v13H3Z M3 9h15 M10 3v13 M17 15v7 M13.5 18.5h7',
  'table:delete-row-col': 'M3 3h15v13H3Z M3 9h15 M10 3v13 M14 19h7',
  'table:cell-height-equal': 'M5 4h16 M5 12h16 M5 20h16 M2 6v12 M2 6l-1 2 M2 18l-1-2',
  'table:cell-width-equal': 'M4 5v16 M12 5v16 M20 5v16 M6 2h12 M6 2l2-1 M18 2l-2-1',
  'insert:equation': 'M19 3H7l7 9L7 21h12',
  'insert:bookmark': 'M7 3h10v18l-5-4-5 4Z',
  'page:header-create': 'M5 2h14v20H5Z M8 6h8 M8 9h8',
  'page:footer-create': 'M5 2h14v20H5Z M8 16h8 M8 19h8',
  'edit:goto': 'M5 3h14v18H5Z M1 12h12 M9 8l4 4-4 4',
};
export function fallbackIcon(id: string) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'j-line-icon');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[id] ?? 'M4 3h16v18H4Z M8 8h8 M8 12h8 M8 16h5');
  svg.append(path); return svg;
}
