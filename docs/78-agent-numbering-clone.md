# 78. 기존 기본 번호 모양 복제와 새 목록 시작 값

2026-10-14. `clone_paragraph_numbering`을 제공자 중립 공통 계약에 추가한다(38종). 조회된 기본 번호 정의를 복제하여 새 독립 목록을 만들고 일반 본문 한 문단에 적용한다. 원본 공유 정의와 다른 문단의 참조는 바꾸지 않는다.

```json
{"kind":"clone_paragraph_numbering","target":"s0p0","sourceDefinitionId":1,"level":0,"startNumber":3}
```

`level`은 0~6(표시 수준 1~7), 시작 값은 1~65535 정수다. 선택한 수준의 형식이 비어 있으면 거절한다. 새 정의의 해당 수준 시작 값만 변경하고 다른 수준과 번호 형식·머리 글자 모양·정렬·너비·거리 속성은 유지한다. 수준 0에서는 정의의 전체 시작 값도 함께 변경한다. 새 ID는 후속 Snapshot.listCatalog에서 조회하고 기존 `set_paragraph_list`로 다른 문단에 적용하여 새 목록을 이어갈 수 있다. 기존 정의의 시작 값과 같아도 독립 목록 생성은 실제 변경이다.

## 계약과 보호

Domain은 현재 본문·paragraphListSources·numberingDefinitionSources·카탈로그 ID·수준·시작 값을 확인한다. Native의 새 읽기 API는 정의별 editable/reason과 7수준 시작 값을 내보낸다. 토큰·핸들·파일 경로는 모델에 보내지 않는다. 원본 번호 정의 200개 한도는 읽기 전용 자원도 포함한다.

Adapter는 현재 본문/번호/카탈로그를 다시 읽고 원본 비공개 토큰으로 실행한다. 전체 문서 보존 증거에서 기대하는 새 Numbering과 문단 참조를 독립적으로 계산한다. Rust는 문서/이벤트 snapshot으로 자원 생성과 문단 적용을 원자 처리하며 기존 자원 prefix·글머리표·대상 속성을 검사한다. DocInfo dirty를 표시한다. 실패·잘못된 반환·요청 밖 자원/다른 run 변경은 앱의 공통 preflight와 snapshot 복원 경로로 처리한다. 요청 단위 undo/redo, 버전 충돌, 저장 재열기 보호는 유지한다.

이번 명령은 단독 1명령·1회 undo다. 매크로/반복/자동 저장을 허용하지 않는다. 개요·명시적 문단 restart·필드/개체/표·점 책갈피·실제 탭·혼합 글자 서식 등 기존 본문 보호는 유지한다. 문단의 `numbering_restart`를 작성하지 않는다. 77번의 serializerNotImplemented 손실 보고와 저장/복구 차단도 유지한다.

## 원본 모양의 실제 지원 범위

양 형식의 **현재 직렬화기가 완전히 재생성할 수 있는 정규 정의**만 복제한다. HWP 번호 raw record는 기본 writer의 재생성 바이트와 같아야 하고, HWPX raw paraHead 영역은 현재 writer가 생성하는 정규 영역과 같아야 한다. 검사 뒤 새 정의만 raw cache를 비운다. 원본 정의는 byte raw와 공유 참조를 유지한다.

이 조건은 엄격하다. 저장소의 기존 빈 HWP에도 모델에 없는 확장 원본이 들어 있어 해당 원본 정의의 복제를 거절한다. HWPX의 추가 속성·독립적인 확장 수준과 lexical 차이도 거절할 수 있다. 오류를 없애기 위해 원본을 기본 모양으로 축소하지 않는다. 이는 HWP/HWPX 모든 번호 모양 지원이나 한글의 ‘새 번호로 시작’ 대화상자 완전 구현을 의미하지 않는다. 현재 모델에 없는 8~10수준·그림/체크 번호·사용자 새 모양은 후속 범위다.

