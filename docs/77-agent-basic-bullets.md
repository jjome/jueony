# 77. 기본 문자 글머리표 생성과 번호 metadata 손실 보고

2026-10-14. `set_basic_bullet`를 제공자 중립 계약에 추가한다(37종). 기존 글머리표가 없는 문서에도 ●·○·■·□·◆·◇·▶·▷ 8종 중 하나의 새 기본 문자 글머리표 정의를 생성하고 현재 일반 본문 문단에 적용한다. □는 고정 문자이며 체크박스가 아니다.

```json
{"kind":"set_basic_bullet","target":"s0p0","character":"●"}
```

현재 본문과 `Snapshot.basicBulletSources[target].editable`이 모두 참이어야 한다. 단독 명령과 1회 undo이며, 새 정의는 요청마다 하나 추가한다. 기존 정의를 재생성하거나 공유 정의를 바꾸지 않는다. 현재 표시된 같은 문자는 no-op으로 거절해 기존 사용자 모양을 보존한다. 전체 저장 글머리표 정의는 200개까지다. 생성된 정의는 후속 문맥의 listCatalog에서 조회되어 기존 `set_paragraph_list`로 선택·해제할 수 있다.

## 경계와 보존

Domain은 대상·8종 문자·원본 가능성·no-op·단독 실행을 검사한다. Adapter는 원문/번호 상태/카탈로그를 다시 확인하고 비공개 Native 토큰으로 실행한다. 새 정의의 기대값을 앱에서 독립적으로 계산하여 전체 문서 보존 증거와 대조한다. Rust는 기존 일반 본문/탭/번호 원본 보호를 재사용한다. 새 Bullet 하나와 문단의 headType/참조/수준만 바꾸며 원본 공유 정의와 번호 모양 전체를 비교한다. 문단·글자·쪽 설정·다른 run·기존 자원·저장 restart는 유지한다.

기본 마커는 글자 모양 0, 자동 내어쓰기(attr 8), 너비 보정 0, 본문과 거리 저장값 50이다. 본문의 글자 모양 자체를 바꾸지 않는다. 사용자 지정 마커 글꼴·색·간격·그림·체크·개요와 번호 다시 시작은 이 명령에 없다. 필드/개체/표/실제 탭 문자/혼합 서식/개요/명시적 restart가 있는 대상은 보호한다. 반복 매크로와 자동 저장도 지원하지 않는다. 원본 토큰·Native 핸들·파일 경로는 모델에 보내지 않는다.

사본 preflight·현재 형식 저장 검사·실문서 snapshot·요청 undo/redo·실패 복원·문서 버전 충돌은 공통 경로를 사용한다. 모델이 디스크를 별도로 수정하지 않으며 사용자 직접 입력은 같은 열린 문서에 반영한다.

## 저장 결함과 손실 계약

기존 ensureDefaultBullet/ensureDefaultNumbering/createNumbering에서 새 자원 추가 시 DocInfo 원본 스트림을 무효화한다. 새 빈 HWP에서 미사용 자원이 캐시에 가려져 저장되지 않던 경우도 양 형식의 실제 재열기로 검사한다. 이 Native API 보정 자체를 새 사용자 지정 번호 모양의 Agent 기능 완료로 표시하지 않는다.

문단 번호 다시 시작은 현재 메모리 IR 값이며 파서와 양 저장기에 직접 연결된 표현이 없다. 임의의 쪽 번호 컨트롤이나 Jueony 전용 파일 확장으로 대체하지 않는다. 현재 직렬화기가 이 값을 담지 못할 때 `metadataReduced / paragraphProperties / serializerNotImplemented`와 실제 문단 경로를 보고한다. 형식 자체가 표현 불가능하다는 주장과 현재 구현 누락을 구분한다.

손실 스캔은 본문·중첩 셀·캡션·도형 글상자/그룹·머리말/꼬리말·각주/미주·숨은 설명·메모·바탕쪽을 명시적 stack으로 순회한다. Rust 검사는 본문/셀/머리말/바탕쪽의 정확한 위치, 평범한 문단의 오탐 없음, 100단계 중첩을 확인한다. 원본 내용은 수정하지 않는다.

Studio의 엄격한 보고서 DTO에 위 두 enum만 명시적으로 추가한다. 알 수 없는 항목/사유/버전과 잘못된 count는 계속 거절한다. Jueony는 손실을 허용해 저장하지 않으며 실제 파일 쓰기·복구본 생성 전 차단한다. 별도의 문단별 storedNumberingRestart 재열기 대조도 유지한다. 기존 76번의 count 0 누락 보고는 이 엔진에서 수정되지만 실제 restart 직렬화와 공개 Agent 명령은 아직 미구현이다.

한컴 도움말에서도 [문단 번호 목록의 이어짐/새 시작](https://help.hancom.com/hoffice100/en-US/Hwp/format/numberbullet/numberbullet%28paragraph_number%29.htm)과 [쪽·그림·표 등의 새 번호 지정](https://help.hancom.com/hoffice100/en-US/Hwp/format/new_number.htm)을 따로 설명한다. 이 구분을 근거로 쪽 번호 기능을 문단 번호 저장의 대체 수단으로 사용하지 않는다. 한글 2024의 실제 파일 표현·조판 동등성은 최종 직접 검수 대상이다.

## 현재 검증

단위 591·provider/server 52·신규 실제 WASM 26·신규 실제 Edge 15 통과. 별도 Rust 3개 통과(다른 library tests 3,883개는 필터로 미실행). 네 브라우저 adapter는 OpenAI Responses·Anthropic·Gemini·OpenAI compatible의 로컬 합성 응답이며 실제 유료 API를 호출하지 않는다. Rust 검사 컴파일에 필요한 고정 fixture 11개는 빌드 사본에만 보충하며 실행 묶음에 포함하지 않는다. 이전 추가 필드에 맞춰 두 ParaShape 테스트 초기화에 기본 suppress_line_numbers=false를 넣었으며 기존 assertion은 유지한다.

최종 누적 결과·실행 위치·파일 목록은 아래에 추가한다. 전체 문서화 범위는 미완료이며 자동화를 유지한다.
