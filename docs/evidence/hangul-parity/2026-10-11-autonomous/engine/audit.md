# 엔진·파일 저장 감사와 첫 보강

2026-10-11. 기준 Jueony commit `e53e3e47546e81b9efad36d030627175c7108372`, 고정 rhwp reference `1a76570e833917d15817415a53c09ad61ab3203f`, 설치 WASM `@rhwp/core@0.8.7`. 실제 한글 편집기 비교는 **BLOCKED_REFERENCE**다. 아래 결과는 정적 코드 확인과 동일 엔진의 내용/구조 검사이며 한글 2024 전체 기능·레이아웃 일치 판정이 아니다.

## 재사용 경계

[엔진 분류 24행](engine-capabilities.csv)은 설치된 `apps/editor/node_modules/@rhwp/core/rhwp.d.ts`, Jueony `document-control/{structure,operations,execute}.ts`, `mvp/editor-bridge.ts`, upstream Studio 저장 코드를 대조했다. 한글 전체 기능 목록의 대체물이 아니다. 이름이 있는 엔진 메서드도 실제 입력·undo·저장·한글 출력 검증 전까지 완성 기능으로 올리지 않는다.

본문, 글자/문단, 단순 표/셀, 용지/여백은 현재 공통 명령에 연결되어 있다. 표 병합/분할, 머리말/꼬리말, 각주/미주, 그림/도형/글상자/수식/차트/그룹/캡션 등은 상당수 엔진 API가 있어 재구현보다 명령·대상·검증 계층 연결이 먼저다. 이 범위 전체가 AI에서 작동한다는 뜻은 아니다. 특수 개체는 원본 보존을 따로 측정해야 하며, 변경 추적/서명 등은 완전한 흐름을 확인하지 못했다.

## 발견한 저장·복구 차이

1. 재시작 복구는 원본 handle을 버리고 다시 저장할 위치를 묻는다. `SavedDocument.bytes`는 dirty 상태의 최신 문서이므로 원본 디스크 fingerprint로 재사용할 수 없다. 마지막에 읽거나 저장한 디스크 hash와 handle을 별도로 보존해야 한다.
2. `editor-bridge.recovery()`는 손실 보고 없는 export 메서드를 호출했다. 복구 직렬화에서 지원하지 않는 개체를 잃더라도 기존 좋은 복구본을 덮어쓸 수 있다. shared bridge 통합 담당에게 `export*WithReport` 재사용, count > 0이면 저장 중단·이전 복구본 보존·경고를 요청했다. 이번 공개 표본에 실제 loss > 0 사례는 없어 해당 경로는 합성 오류 주입과 후속 실물 표본으로 검증해야 한다.
3. 원본 저장에는 이미 revision 확인, 저장 중 입력 잠금, 외부 파일 SHA-256 비교, write/close 실패 시 abort가 있다. Rust `storage.rs`도 임시 파일 후 교체 및 외부 변경 비교를 구현한다. 이를 별도로 재작성하지 않는다.
4. 다운로드는 디스크 쓰기 완료를 확인하는 브라우저 API가 없어 사용자의 저장 확인 전까지 문서를 보존하는 기존 동작을 유지한다. 자동 저장 완료로 표시하면 안 된다.
5. 기존 검사 중 하나는 같은 엔진에서 저장 전후 텍스트가 같아도 `contentLoss.count`를 성공 판정에 넣지 않았다. 새 공개 표본 하네스는 내용/본문/표/개체 종류와 손실 보고를 함께 판정한다. 같은 엔진 검사는 독립 한글 검사가 아니다.

## 구현한 원본 파일 연결 모듈

