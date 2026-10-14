# 103. 글상자 선택 복원과 세로 정렬 저장

2026-10-15. 환경 저장과 문서 저장의 책임을 분리해 보강했다. 선택·커서 복원은 Preferences 계약으로 처리하고 글상자 세로 정렬은 Rust 문서 직렬화에서 수정한다.

## 커서·선택 복원

`TextBoxBookmark`에는 본문 host 위치, 글상자 control, 내부 문단·Unicode 커서, 선택 anchor와 전체 story 지문을 저장한다. `modules/preferences/domain/textbox-bookmark.ts`가 저장 값의 형태를 검사하고 `adapters/rhwp/session-textbox.ts`가 현재 실제 원본과 경로·정체성·서식·문맥을 확인한다. 공통 Session adapter와 Studio cursor bridge에서 실행하며 채팅 포커스를 빼앗지 않는다.

현재는 본문 Rectangle 글상자의 단일 story다. 여러 내부 문단의 정방향·역방향 선택과 빈 문단 커서를 복원한다. 보호·회전·반전·그룹·중첩·캡션·내부 컨트롤·그림 채움과 불명확한 세로 정렬은 제외한다. 원문·서식·개체 정체성 또는 사용자의 위치가 바뀌면 저장된 위치를 그대로 적용하지 않는다. 복원으로 문서 바이트나 dirty 상태를 변경하지 않는다.

일반 facade의 viewport 복원 성공은 커서 성공과 같지 않다. 검사는 실제 커서·anchor·Native rect를 따로 비교한다. 실제 키보드 편집 후 dirty 문서와 글상자 위치가 저장소에 기록됐음을 확인한 뒤 재시작한다.

## 세로 정렬 직렬화

새 글상자의 의미상 위 정렬과 HWP의 기존 raw list attribute 정렬 비트가 어긋나 가운데 정렬로 재열리는 결함을 고쳤다. 저장 시 알려진 위·가운데·아래 정렬 비트만 의미 값과 동기화하고 다른 비트는 보존한다. 명시적인 setter도 두 표현을 함께 갱신한다.

예약 값 3은 단순 저장으로 해석하거나 덮어쓰지 않는다. getter가 `tbVerticalAlignKnown=false`를 반환하고 자동 커서 복원은 거절한다. 예약 값의 HWP→HWPX 표현 손실도 기존 보존 검사가 차단한다. 보호를 우회하지 않는다.

## 검사와 남은 범위

[Session 증거](evidence/session-textbox-2026-10-15/)는 단위 8·실제 Native 8·Edge 8 시나리오를 통과했다. HWP/HWPX 커서·선택, 탭·workspace 재시작, 실제 키보드 미저장 복원과 포커스 유지, 오래된 대상·불명확한 경로 거절을 확인했다. 정렬 저장의 Native 14 시나리오와 공개 자료 24개 변환 검사는 [통합 증거](104-parallel-editor-integration.md)에 별도로 기록한다.

한글 직접 비교는 남아 있다. 일반 shape 전체, 그룹·표 안 글상자·회전·캡션 story를 모두 지원하는 것은 아니므로 `N014` 전체는 부분 구현으로 유지한다.
