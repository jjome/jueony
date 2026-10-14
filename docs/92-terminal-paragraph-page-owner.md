# 92. 흡수된 끝 빈 문단의 페이지 소유

2026-10-14. 91번에서 원복으로 보호하던 긴 표의 결과 조회 실패를 수정했다. 한글 직접 비교는 마지막 일괄 검수로 미룬다. 기존 실행본·원본 문서는 유지한다.

## 원인과 변경

긴 표의 열을 균등 분배한 뒤 Native 재조판과 Canvas 메트릭 재배치가 끝나면, 엔진이 빈 문단만 남은 마지막 쪽을 제거할 수 있다. 이 정책은 기존 출력의 불필요한 끝 빈 쪽을 줄이기 위한 것이다. 그런데 마무리 단계가 물리 쪽을 지우면서 그 쪽이 소유하던 논리 문단 ID도 버렸다. 문서 모델에는 끝 빈 문단이 남아 있어 `readStructure → getPageOfPosition`이 실패했다.

새 추적 패치 `zzzzzzzzzzzzzzzzzzzzzz-hidden-paragraph-page-owner.patch`를 추가한다. 참조 저장소는 수정하지 않으며 새 불변 엔진 `source-d46ea37c6fc63c03/pkg`를 빌드했다.

- `typeset/state/finalize::discard_terminal_blank_only_page`는 **기존 조건으로 실제 제거한** 쪽의 빈 본문 문단 ID를 반환한다. 제거 조건, 측정·줄 구성, 페이지 수 결정은 바꾸지 않는다.
- `typeset/state/commands`는 그 ID를 기존 `hidden_empty_paras`에 기록한다. 이것이 소유 정보의 생산 지점이다.
- `find_pages_for_paragraph`는 정상 PageItem/어울림 조회를 먼저 수행한다. 결과가 없고, 명시적으로 숨김 처리됐으며, 실제 문단에 글·컨트롤이 없을 때만 앞선 실제 본문 PageItem의 끝 페이지를 소유 페이지로 사용한다. 여러 쪽에 걸친 표는 마지막 조각의 페이지를 사용한다. 앞선 소유 항목을 찾지 못하거나 일반 문단/잘못된 주소인 경우 기존 오류를 유지한다.
- `getPageOfPosition → readStructure → 엄격 렌더 callback의 결과 확인`이 이 소유 결과를 소비한다. 다른 구역은 기존 전역 쪽 offset을 더한다. 문서 덤프에서 이미 사용하던 숨김 문단 소유 규칙과 일치한다.

조회만 보완한 중간 엔진은 반례를 해결하지 못했다. 실제 끝 쪽 제거에서 ID를 보존해야 한다는 것을 추가 확인했으며, 중간 실패는 진단 자료로 구분한다. 좌표 clamp, 허위 PageItem 추가, 보존·실제 배치·보호 검사 완화, 임의의 페이지 번호 반환은 하지 않는다.

## 실제 검증

동일 Native 6개 검사에서 이전 엔진 4개 실패·2개 통과, 수정 후 6개 통과를 확인한다. HWP/HWPX 끝 빈 문단, 여러 길이의 긴 내용, 뒤 구역 전역 쪽, 실제 글이 있는 후속 문단, 명시적인 빈 쪽 나누기, 잘못된 주소 거절, 조회의 bytes/geometry 불변과 snapshot 복원·재열기를 포함한다. HWP 문서는 Native 진단이며 HWP Agent 크기 편집 지원으로 분류하지 않는다.

이전 4310 빌드에서 실패한 **같은 브라우저 성공 기준**을 새 엔진에서 검사한다. 실제 채팅 적용, 결과 조회, undo/redo, 저장, Canvas 글꼴 메트릭이 초기화된 UI 재열기, 전역 쪽, 후속 본문 키보드 입력이 대상이다. 일반 페이지 조회 오류를 주입하면 기존 엄격 렌더 트랜잭션이 여전히 전체 요청을 원복하고 다음 요청을 처리해야 한다.

별도 진단 문서에서 같은 Native 크기 변경과 정상 화면 재렌더를 양 엔진에 실행했다. **모든 쪽의 control/text layout JSON이 이전·이후 완전히 동일**하다. 끝 빈 문단의 페이지 조회만 실패에서 정상 소유 페이지로 바뀐다. 이전·이후 화면과 JSON은 `before-geometry-browser`, `geometry-browser`, `geometry-invariance.json`에 보존한다. 이 진단은 Agent 성공 출력과 구분한다.

## 실행과 후속 범위

검수 실행기: `build/jueony-paragraph-page-owner-20261014/Start-Review.cmd`, 포트 `4312`. 별도 origin의 업무 저장소를 사용한다. 실행 묶음의 `review-documents/paragraph-page-owner/browser/equal-long-owned.hwpx`, `equal-long-later-section.hwpx`, `equal-long-text-tail.hwpx`를 실제 한글 2024에서 열어 표·글줄·뒤 본문과 재열기를 비교할 수 있다.

91번 긴 표의 페이지 조회 실패는 이번 범위에서 해결했다. HWP 여러 표의 후속 앵커 배치 차이, 행 높이 균등 분배·직접 크기 지정, 병합/복합 표, 모든 수동 기능의 Agent 제어와 한글 전체 동등성은 남는다. 정상 HWP의 Agent 안 여백·너비 제한은 유지한다. 독립 한글 비교·유료 모델 호출·Native Rust unit suite는 실행하지 않는다. 전체 문서화된 구현은 미완료이므로 자동화를 유지한다.

최종 검사 수치·원본/성공/이전 실패 파일 분류·실제 실행 묶음의 소스 해시는 같은 증거 폴더의 `verification-summary.json`, `documents.json`, `source-baseline-notes.json`을 따른다. 과거 전체 편집기 검사를 모두 재실행한 수치로 표시하지 않는다.
