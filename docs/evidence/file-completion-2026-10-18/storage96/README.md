# 파일 저장·복구 합본96 고정 근거

[구현·제한](../../../117-file-storage-closure.md). 공식107패치 `source-2feb978b45e2964e`와 `dist-file-storage96`을 고정했다. 이번에 한글 직접 비교는 하지 않았다.

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| 동일 공식 빌드26군 | 324/324 | [결과](workflows/result.json)·군별 원형 JSON·gzip 로그 |
| 실제 이력 UI·부모/iframe·HWT·문서 정보 | 12/12 | 위 history-ui95에 포함 |
| 실제 WASM HWT 필수 검사 | 9/9 | 위 hwt-template95에 포함; 설치21개 선택 검사는 별도 후보 근거 |
| 단위 | 1008/1008 · skip0 | checks/unit96.log.gz |
| 기존 단·표 | 24/24 | [결과](columns/result.json); 날짜 차이 처리 아래 참조 |
| 독립 OLE 원본 날짜 | 28/28 | [결과](columns/independent-28.json) |
| 실제 Windows Rust 저장 | 10/10 · ignore0 | [결과](windows/result.json) |
| 실행 묶음 | 7/7 | [결과](bundle/result.json); 임시 memory 서버만 사용 |
| TypeScript·모듈 경계 | 통과 | checks/ |

324에는 이력16·UI12·XML제약10·저장날짜17·HWT9·story5·명시 지정한 원본 셀13이 포함된다. 별도 단위/Native 검사와 더해 제품 검증률을 만들지 않는다. 셀13은 원본과 기존 비교 자료의 SHA를 고정해 명시 지정했다. 입력하지 않은 검사를 성공으로 세지 않는다. 이번 Agent 검사는 로컬 합성 응답이며 실제 외부 LLM 호출은 하지 않았다.

## 날짜 차이를 숨기지 않음

서로 다른 원본과 한글 재저장본은 실제 수정 날짜가 다르다. 이전102엔진에는 날짜 관측 API가 없다. 새 API로 이 값이 보이면서 기존24검사는 처음17건 실패했다. `before/columns-new-date-observations.json`에 전체 차이를 남겼다. 새 검사는 완전 비교 결과를 지우지 않고, 원본 CFB/OLE를 독립 해석한4값의 차이와 **정확히 일치할 때만** 기존 자료의 관측으로 구분한다. 다른 의미·모든 공개 지면·쪽 수가 달라지면 실패한다. 후보의 저장→재열기는 이 구분 함수를 쓰지 않으며 날짜를 포함해 모든 의미를 엄격히 일치시킨다.

첫 HWT 합본 실패는 선택 검사2건을 필수9건에 더한 기대 개수11의 집계 오류였다. 실제 필수9건의 실패가 아니다. 당시 실패한 집계도 before에 남겼다. 엔진 환경변수 없이 이전 npm 엔진을 사용한 단위 실패는, 최종 공식107의1008건 통과와 분리해 보관했다.

## 근거 읽기와 원형 보존

`candidate/`에는 후보 당시의 통합 대기·실패/수정 기록을 보존했다. 최종 공식 결과는 workflows가 기준이다. HWT의 이전 Native JSON receipt 검사와 최종 실제 WASM, 실제 host→iframe 연결을 구분했다. Native 선택 검사를 공식 Rust 전체 통과라고 부르지 않는다. 로그는 gzip으로 포장했고 펼친 원본 바이트는 그대로다. 내부 인계 manifest의 log 경로에는 `.gz`를 붙여 펼쳐 확인한다.

`official-source-proof.json`은 새5패치의 공식 소스 raw SHA와 CRLF→LF만 적용한 text SHA를 따로 기록한다. 좌표·문서·비교 결과는 정규화하지 않았다. 폰트 프로그램·설치된 상용 XML·브라우저 profile·실행파일·API 키는 포함하지 않는다. samples24개는 자체 시험 데이터의 실제 저장 파일이다.

루트 `SHA256-MANIFEST.json`이 모든 기록을 고정한다. `python verify.py`로 검사할 수 있다. 미완료 MCST/Python3 최초 조판·HWP5 명시 방향·HWT 편집/XSL/일반 XSD·OS/한글 직접 검수는 완료로 표시하지 않았다.