- `apps/editor/src/file-connection.ts`: `captureFileConnection(handle)`은 동기 함수로 원본 fingerprint와 structured clone 가능한 파일 handle을 반환한다. 함수로 만든 Tauri emulation handle은 제외하여 IndexedDB 전체 기록 실패를 피한다.
- `restoreFileConnection(connection, { requestPermission? })`: 자동 복원에서는 `queryPermission({mode:'readwrite'})`만 호출한다. 명시 클릭에서만 requestPermission을 허용한다. 권한 승인 후 현재 디스크 hash가 보존한 값과 일치할 때만 `connected`로 반환한다. 변경/접근 불가/파일 삭제는 복구 문서를 변경하지 않는다.
- `save-guard.ts`: 마지막 디스크 fingerprint 조회와 검증된 handle 재등록을 추가했다. dirty 복구 bytes를 디스크 기준으로 잘못 등록하지 않는다. 재연결 뒤 발생한 외부 수정도 기존 저장 가드가 거부한다.
- 통합 담당은 shared bridge에서 반환한 handle만 현재 문서에 연결하고, 비동기 검사 중 다른 문서를 열었는지 확인해야 한다. shell은 실패한 연결 정보를 보존해 명시 클릭에서 재시도한다. 저장 형식을 바꾸거나 다른 이름 저장을 하면 현재 handle과 그 새 디스크 hash를 캡처한다.

## 실행 결과

명령:

```powershell
node --experimental-strip-types --test apps/editor/tests/save-guard.test.ts apps/editor/tests/file-connection.test.ts apps/editor/tests/document-roundtrip.test.ts apps/editor/tests/document-control.test.ts apps/editor/tests/agent-commands.test.ts
node --experimental-strip-types docs/evidence/hangul-parity/2026-10-11-autonomous/engine/corpus-probe.mjs
```

[단위/엔진 검사](engine-and-save-tests.txt): **36개 통과**, 실패/건너뜀 없음. 신규 원본 연결 10개, 기존 저장 보호/본문/표/문서 명령 회귀 포함. 자동 권한 요청 없음, dirty 복구와 디스크 기준 분리, 권한 취소, 외부 수정, 삭제, 저장 형식 변경, 복원 이후 외부 수정이 포함된다.

[공개 표본 결과](public-corpus-report.json): 기존 다운로드된 5개 원본 hash 확인 후 HWP/HWPX 10개를 생성·재열기했다. **4개 PASS_CONTENT_ONLY, 1개 REVIEW_REQUIRED**다. `python-hwpx-1`의 HWP 변환에서 기존 끝 본문 문단 차이가 다시 나타났으며, HWPX에서는 내용이 일치했다. 모든 export 손실 보고 count는 0이었다. 이 결과는 손실 보고만으로 모든 구조 차이를 검출할 수 없다는 점도 보여 준다.

비병합 표본 `python-hwpx-3`에서 단순 셀을 수정한 뒤 HWP/HWPX 재열기 시 변경 셀 내용과 snapshot undo 복원을 검사했다. 나머지는 비병합 표 편집 조건을 만족하지 않아 편집 검사를 수행한 것으로 기록하지 않았다.

`generated/`의 무수정 10개와 편집 2개 저장물을 실제 한글에서 열어 쪽 수, 표 쪽 넘김, 수식/개체, 글꼴·줄바꿈을 비교할 수 있다. 파일명/hash는 JSON에 있다. 공개 원본 및 파생 저장물은 저장소 배포에 포함하지 않도록 `generated/`를 Git에서 제외했다. 하네스·결과 메타데이터만 추적한다.

## 남은 검수

- 새 원본 연결 기능의 실제 브라우저 권한·IndexedDB·재시작·저장 통합은 통합 담당 결과를 별도로 연결한다. Node 모의 handle 성공을 실제 브라우저 통과로 보고하지 않는다.
- 실제 한글 2024 원본/저장본 대조와 기준 PDF 출력이 필요하다. 현재 설치된 뷰어는 편집·환경 상태 기준을 대신할 수 없다.
- 손실 보고가 발생하는 복잡 개체, 암호/서명/변경 추적, 병합·중첩 표, 원본 이동/삭제, 읽기 전용, 강제 종료/디스크 오류 표본을 추가한다.
- 저장 트랜잭션의 실제 디스크 원자성은 Node 모의 write 검증 범위가 아니다. Rust 네이티브 경로와 브라우저 File System Access를 분리하여 검수한다.