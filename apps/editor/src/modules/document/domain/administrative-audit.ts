// The font list and matching rule are adapted from IeumOffice doc-rules.
// Copyright 2026 Mainfunc, Inc. Licensed under Apache-2.0. See THIRD_PARTY_NOTICES.md.
import type { TableCellPathStep } from '../public/types.ts';

export type AuditAddress = {
  section: number;
  paragraph: number;
  offset: number;
  path?: readonly TableCellPathStep[];
};
export type AuditOptions = { fonts: boolean; nestedTables: boolean; mergedTables?: boolean; singleCellTables?: boolean };
export type AuditProfile = {
  fonts: readonly { names: readonly string[]; address: AuditAddress }[];
  nestedTables: readonly AuditAddress[];
  tables?: readonly {address:AuditAddress; rows:number; columns:number; cells:readonly {row:number;rowSpan:number;columnSpan:number}[]; hasText:boolean}[];
  limitations: readonly string[];
};
export type AuditFinding = { rule: keyof AuditOptions; label: string; address: AuditAddress };
export type AdministrativeAuditResult = {
  findings: readonly AuditFinding[];
  count: number;
  limitations: readonly string[];
};

const normalizeFont = (name: string) => name.trim().toLowerCase().replace(/\s+/gu, '');
const hangulOnlyFonts = new Set([
  '휴먼명조', '휴먼고딕', '휴먼엑스포', '휴먼옛체', '휴먼매직체', '휴먼둥근헤드라인', '휴먼궁서', '휴먼편지체',
  'HY신명조', 'HY견명조', 'HY중고딕', 'HY헤드라인', 'HY그래픽', 'HY강B', 'HY강M', 'HY목각파임B',
  'HY엽서L', 'HY엽서M', 'HY백송B', 'HY하쿠민', 'HY태고딕',
  '양재와당체', '양재소슬', '양재블럭', '양재깨비', '양재매화', '양재참숯',
  '새굴림', '필기체', '한양중고딕', '한양견명조',
].map(normalizeFont));

export function auditAdministrativeProfile(profile: AuditProfile, options: AuditOptions): AdministrativeAuditResult {
  const findings: AuditFinding[] = [];
  const seenFonts = new Set<string>();
  if (options.fonts) {
    for (const { names, address } of profile.fonts) {
      for (const name of names) {
        const key = normalizeFont(name);
        if (seenFonts.has(key) || !(hangulOnlyFonts.has(key) || /^(hy|한컴)/u.test(key))) continue;
        seenFonts.add(key);
        findings.push({ rule: 'fonts', label: `글꼴 호환성 확인 · ${name}`, address });
      }
    }
  }
  if (options.nestedTables) {
    for (const address of profile.nestedTables) {
      findings.push({ rule: 'nestedTables', label: '다른 표의 셀 안에 들어 있는 표', address });
    }
  }
  for(const table of profile.tables??[]){
    const {address,rows,columns,cells,hasText}=table;
    if(options.mergedTables&&rows*columns>1){
      const merged=cells.reduce((slots,cell)=>slots+cell.rowSpan*cell.columnSpan-1,0);
      const vertical=cells.filter(cell=>cell.row>0&&cell.rowSpan>=2).length;
      if(vertical||merged*3>=rows*columns){
        const reason=vertical?`본문 세로 병합 ${vertical}개`:`전체 칸 중 ${Math.round(100*merged/(rows*columns))}% 병합`;
        findings.push({rule:'mergedTables',label:`표의 읽기 순서 확인 · ${reason}`,address});
      }
    }
    if(options.singleCellTables&&rows===1&&columns===1&&hasText){
      findings.push({rule:'singleCellTables',label:'텍스트가 있는 한 칸짜리 표 · 배치 목적 확인',address});
    }
  }
  return { findings: findings.slice(0, 200), count: findings.length, limitations: profile.limitations };
}
