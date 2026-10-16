# 기능별 작업표 표시 검증

2026-10-16. 이 검사는 문서 구성·표 표시만 검증한다. 편집기 구현·한글 비교·Agent 연결 상태는 변경하지 않는다.

- 기존 종합표는 제목 5열·구분선 6열로 불일치했다. 실제 GFM 파서에서 기능별 표로 인식되지 않는 것을 확인했다.
- 종합 문서는 최상단 종합표 1개, 전체 집계 1개와 기능별 요약표 16개로 나눴다. 최상단 표는 README에도 자동으로 반영한다.
- 상세 문서는 부모·자식 항목을 함께 배치하고 작업표를 최대 8행으로 나눴다. 범위와 실행 작업을 구분한다.
- 17개 문서의 139개 표를 bundled marked GFM 파서와 별도 headless Edge로 렌더링했다. 열 수와 실제 DOM 구조가 일치했다.
- 기존 425개 ID가 각각 한 작업표와 한 상세 근거에 유지된다. CSV 상태와 집계 원본은 바꾸지 않았다.
- 표 문법·항목 소유·링크·집계·원본 보존·README 자동 동기화 검사 12개가 통과했다.

[검증 결과와 문서 해시](table-rendering.json) · [최상단 종합표 화면](overview-dashboard.png) · [기능별 요약표 화면](overview-table.png) · [셀 분할·병합 작업표 화면](table-functions.png)

재검사:

```powershell
python scripts/render_work_checklist.py --check
python scripts/test_feature_checklists.py
# JUEONY_MARKED_PACKAGE에 설치된 marked/lib/marked.esm.js의 절대 경로를 지정한다.
# 기존 apps/editor의 puppeteer-core와 설치된 Edge를 사용하며 패키지를 다운로드하지 않는다.
node scripts/verify_feature_tables.mjs
```

실제 렌더링 스크립트는 전체 문서의 표를 검사하고, 대표 표의 화면을 저장한다. 620/1100px 폭 검사와 스크린샷은 셀 분할·병합 작업표 미리보기를 대상으로 한다. Codex 자체의 Markdown 렌더러와 동일하다는 보장은 아니며, GFM과 Edge로 재현 가능한 표시를 확인한 결과다.
