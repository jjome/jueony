import type { AdministrativeAuditResult, AuditAddress, AuditOptions, DocumentQueryFacade } from '../../modules/document/public/index.ts';
type Inspection = Pick<AdministrativeAuditResult, 'count' | 'limitations'> & {
  findings: readonly { label: string; address: AuditAddress }[]; status?: string;
};

export function showAdministrativeAudit(
  query: DocumentQueryFacade,
  documentToken: () => string,
  moveTo: (address: AuditAddress) => void,
  mode: 'administrative' | 'layout' = 'administrative',
): void {
  const token = documentToken();
  const dialog = document.createElement('dialog');
  dialog.id = 'jueony-administrative-audit';
  dialog.style.cssText = 'width:min(34rem,90vw);max-height:80vh;overflow:auto;padding:1.25rem';
  dialog.setAttribute('aria-labelledby', 'jueony-administrative-audit-title');
  const title = document.createElement('h2');
  title.id = 'jueony-administrative-audit-title';
  title.textContent = mode === 'layout' ? '쪽 배치 검사' : '행정 문서 검사';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const results = document.createElement('ul');
  const options: AuditOptions = { fonts: true, nestedTables: true, mergedTables:false, singleCellTables:false };
  const settings = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = '검사 항목';
  settings.append(legend);
  const run = document.createElement('button');
  run.type = 'button';
  run.textContent = '검사';
  for (const [key, text] of [['fonts', '한글 전용 글꼴'], ['nestedTables', '중첩 표'],['mergedTables','병합이 많은 표'],['singleCellTables','텍스트가 있는 한 칸짜리 표']] as const) {
    const label = document.createElement('label');
    label.style.display = 'block';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = options[key]===true;
    check.onchange = () => {
      options[key] = check.checked;
      run.disabled = !Object.values(options).some(Boolean);
      status.textContent = '검사 항목을 변경했습니다.';
      results.replaceChildren();
    };
    label.append(check, ` ${text}`);
    settings.append(label);
  }
  function verifyDocument() {
    if (documentToken() !== token) throw new Error('문서가 바뀌었습니다. 검사를 다시 여세요.');
  }
  run.onclick = async () => {
    run.disabled = settings.disabled = true;
    results.replaceChildren();
    status.textContent = '문서를 검사하고 있습니다.';
    try {
      verifyDocument();
      const result:Inspection=await (mode==='layout'?query.inspectLayout():query.auditAdministrativeDocument({...options}));
      if (!dialog.open) return;
      verifyDocument();
      status.textContent = [
        result.status === 'unavailable' ? '배치를 검사할 수 없습니다.'
          : result.count ? `${result.count}건을 확인했습니다.` : '검사 범위에서 확인할 항목이 없습니다.',
        result.count > result.findings.length ? `${result.findings.length}건까지 표시합니다.` : '',
        ...result.limitations,
      ].filter(Boolean).join(' ');
      for (const finding of result.findings) {
        const item = document.createElement('li');
        const location = document.createElement('button');
        location.type = 'button';
        location.textContent = `${finding.label} · ${finding.address.section + 1}구역 ${finding.address.paragraph + 1}문단으로 이동`;
        location.onclick = () => {
          try {
            verifyDocument();
            moveTo(finding.address);
            dialog.close();
          } catch (error) {
            status.textContent = error instanceof Error ? error.message : String(error);
          }
        };
        item.append(location);
        results.append(item);
      }
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      run.disabled = settings.disabled = false;
    }
  };
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '닫기';
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.append(title);
  if (mode === 'administrative') dialog.append(settings);
  dialog.append(run, close, status, results);
  document.body.append(dialog);
  dialog.showModal();
  run.click();
}
