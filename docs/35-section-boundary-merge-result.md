# Delete/Backspace 구역 경계 합치기

2026-10-12. [구역 분할·기본 탭 보강](34-sections-tabs-result.md)의 후속 작업이다. 구역을 나눈 본문 경계에서 Delete/Backspace가 아무 동작도 하지 않던 경로를 기존 명령·저장 계층에 연결한다.

최신 후속: [한글 2024 실측과 HWPX 탭 저장 보정](36-native-section-comparison.md). 아래 4195 검수본 기록은 최초 구현 결과이며, 실제 한글 비교에서 추가로 발견한 탭 직렬화 결함은 4196 후속본에서 보정한다.

## 구현 계약

- 앞 구역의 마지막 본문 문단 끝에서 **Delete**, 뒤 구역의 첫 본문 문단 시작에서 **Backspace**를 누르면 두 구역을 합친다. 경계의 두 문단 텍스트와 글자 서식을 이어 붙이고 커서는 기존 앞 문단의 끝에 놓는다.
- 합쳐진 구역은 앞 구역의 쪽·구역·단·기본 탭 설정을 유지한다. 뒤 구역의 나머지 문단은 순서대로 이동하고 그 이후 구역의 설정은 유지한다.
- 열린 문서의 명령 라우터를 통한 snapshot 한 건으로 실행한다. 한 번의 되돌리기로 원래 구역과 커서·설정을 복원하며 다시 실행과 HWP/HWPX 저장을 지원한다. 디스크 원본을 별도로 수정하지 않는다.
- 일반 글자 삭제, 같은 구역의 문단 합치기, 셀·머리말/꼬리말·각주/미주·글상자, 선택 영역, Ctrl/Alt 삭제는 기존 키 처리 경로를 유지한다. 양식 편집에서는 이 구조 변경을 실행하지 않는다.
- API가 없는 공식 npm 엔진 빌드에서는 새로운 경계 명령을 실행하지 않는다. 검수용 엔진은 실제 API와 patch/JS/WASM 해시가 일치해야 연결한다.

제품 엔진 원본은 `engine/patches/section-split.patch`이며 새 API는 `mergeSectionBoundary(rightSectionIdx)`다. UI 연결은 `apps/editor/src/adapters/rhwp/section-boundary.ts`, 생성된 Studio에 대한 연결 패치는 `apps/editor/scripts/integration/section-boundary-patches.mjs`다. 읽기 전용 upstream은 변경하지 않는다. 이번 작업은 Agent wire contract에 새 명령을 추가하지 않는다.

## 안전한 초기 범위

경계 문단의 본문 개체·필드·범위 태그·차례 표시, 여러 문단에 걸친 필드, 뒤 구역의 독립적인 머리말/꼬리말 및 추가 단 정의 등은 변경 전에 거부한다. 앞 구역의 기존 머리말은 유지한다. 뒤 구역의 일반 후속 문단에 있는 표 등은 이동·저장 검사를 거친다. 거부 시 구역·본문·커서·dirty/history를 유지하고 상태 줄에 원인을 표시한다. 복잡한 문서의 모든 구역을 합칠 수 있다는 뜻은 아니다.

## 한글 2024 비교

