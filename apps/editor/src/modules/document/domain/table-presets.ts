export const tablePresets = [
  { id: 'grid', name: '기본 격자', border: '#666666', header: '#eeeeee', stripe: '#ffffff' },
  { id: 'blue', name: '파란 제목행', border: '#8da9c4', header: '#dceaf7', stripe: '#f1f6fb' },
  { id: 'gray', name: '회색 줄무늬', border: '#aaaaaa', header: '#dddddd', stripe: '#f2f2f2' },
  { id: 'clear', name: '테두리·배경 없음', border: '#000000', header: '#ffffff', stripe: '#ffffff' },
] as const;
export type TablePresetId = typeof tablePresets[number]['id'];
export function tablePresetCell(id: TablePresetId, row: number, titleRow: boolean) {
  const preset = tablePresets.find(v => v.id === id);
  if (!preset || !Number.isSafeInteger(row) || row < 0 || typeof titleRow !== 'boolean') throw new Error('표 모양 선택이 올바르지 않습니다.');
  const border = { type: id === 'clear' ? 0 : 1, width: id === 'clear' ? 0 : 4, color: preset.border };
  return { borderLeft: { ...border }, borderRight: { ...border }, borderTop: { ...border }, borderBottom: { ...border },
    fillType: id === 'clear' ? 'none' : 'solid', fillColor: titleRow && row === 0 ? preset.header : row % 2 ? preset.stripe : '#ffffff', patternType: -1 };
}
