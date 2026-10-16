# 파일 저장·복구·형식 보존 최종 합본 검증

2026-10-17. [완료한 범위와 남은 제한](../../108-file-preservation-completion.md) · [기능별 작업표](../../features/05-files-storage-recovery.md) · [기계 판독 요약](verification-summary.json).

| 검사 | 통과 | 근거 |
| --- | ---: | --- |
| 편집기 단위 | 815 | [원시 로그](unit-tests.txt) |
| 실제 WASM | 458 | [묶음별 집계](verification-summary.json) |
| 실제 Edge | 338 | [실행 목록](regressions.json) |
| 실제 Windows 파일 저장 | 10 | [생산 Rust 코드 실행 결과](native-windows/result.json) |
| TypeScript | 오류 0 | [원시 로그](typescript.txt) |
| 모듈 경계 | 9개·소스 306개 | [검사 결과](boundaries.json) |
| Tauri Windows 명령 계층 | 컴파일 통과 | [cargo check 로그](tauri-check.txt) |

모든 주 결과의 WASM은 `0f192f1394068a6543518487b10f0ce4ea611f6b9754ca317c1c0888bd467cef`이며, 브라우저 결과는 같은 `dist-file-preservation` 소스 지문을 사용한다. 58개 묶음의 테스트 실행 수이며 전체 한글 기능 완료율은 아니다. 실제 제공자 과금 호출은 수행하지 않았다.

## 주요 근거

- 겹침 표: `overlap-body-native`, `overlap-positive-native`, `overlap-visible-native`, `overlap-guard-native`, `overlap-visible-browser`.
- 다운로드 승인·취소·실패·연결·출력 형식: `download-browser`의 실제 다운로드 결과와 해시. 복구본 재열기는 바이트를 새 엔진으로 여는 검사이며 프로세스 재시작 검사와 구분한다.
- 닫기 취소·IDB 삭제 오류/transaction abort·dirty/undo/원본 보존·재폐기: `close-browser`.
- 실제 강제 종료·checksum·손상 기록 격리: `integrity-browser`. 별도 Edge 프로필의 Browser.crash는 정상 종료 이벤트 없이 두 형식의 미저장 내용을 복원했다.
- Windows 읽기 전용·독점/교체 공유 잠금·기준 지문: `native-windows`. 브라우저 OPFS나 가짜 저장 adapter를 실제 OS 파일 검사로 계산하지 않았다.

`story-timing-diagnostic/`에는 첫 검사기의 비동기 스크롤 사전조건 차이와 대조 trace를 남겼다. 이후 저장/비교 전 뷰 동일성을 먼저 검사하도록 수정하고, 기존 전체 상태·스크롤·재시작 deepEqual은 유지했다. 최종 `story-browser` 7개만 완료 수치에 포함한다. 진단 실패를 숨기거나 같은 검사 통과 수를 반복 합산하지 않았다.

고의 손상/미지원 실패 파일은 [해시 목록](fault-artifact-hashes.json)으로 남기며 성공한 검수 문서에 포함하지 않는다. 일부 공개 문서 파생 파일도 [해시 목록](related-artifact-hashes.json)으로만 추적한다.

## 실행·직접 검수

`build/jueony-file-preservation-20261017/Start-Review.cmd`(4328)와 `review-documents/file-preservation/`를 사용한다. `overlap-body-native`의 여러 줄·캡션, `overlap-positive-native`의 간격, `native-windows`의 두 형식 원본/수정 예제를 우선 확인한다.

한글 2024 직접 재열기·지면/인쇄 비교, Windows 실제 선택창부터 저장하는 전체 GUI, 모든 ACL과 전원/디스크 장애 검수는 미실행이다. 혼합 크기 줄 partition이나 중복 주소 등의 미지원 원본은 여전히 안전하게 거절한다. 자동 작업 예약은 사용자의 중지 요청대로 꺼진 상태이며, 이번 검사는 직접 요청한 작업으로 수행했다.