한컴의 [구역 나누기 도움말](https://help.hancom.com/hoffice130/ko-KR/Hwp/format/break/section_break.htm)과 [구역 설정 도움말](https://help.hancom.com/hoffice130/ko-KR/Hwp/format/section/section.htm)은 경계 앞뒤의 Delete/Backspace로 구역을 제거하고 앞 구역의 모양을 따르는 기준을 명시한다. 이 기준을 명령과 설정 상속의 근거로 사용한다.

최초 시도에서는 스타일 창이 열린 상태에서 두 번 모두 `failed to activate captured window`로 실패하여 `hancom-comparison.json`에 **NOT_RUN**으로 기록했다. 사용자가 스타일 창을 닫은 후 실제 한글에서 Alt+Shift+Enter, Backspace/Delete, undo와 세 구역 설정 상속·HWP/HWPX 사본 저장을 수행했다. 경계 문단 이어 붙이기와 커서가 실제 한글과 일치함을 확인했다. 후속 비교와 탭 저장 결함·수정은 [36번 결과](36-native-section-comparison.md)를 따른다. 독립 조판/인쇄 비교는 남아 있고 새 렌더링 golden은 등록하지 않는다.

## 한글에서 확인할 절차

1. 검수 문서의 사본을 열어 경계의 두 문단, 구역 수, 용지·여백·단·기본 탭 설정을 기록한다.
2. `merge-before-*`의 앞 문단 끝에서 Delete를, 새 사본의 뒤 문단 시작에서 Backspace를 누른다. 문단 구분·글자 서식·커서 위치와 앞 구역 설정 유지 여부를 비교한다.
3. 빈 문단·세 구역·서로 다른 탭/용지·한글/이모지/탭·후속 표 사례를 반복한다. 한글에서 undo/redo 후 각각 저장한다.
4. Jueony의 `merge-*`/`ui-section-join-*` 결과와 한글 저장 사본을 양쪽에서 재열고 내용·서식·구역 설정을 비교한다.
5. 같은 글꼴·용지 조건으로 양쪽 PDF를 내보내 독립적인 쪽 수·배치·인쇄 비교를 수행한다. 복잡한 경계는 현재 지원 여부를 별도로 판정한다.

## 실행·검증 기록

검수본은 [Start-Review.cmd](../build/jueony-section-merge-20261012/Start-Review.cmd), 포트 **4195**다. 같은 묶음의 `Start-Jueony.cmd`도 사용할 수 있다. 이전 4173/4191~4194 서버·문서·업무 저장소는 변경하지 않았다. origin이 달라 기존 업무와 연결이 새 화면에 자동으로 나타나지 않을 수 있다.

| 검사 | 결과 | 증적 |
|---|---|---|
| 구역 합치기 새 엔진 진단 | 7 그룹 통과; 경계 7종·서식·3구역·설정·거부·머리말·이동 표 | `engine-result.json` |
| 기존 구역 분할·기본 탭 회귀 | 9 그룹 통과, HWP/HWPX 32개 왕복 | `split-tabs-regression.json` |
| 편집기 단위·계약 회귀 | 252 통과, 실패·건너뜀 0 | `editor-tests.txt` |
| 실제 키·undo·저장·기존 UI·복구·Agent 편집 | 19 시나리오 통과 | `parity-result.json` |
| 업무·지정 자료·Agent·매크로 | 9 시나리오 통과 | `workbench-result.json` |
| 최종 묶음·기존 v1 상태·업무 격리·파일 저장 | 4 시나리오 통과 | `compatibility-result.json` |
| Rust/WASM·프런트엔드·TypeScript 빌드 | 통과; `cargo --locked`, WSL 검수용 release | `engine-build.json`, `build-evidence.json`, `verification.json` |
| Facade 모듈 경계 | 9 모듈, 위반·예외 0 | `boundaries.json` |
| 최초 실제 한글 비교 시도 | **NOT_RUN**, 당시 스타일 창 활성화 오류; 후속 일부 직접 비교 수행 | `hancom-comparison.json`, [후속 기록](36-native-section-comparison.md) |

[검증 기록](evidence/section-merge-2026-10-12/)에 성공 결과와 수정 전 실패를 함께 보존한다. 이전 WASM에는 merge API가 없었고 이전 UI에서는 실제 Delete 후 두 구역이 유지되어 제한 시간 안에 합쳐지지 않았다. 같은 새 UI 시나리오는 HWP/HWPX와 Delete/Backspace 조합 모두 통과했다. 구역·설정·dirty 및 원래 커서의 undo 복원을 검사한다. 일반 문단 합치기, 문서 시작/끝, 양식 모드·표 셀과 지원하지 않는 독립 머리말 경계는 대조군으로 확인했다.

초기 진단에서 표를 생성하면 뒤에 본문 문단이 추가되는 것을 놓쳐, 경계가 아닌 표를 거절해야 한다고 잘못 기대한 실패가 있었다. 실제 경계 문단에 표·필드가 있는지 먼저 확인하도록 검사 입력을 수정했고 7개 그룹이 통과했다. 엔진에 표 문서별 예외를 추가하거나 보존 검사를 완화하지 않았다. 초기 실패 기록은 `initial-diagnostic-*`로 남겼다.

구역 병합 전후 엔진 저장 파일 **42개**와 실제 UI에서 저장한 파일 **13개**, 총 **55개**를 기록 폴더의 `documents`와 검수 묶음의 `review-documents`에 넣었다. 기존 합성 문서도 실행 묶음에 유지하며 총 105개 파일이 있다. `documents.json`은 이번 55개 파일의 SHA256을 기록한다. 이 파일들은 한글로 저장한 독립 기준 문서가 아니라 한글에서 확인할 Jueony 합성 결과다.

252개 회귀는 기존 공식 npm 엔진을 포함한 단위·계약 검사다. 새 패치 엔진 근거는 7+9개 기능 진단 그룹과 19+9+4개 브라우저 시나리오다. 브라우저 검사는 임시 프로필·독립 포트·메모리 연결 저장소·합성 모델을 사용하며 사용자 자료·API 키를 변경하거나 유료 모델을 호출하지 않았다. 오프라인 UI와 최종 묶음 검사에서 외부 요청과 page error는 0건이다.

새 엔진 소스 ID는 `1fede95758e046e6`, WASM SHA256은 `cb018ea7a0a198c464cfb6d250bd781d2fb609929c03729d244675d832d49aa9`다. 프런트엔드는 `0d230e0`에서 구현 변경이 있는 상태로 빌드했으며 제품 소스·patch·JS/WASM 해시로 식별한다. 구현을 커밋·푸시한 `9f20f92`와 같은 제품 입력이다. WASM은 Rust release 빌드이나 wasm-opt 배포 최적화와 독립 한글 출력 비교는 미실행이다.

## 남은 범위

- RangeTag 단독 경계와 뒤 구역의 추가 ColumnDef 거부는 공개 생성 API/입력 표본이 없어 별도 사례 검사를 하지 못했다. 코드상 사전 거부와 실행 검증을 구분한다.
- 뒤 구역의 독립 머리말/꼬리말·복잡한 조판 부호·바탕쪽 payload와 경계 개체를 포함한 병합은 추가 설계·실제 한글 기준이 필요하다.
- 선택 영역으로 여러 구역을 한 번에 지우는 확장과 Agent의 구역 나누기/합치기 명령 계약은 이번에 추가하지 않았다.
- 모든 한글 문서의 조판·인쇄·미지원 원본 레코드 보존은 같은 엔진의 저장 검사가 보증하지 않는다. 한글 2024 전체 동등성 및 배포 완료 판정은 하지 않는다.
