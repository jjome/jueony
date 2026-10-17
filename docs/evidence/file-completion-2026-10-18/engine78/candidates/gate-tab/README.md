# 문서 전체 저장 배치 보호 및 탭 간격 근거 (공식76/77, 후보 v2)

공식76/77의 결과를 보존한 중간 증거입니다. 최종 합본78 검수는 아직 수행하지 않았습니다. MCST의 HWP 변환 지면 손상은 수정 완료로 간주하지 않으며, 실제 차이를 그대로 검출해 디스크 쓰기 이전에 거절합니다. 일반 지원 문서의 동일 엔진 저장·재열기 검수와 실제 한글 지면 동등성은 구분합니다.

- 전체 공개 control/text 응답, 쪽수, 배열 순서 및 필드를 보존합니다. 확인된 사각형/charX 경로에만 최대0.2를 적용하고 다른 값은 정확 비교합니다. 원시 글자/문단 ID를 삭제하거나 반올림하지 않습니다.
- 객체 응답 alias, 첫 semantic reopen부터 모든 단계의 source alias, 알 수 없는 nested x를 좌표로 오인하는 경계를 보강했습니다. 최초 리뷰는 실제로3시나리오이며, 수정 리뷰는 direct/borrow alias를 분리해4개입니다.
- 최종 중간 단위36 중35PASS/1FAIL은 실제 caption0→1 결함입니다. 실패를 skip하거나 완화하지 않았으며 별도 엔진 수정 후 다시 검사해야 합니다.
- 탭 후보 v1의 기존 재조판 호출만으로는 원점이 갱신되지 않았습니다. v2는 missing/placeholder tab의 실제 spacingBefore/After 변경에만 기존 semantic vpos 경계 생명주기를 연결합니다. 이전 flow end와 저장 reset을 보존하며 수동 위치 clamp/정규화는 하지 않습니다. Native5/5PASS, 정식77 WASM 기준 반례는1PASS/3FAIL로 남아 있습니다.

원본 MCST 문서/파생 파일, 전체 문서 snapshot, PDF, 글꼴, WASM/exe는 포함하지 않습니다. 설치/공개 자료에서 복사한 본문도 포함하지 않습니다. Native 테스트 하니스와 자체 합성 문자열만 보관합니다. 큰 JSON/TAP는 원본 바이트 gzip이며 manifest에 원본·압축 SHA를 각각 기록했습니다.

재현: Node22에서 `--experimental-strip-types`와 추적 저장소의 scripts를 사용합니다. JUEONY_ENGINE_PACKAGE, JUEONY_REPOSITORY, JUEONY_TEST_OUTPUT은 모두 절대경로로 설정합니다. 전용 gate/MCST/tab 검수기는 각 output/result.json을 생성합니다. TS 명령은 `tsc --noEmit --target es2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --skipLibCheck --strict src/adapters/rhwp/document-save-layout.ts src/adapters/rhwp/preservation.ts`입니다. Native 후보는 run-candidate-v2.sh와 exact5 test name/count 로그로 재현합니다. immutable engine/upstream은 변경하지 않습니다.
