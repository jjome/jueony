# 79. 새 기본 숫자 번호 모양 생성

2026-10-14. `set_basic_numbering`을 공통 제공자 중립 계약에 추가한다(39종). 현재 문서에 복제 가능한 번호 모양이 없어도 새 독립 정의를 만들고 일반 본문 한 문단에 적용한다. 기존 원본 정의를 축소하거나 덮어쓰지 않는다. 78번의 기존 정규 모양 복제 기능과 별개다.

```json
{"kind":"set_basic_numbering","target":"s0p0","pattern":"parenthesized","level":0,"startNumber":3}
```

고정 숫자 패턴은 `decimal`(1.), `parenthesized`((1)), `closing_parenthesis`(1)) 세 종류다. 전체 7수준에 같은 구두점 형식을 사용한다. 수준은 0~6, 시작 값은 1~65535 정수이며 선택한 수준만 지정값, 다른 수준은 1로 생성한다. 수준 0에서는 정의의 전체 시작 값도 지정값으로 생성한다. 글자 모양 0·자동 내어쓰기(attr 8)·너비 보정 0·본문 거리 저장값 50·숫자 형식 코드 0이 기본값이다. 본문 글꼴/문단 여백 자체는 바꾸지 않는다.

새 ID는 다음 Snapshot.listCatalog에서 조회해 기존 set_paragraph_list로 다른 문단에 선택하면 목록을 이어갈 수 있다. 표시상 같은 번호 형식이어도 새 독립 목록을 만드는 실제 변경이다. 한 번에 새 정의 하나와 문단 하나만 적용하며 요청 단위 undo/redo를 사용한다.

## 보존과 경계

Snapshot.basicNumberingSources[target]과 본문 editable이 참이어야 한다. Native는 기존 getAgentParagraphList 토큰으로 원문·서식·번호 자원을 검증하고 새 정의를 추가한다. 전체 정의 200개 한도에 미지원 기존 정의도 포함한다. 공유 원본 prefix와 글머리표를 변경하지 않고 DocInfo dirty를 표시한다. Native 실패는 문서/이벤트 snapshot으로 복원한다.

Domain은 고정 패턴·수준·시작 값·단독 명령을 검사한다. Adapter는 원문/번호/카탈로그를 다시 읽고 새 정의의 모든 필드와 문단 참조를 독립적으로 계산하여 전체 보존 증거를 대조한다. 토큰·Native 핸들·파일 경로는 모델에 보내지 않는다. 공통 사본 preflight·실문서 rollback·현재 형식 저장/재열기·버전 충돌·undo/redo를 사용한다. 사용자의 직접 입력은 같은 열린 문서에서 이어진다.

개요·명시적 문단 restart·필드/개체/표·점 책갈피·실제 탭·혼합 글자 서식 등 기존 본문 보호를 유지한다. 임의 번호 형식/사용자 마커 글꼴·색·거리·체크·그림·매크로·자동 저장은 지원하지 않는다. 메모리 문단 numbering_restart를 쓰는 기능이 아니며, 77번의 실제 손실 보고와 저장/복구 차단도 유지한다.

기존 빈 HWP의 확장 번호 원본은 여전히 복제할 수 없지만, 이번에는 그 정의를 그대로 남기고 새 기본 정의만 추가해 직접 HWP 저장/재열기를 검사한다. 원본 보호 검사를 느슨하게 하지 않는다. HWPX 합성 입력으로 정규화해야만 성공했던 78번의 fixture 조건을 이번 HWP 생성 검증에 사용하지 않는다. 8~10수준과 기존 확장 정의 복제·문단별 restart 직렬화·개요·전체 한글 호환성은 남는다.

## 검수본

`build/jueony-agent-basic-numbering-20261014/Start-Review.cmd` 또는 `http://127.0.0.1:4282/`로 준비한다. 이전 실행 창·서버·사용자 문서를 유지한다. 한글에서 열 검수 파일은 묶음의 review-documents/agent-basic-numbering에 포함한다. 실제 한글 2024 직접 비교와 유료 모델 호출은 수행하지 않으며 전체 구현은 미완료다. 최종 검사 범위·수치·소스 해시는 아래에 추가한다.

## 최종 결과

구현 `d35531b` 커밋·푸시 완료. 전체 단위 611·provider/server 52·관련 실제 WASM 131·브라우저 60(묶음 호환 4 포함) 통과. 신규 WASM 25·신규 Edge 14와 기존 번호 복제/목록/기본 글머리표·문단 탭/테두리의 관련 회귀 범위다. 직전 전체 편집기 누적 538/508을 이번에 모두 재실행한 것으로 계산하지 않는다. TypeScript와 9개 모듈·262개 소스의 경계 검사 통과. 예상 밖 page/console 오류와 외부 자산 요청 0건이며, 이전 글머리표의 의도한 손실 저장 차단 2건은 expectedSaveErrors로 구분한다. 별도 Native Rust unit tests는 이번 빌드에서 미실행이다. [검사별 결과](evidence/agent-basic-numbering-2026-10-14/verification-summary.json)를 따른다.

직접 빈 HWP 원본에서 확장 정의를 유지하고 새 기본 번호 3종을 생성/적용/저장했다. 양 형식의 수준 0/3/6, 새 목록 23/24 이어짐·공유 원본 유지·요청 undo/redo·실문서 실패 복원·위조 반환/토큰·동시 편집·수동 입력·업무 복원을 확인했다. 단위 검사에서는 전체 0~6수준과 입력 범위 경계를 검사한다. 유료 모델 성능이나 실제 한글 지면 동등성은 판정하지 않았다.

앱 소스 SHA-256 `7544d9cb69d10bd20cf3d8189e10629a5ab1f92d37a008292dae14813556ca0a`, 엔진 `bb2a4db1f6f1988f`, WASM SHA-256 `c5e0296d2c9e0b493bdeb01b338bc5596dae2b6da039ed6eb4e0b0a8a175f497`. 빌드 메타데이터 7c4b7c2/dirty=true는 구현 d35531b의 실제 소스/추적 패치 해시로 연결한다. 4282 검수 서버의 served 메타데이터·WASM 바이트·포함 명령/provider 계약을 대조했다. [실행 대조](evidence/agent-basic-numbering-2026-10-14/launch-check.json)와 [원본·지원 범위](evidence/agent-basic-numbering-2026-10-14/source-baseline-notes.json)를 보관한다.

한글에서 열 새 합성 HWP/HWPX 30개를 review-documents/agent-basic-numbering에 포함했다. `created-<pattern>-<level>.*`는 3종×3수준×2형식, `continued-sequence.*`는 새 목록 이어짐, `created-<adapter>.hwpx`는 네 합성 제공자, `default-<pattern>.hwp`는 직접 HWP 기본 패턴, `manual-created.hwpx`는 사용자 추가 편집 결과다. [파일별 해시](evidence/agent-basic-numbering-2026-10-14/basic-numbering-documents.json)를 따른다. 기존 확장 모양 복제·임의 번호 모양·문단별 restart 저장·개요와 최종 한글 직접 비교는 남는다. 전체 구현이 완료되지 않아 자동화를 유지한다.
