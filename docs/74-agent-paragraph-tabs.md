# 74. AI 문단 사용자 탭

2026-10-14. `set_paragraph_tabs`를 공통 계약에 추가한다(34종). 현재 편집 가능한 일반 본문 문단의 사용자 탭 목록과 양 끝 자동 탭을 바꾼다. 다른 문단의 탭 명령끼리 최대 30개를 한 요청에 묶고 전체를 한 번에 되돌린다. 같은 대상 중복·다른 기능과의 혼합 요청·반복 기록·자동 저장은 지원하지 않는다.

`stops`는 32개 이하이며 `positionMm` 0.1~1000mm를 실제 본문 너비 안에서 중복 없이 오름차순으로 지정한다. 한글 단위로 반올림한 뒤 같은 위치가 되는 값도 거절한다. 정렬은 left/right/center/decimal, 채움선은 none/solid/dash/dot이다. 양 끝 자동 탭 여부는 모두 명시한다. 빈 목록은 명시적 사용자 탭만 지우며 구역 기본 탭 간격은 바꾸지 않는다. 변경 없는 요청은 거절한다.

기존 표·개체·필드·책갈피 제어·표식·혼합 글자 서식·실제 탭 문자가 포함된 대상은 읽기 전용이다. 미지원 고급 채움/위치/32개 초과/알 수 없는 탭 attr 비트·예약 바이트/추가 원본 데이터도 단순 설정으로 축소하지 않는다. 다른 문단에 있는 혼합 서식 등은 그대로 보존한다. 전체 한글 탭 동작·고급 채움·기존 실제 탭 문단 편집이 완료된 것은 아니다.

## 계층과 보호

Document Domain이 지원 범위·단위·위치·묶음을 검사한다. Snapshot의 `paragraphTabSources`는 읽기 가능한 지원 여부/이유만 전달하며 기존 구조의 문단 모양에서 현재 탭을 읽는다. Native BLAKE3 토큰·원본 레코드·인덱스는 모델로 보내지 않는다. 기존 DTO 구조와 명령 facade를 유지한다.

추적 Rust 패치 `zzzzzzzzzzzz-agent-paragraph-tabs.patch`의 `getAgentParagraphTabs`/`setAgentParagraphTabs`가 실제 원본 탭 정의와 문단·서식 토큰을 검증한다. 기존 구역/단 메타데이터의 빈 CTRL_DATA 슬롯(None)을 실제 payload와 구분하고 알려지지 않은 payload는 거절한다. setter는 기존 문단 서식 엔진을 사용하고 오류 시 자체 원본도 복원한다. Adapter는 전체 문서 보존 증거를 대조하여 의도한 세 탭 속성 외의 본문·다른 run/문단·구역·쪽·자산 변경을 거절한다.

사본 preflight·현재 형식 저장 보호·요청 snapshot undo/redo·전체 묶음 실패 복원·버전 충돌·안전한 저장·업무 복원은 기존 공통 경로를 사용한다. 사용자와 AI가 같은 문서를 사용하며 디스크 파일을 따로 수정하지 않는다. 비교 창에 mm 위치·정렬·채움선·자동 탭을 표시한다.

## 검사

단위·실제 WASM·격리된 Edge에서 양 형식, 네 제공자 합성 응답, 여러 문단 묶음·실패 복원·서식만 바뀐 동시 변경·저장/재실행을 검사한다. 실제 한글 2024 직접 비교와 유료 모델 호출은 미실행이다. 전체 잔여 범위는 완료되지 않았으며 자동화는 유지한다. 확정 검사와 실행 위치는 아래와 같다.

## 확정 검사와 실행

74번 최종 검사: 단위 557·provider/server 52·브라우저 464·실제 엔진 469 통과. 구현 `c677662`와 4272 검수본의 실제 앱 소스/WASM/공통 계약 해시를 대조했다. 문단별 사용자 탭 4정렬/4채움·자동 탭·32개 제한·여러 문단 묶음 1회 undo/redo·두 번째 적용 중 전체 복원·다른 본문 run/설정 보존·탭만 바뀐 동시 변경 충돌·양 형식 저장/재열기·직접 Tab 입력·업무 복원을 확인했다. 한글 비교용 전용 HWP/HWPX 29개를 준비했다. 실제 한글 직접 비교·유료 모델 품질·전체 한글 동등성은 미완료다.

실행: `build/jueony-agent-para-tabs-20261014/Start-Review.cmd` 또는 `http://127.0.0.1:4272/`. 이전 4270/4268 등 실행본과 사용자 문서는 유지한다. 네 제공자는 로컬 합성 응답으로 검사했으며 유료 호출은 하지 않았다.

검수 파일은 `build/jueony-agent-para-tabs-20261014/review-documents/agent-para-tabs/agent-para-tabs-native`와 `agent-para-tabs-browser`에 있다. `alignment-*`와 `leader-*`의 문단 모양 탭 설정, `cleared.*`의 명시 탭 지우기와 기본 간격 유지, `batch-*`의 서로 다른 문단 설정, `manual-tab-after-ai.hwpx`의 실제 Tab 입력/채움 렌더를 한글에서 확인한다. 비교는 아직 미실행이다. 파일별 해시는 [검수 목록](evidence/agent-para-tabs-2026-10-14/paragraph-tab-documents.json)을 따른다.

엔진: `source-8022002b6df8268e/pkg`(WSL review/no opt). 앱 소스 SHA-256 `f806c80ae69369227cdd3264b91ec32cae18ad388c403af4b7382057ba63f04e`, WASM SHA-256 `01191f3f5eb60f65cc38b66ac200d48bc05d3d54f433b66b746215e54bfe17ca`. [누적 결과](evidence/agent-para-tabs-2026-10-14/verification-summary.json), [실행 대조](evidence/agent-para-tabs-2026-10-14/launch-check.json)을 보관한다. 커밋 전 빌드를 같은 소스 해시로 검사했으므로 buildApplicationCommit 8431f5e/dirty=true 메타데이터와 구현 c677662를 구분한다. 모듈 9개·소스 252개의 경계 검사도 통과했다. 전체 문서화 범위는 미완료이며 자동화는 유지한다.
