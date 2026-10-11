# 실제 편집기 사전 검사 회귀

실행: `node --experimental-strip-types apps/editor/scripts/verify-agent-preflight.mjs`

하네스는 포트 4208의 독립 메모리 서버, `apps/editor/evidence/dist-continuation`, 새 headless Edge 프로필을 사용한다. 사용자 문서·API 키·기존 서버를 사용하지 않는다. 서버가 이미 있으면 중단하며 자신이 시작한 서버만 종료한다.

## 최초 검수와 수정 원인

15개 사례 중 12개가 통과했다. `strict-comparison-before-fix.json`에 실패 3건과 원본 무변경 여부를 보존했다.

- HWPX 새 초안: 사전 검사 사본이 `createEmpty()`만 사용하여 기본 글자 모양을 등록하지 않았다. HWPX export가 `charPrIDRef: [0]` 미등록 참조를 거절했다. 통합 담당이 새 사본의 `createBlankDocument()` 초기화를 맡았다.
- HWPX 표 배경 2건: 단색 배경의 `patternType`이 메모리의 0에서 HWPX 재열기 후 -1로 변했다. 본문과 나머지 구조는 같지만 엄격한 구조 비교가 거절했다. `format_table_cells`의 단색 배경 명령에 `patternType: -1`을 명시하여 두 형식에 같은 무늬 없음 값을 쓰도록 수정했다. 비교에서 해당 필드를 무시하지 않는다.

엔진 근거: `upstream/rhwp/src/parser/hwpx/utils.rs`는 무늬 없음=-1 및 hatchStyle 생략의 기본값을 정의한다. `renderer/layout/utils.rs`는 pattern_type <= 0을 단색으로 처리한다.

## 단위 회귀

`node --experimental-strip-types --test apps/editor/tests/agent-preflight-format.test.ts apps/editor/tests/document-control.test.ts`

수정 후 **10개 통과 / 실패·건너뜀 0**. 두 새 시험은 실제 사본 경로처럼 원래 형식의 파일을 읽고 단색 표 머리글을 적용한 뒤 export 손실 보고 0, 본문 및 `readStructure` 전체 동일을 HWP/HWPX 각각 검사한다. 기존 8개 시험은 표·행열·셀·본문 서식·쪽 설정·두 형식 저장·undo 회귀다.

## 브라우저 검수 범위

최신 재실행 결과는 `result.json`과 build fingerprint로 구분한다. HWP/HWPX 각각 새 초안, 글자 서식, 문단 서식, 표/셀/배경, 행열 삽입·삭제, 용지/여백, 복합 명령의 **적용 → 저장 → 엔진 재열기 → 요청 undo**를 검사한다. 공개 `notes.hwpx`는 기존에 다운로드한 원본 SHA-256을 확인한 뒤 동일형식 사전 검사와 무변경 여부만 검사한다.

생성된 문서는 합성 자료로 실제 한글에서 별도 확인할 수 있다. 같은 엔진의 재열기 결과는 한컴 한글 2024의 독립적인 표시·편집 검증을 대신하지 않는다.

## 최종 재검수

최종 동결 빌드의 브라우저 검수는 **15/15 통과**, 페이지 오류 0, 외부 요청 0이다. `result.json`의 `build` 항목이 사용한 정확한 빌드의 시각과 source/WASM hash를 기록한다.

합성 14건은 실제 `jueonyEditor.apply`를 호출한 뒤 `api.snapshot()`의 본문·구조와 `api.recovery().bytes`를 엔진에서 다시 읽은 본문·`readStructure` 전체가 일치함을 검사했다. `structurePreserved: true`, 빈 `savedStructureDiff`, `undo: true`로 각 결과를 남겼다. 사전 검사 사본만 통과한 결과가 아니다. 모든 합성 결과 HWP/HWPX 파일을 이 폴더에 저장했다. 공개 notes.hwpx 1건은 수정 없이 같은 형식의 사전 검사만 실행했고 원본 snapshot이 그대로임을 확인했다.

새 빈 HWPX 사전 검사에서 추가로 발견된 비활성 배경 값은 `fillType: none`의 `patternColor #999999 → #000000`, `patternType -1 → 0`이었다. 두 값 모두 그 상태에서는 배경 무늬를 그리지 않는다. 기본 파일을 쓰고 읽으면서 비활성 기본값이 정규화되는 현상이며 문서 내용의 변화로 판정할 대상은 아니다. 통합 수정은 새 사본을 대상 형식으로 한 번 저장·재열기하여 기준을 초기화했다. 구조 비교에서 필드를 제거하거나 사용자의 live 문서 값을 강제로 덮어쓰지 않았다. 이후 명령 적용 결과는 기존처럼 모든 구조 필드를 엄격히 비교한다.

이번 HWPX 합성 검수는 파일로 열린 HWPX를 기준으로 한다. 별도의 실제 저장 대화상자에서 새 HWP를 다른 이름의 HWPX로 바꾸는 UI 전체 흐름, 모든 복잡한 문서, 독립 한컴 한글 표시 일치까지 통과했다고 주장하지 않는다.