양 형식의 성공 사례는 직접 만든 정규 정의를 HWPX로 구성한 뒤 HWP/HWPX로 저장하고 실제 엔진에서 다시 연 합성 파일이다. 별도로 원본 빈 HWP·추가 속성/확장 수준/공백을 포함한 HWPX의 안전한 거절과 바이트 보존도 검사한다. 성공 사례를 실제 한글 호환성 승인으로 환산하지 않는다.

## 검증과 다음 작업

신규 단위 10개·실제 WASM 17개·실제 Edge 13개를 검사한다. 네 제공자 프로토콜은 OpenAI Responses·Anthropic Messages·Gemini·OpenAI compatible의 로컬 합성 응답이며 유료 API 호출이 아니다. 시작 값/수준·후속 이어짐·원본 공유 정의·사용자 지정 기존 형식·원본 보호·위조 반환/토큰·실문서 실패 복원·동시 편집·수동 입력·저장/재열기·업무 복원을 확인한다. 전체 단위/제공자 검사와 관련 번호/글머리표/문단 회귀의 최종 수치는 검수본 준비 후 추가한다.

실행 묶음은 `build/jueony-agent-numbering-20261014/Start-Review.cmd`, 주소는 `http://127.0.0.1:4280/`으로 준비한다. 이전 검수 서버와 사용자 문서는 유지한다. 새 합성 검수 파일은 `review-documents/agent-numbering/agent-numbering-native` 및 `agent-numbering-browser`에 포함한다.

다음은 확장 원본을 보존하는 번호 정의 복제, 실제 한컴 표현에 근거한 문단 restart 저장, 사용자 지정 모양·개요와 최종 한글 직접 검수다. 전체 범위는 미완료이며 자동화를 유지한다.

## 최종 검수본

구현 `8834003`을 커밋·푸시했다. 전체 단위 601·provider/server 52·관련 실제 WASM 106·브라우저 46(검수 묶음 호환 4 포함) 통과. 신규 번호 검사 17/13과 기존 번호·글머리표·문단 탭·테두리의 관련 회귀를 같은 최종 엔진/앱에서 검사했다. 이 수치는 77번의 전체 편집기 누적 검사 538/508을 이번에 모두 재실행했다는 뜻이 아니다. [검사별 범위](evidence/agent-numbering-2026-10-14/verification-summary.json)를 따른다. TypeScript와 9개 모듈·260개 소스 경계 검사 통과, 예상 밖 page/console 오류와 외부 자산 요청 0. 기존 글머리표 저장 차단 2건은 별도 expectedSaveErrors다. 별도 Native Rust unit tests는 이번 빌드에서 실행하지 않았다.

새 검수본 4280의 실제 served 소스/WASM·공통 명령/provider 계약과 묶음 호환을 대조했다. 앱 소스 SHA-256 `9175892703576f4748107f252e1c46ba7ee6082820bd6bd8666e97a507cce0a5`, 엔진 `3a5a68936f7c43e7`, WASM SHA-256 `52884acc0ec4e779f34febe0ba2ccf9a4c64bc781c49be402e67b490a4912713`. 빌드의 Git 메타데이터는 3b654e4/dirty=true이며 구현 8834003의 실제 앱 소스와 추적 패치 해시로 연결한다. [실행 대조](evidence/agent-numbering-2026-10-14/launch-check.json), [원본/합성 범위](evidence/agent-numbering-2026-10-14/source-baseline-notes.json)를 보관한다.

새 검수 HWP/HWPX 17개를 실행 묶음의 review-documents/agent-numbering에 포함했다. `cloned-level-*`는 수준 0/1/6, `continued-sequence.*`는 시작 23과 후속 24, `retained-custom-shape.*`는 기존 사용자 형식의 유지, `created-*`는 네 합성 provider, `manual-created.hwpx`는 사용자 직접 입력 결과다. [파일 해시 목록](evidence/agent-numbering-2026-10-14/numbering-documents.json)으로 식별한다. 실제 한글 직접 재열기·유료 모델 품질·확장 번호와 문단 restart 및 전체 기능 구현은 미완료다. 자동화를 유지한다.
