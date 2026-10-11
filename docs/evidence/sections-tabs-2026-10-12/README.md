# 구역·탭 검수 근거

- `engine-result.json`: 고정 소스와 3개 패치를 직접 빌드한 WASM의 9개 기능 진단 그룹. 32개 HWP/HWPX 저장·재열기, 본문·서식·구역·표·머리말과 탭 위치 진단.
- `parity-result.json`: 새 엔진의 실제 UI/단축키/저장/undo/복구/Agent 명령 시나리오 12개. 외부 요청 0, page error 0.
- `workbench-result.json`: 합성 모델을 사용한 검색·검토·매크로·업무 환경 9개 시나리오.
- `compatibility-result.json`: 최종 실행 묶음에서 v1 업무·채팅·폴더 handle·문서·매크로 복원/재저장 4개 시나리오.
- `editor-tests.txt`: 기존 공식 npm 엔진을 포함한 편집기 단위/계약 252개. 새 패치 WASM의 증거는 별도 engine/UI 보고서다.
- `hancom-baseline.json`: 설치 한글 2024 버전과 독립 기본 템플릿의 탭 단위 메타데이터. 직접 입력/출력 비교는 창 활성화 오류로 미완료.
- `table-creation-before-fix.json`: 구역 분할 유무 × HWP/HWPX로 재현한 기존 신규 표 저장 전후 속성 불일치. 최종 패치 결과는 `engine-result.json`을 따른다.
- `documents/`와 `documents-manifest.json`: 한글에서 열어 볼 합성 파일 41개와 파일별 SHA256. 엔진 32개 + 실제 앱 저장 9개.
- `build-evidence.json`, `bundle-evidence.json`: 실제 소스·patch·JS/WASM·런타임 해시와 검수 빌드 방식.
- `boundaries.json`, `summary.json`: 모듈 경계와 검사 결과 집계.

이 파일들은 독립 한글 렌더링 golden이나 전체 파일 호환성 인증이 아니다. 사용자 API 키·업무 문서·개인 프로필을 검사 데이터로 사용하지 않았다.
