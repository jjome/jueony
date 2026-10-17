# 파일·저장·복구·형식 보존: 최종 합본 검수

| 판정 | 결과 |
| --- | --- |
| 전체 파트 | **아직 완료 아님** — 확인된 저장 결함 수정과 미지원 저장 차단을 반영했지만, 아래 호환성·실제 Windows 검수가 남음 |
| 같은 최종 빌드 | unit933/933·skip0, 직접WASM27군·Edge17군, 파일/복구133사례, TypeScript·모듈 경계 통과 |
| 공개 형식 변환 | 7개 형식 조합은 실제 엄격 저장·재열기, 3개 조합은 미지원 textDir 손실을 독립 원본 XML과 대조해 **쓰기 전 거절** |
| 지면 보호 | 모든 공개 배치 필드·원래 의미 비교·좌표0.2·한도·source alias 검사 유지 |
| 실행 | 저장소 상단의 `Start-Jueony-FileReview.cmd`, 또는 `build/jueony-file-review86/JueonyEditor.exe` |
| 근거 | [최종 빌드와 검사 보고서](evidence/file-completion-2026-10-18/engine86/README.md) |

## 이번에 수정한 결함

| 결함 | 구현과 검수 범위 |
| --- | --- |
| GulimChe TTF 줄 수용 | 실제 측정으로 확인한 정수 advance 계약만 사용. 136개 경계·30개 글자 측정, 서식·폰트 권한 음성 유지 |
| 잘못된 XML 저장 | 원시 번호/글머리표 fragment와 namespace owner를 함께 보존. prefix shadow/default/collision·없는 소유권 거절, 생성 XML 검사와 외부 Python XML 재검사 |
| 표의 원점과 편집 수명 | XML 재구성의 페이지 기준 소유와 versioned XML-cache의 편집 수명 수정. 4px 이동과 원격 편집 후187개 배치 차이를 분리해 해결 |
| 새 3단 문서 저장 | 실제 단 폭·원점·전체 synthetic line 소유를 확인한 경우만 저장. 기존37개 차이→0, 기존 위장3단 등 음성6개 불변 |
| 글 방향 정보 소실 | XML의 LTR/RTL/AUTO·알 수 없는 원문을 유지. 검증된 HWP5 대응이 없는 명시 값의 HWP 변환은 손실 보고 후 차단 |
| 폰트 유형 승격 | 표준 REP를 TTF로 바꾸지 않음. 알 수 없거나 누락된 font/substitute 유형은 권한 추측 대신 명시 손실·저장 거절 |
| 머리말·각주 커서 회귀 | 새 provenance가 v1 의미 지문에 섞이지 않게 읽기 DTO 경계를 보강. 증명된 TTF/HFT만 기존 의미와 동등; REP·unknown·missing·불일치·실제 서식 변경은 계속 구별 |
| 오류 안내 | HWP 글 방향 변환 거절 시 HWPX 보존 검사를 안내. 원문 글꼴 이름·payload를 오류에 노출하지 않음 |

## 검사 방법과 원형 실패의 보존

1. 핀된 소스에 추적 patch를 strict 적용하고 최종 WASM을 새로 컴파일했다. 엔진 **`b59322fd380dc175`**, WASM **`ef130c08536b38349bfb0c9b94a4478094c85df04ba2969ef4e4f65d05363f17`**. 후보 Native 검사와 최종 WASM·화면 검사는 구분한다.
2. 현재 열린 상태의 실제 엔진 명령·Undo/Redo·HWP/HWPX export를 사용하고 사본을 재열어 의미와 공개 지면 전체를 대조했다. 비교기나 보호 한도를 바꾸지 않았다.
3. 별도 Python ZIP CRC·ElementTree로 저장 XML을 읽었다. 동일 엔진이 잘못된 XML을 다시 읽고 통과하는 순환 검수만 사용하지 않았다.
4. 실제 Edge의 격리 프로필에서 파일·저장·복구 화면과 Native IPC 계약을 검사했다. **실제 OS 파일 선택창·한글 창 검수와는 다르다.**
5. 85 합본에서 발견한 unit2 회귀와 초기 하니스 실패·기존 원형 변환 실패를 보존했다. 기존29 범위의4개 군은 명시LTR188개의 HWP 매핑 미지원으로 원래의 성공 조건을 충족하지 못한다. 이 실패를 지원 성공으로 바꾸지 않았다.
6. 공개 변환 검수 계약을 수정한3개 음성은 원본 XML의 자원 경로·손실 개수·사유를 정확 대조하고 문서 쓰기0·원본/열린 상태 불변을 요구한다. 따라서 최종27군 통과가 모든 공개 문서의 HWP 변환 지원을 의미하지 않는다.

## 완료를 막는 나머지

| 항목 | 현재 상태 | 다음 완료 조건 |
| --- | --- | --- |
| 명시 textDir의 HWP5 매핑 | AUTO/LTR/RTL이 있는 HWPX→HWP는 안전한 보존을 증명하지 못해 거절. 동일 HWPX 저장은 별도 검증 | 실제 한글 통제 문서로 바이너리 대응을 확인하거나 표현 불가 범위를 제품 계약으로 확정 |
| 원 공개 MCST 초기 조판 | 원본15쪽과 실제 한글16쪽 차이. p60의3→4행과 이후 페이지 이동 확인. 휴먼명조의 U+2219 fallback 실제 선택은 미확정 | 실제 선택된 폰트·glyph fallback과 새 줄 수용의 독립 통제 검수, 다른 공개 문서에 대한 회귀 |
| Python3 초기 호환성 | 직접 한글 oracle의 줄·charX 차이92를 아직 전체 해소하지 못함 | 원본·실제 한글·최종 엔진의 원인별 동일성 검수 |
| 최신 Windows·한글 합본 | 현재 컴퓨터 사용 도구의 `failed to activate captured window` 때문에 새 창 조작 비교를 완료하지 못함 | 최종86 native 실행본의 실제 파일 선택·편집·저장·종료·복구와 실제 한글 재열기 |

이전 실제 한글83의 재저장·닫기·디스크 재열기16쪽, 요약5필드와 각주/미주 원본 속성 검수는 그대로 보존한다. 최신 엔진의 실제 한글 검사로 소급하지 않는다. Native68의 일부 저장 모듈은 현재와 같지만 main/window binding은 변경되어, 최신 OS 검수 전체를 대신하지 않는다. [직전 실제 한글 검수](110-file-preservation-integration.md).

## 실행과 재현

기존 창·서버·사용자 문서를 바꾸지 않도록 별도 **4355** 포트의 새 실행 묶음을 준비했다. 기존 브라우저 origin의 업무 상태를 이 새 origin에 자동 이관하지 않는다. 동일 원본 대신 사본을 열어 확인한다. Native 전용 `build/native-file-final86-20261018/JueonyNativeFinal86Review.exe`는 별도 파일 저장 검수용이며 API backend를 포함하지 않는다. 새 실행 묶음의 HTTP·화면/WASM 바이트·보호 검사7개를 통과했으며, Native 실행본은 빌드만 확인했다.

빌드에는 PowerShell 7(`pwsh`)과 기존 저장소의 고정 Rust/Node 빌드 도구가 필요하다.

```powershell
# 엔진과 최종 화면을 다시 만들 때
pwsh -File scripts/Build-DocumentEngine.ps1 -Runtime Wsl
$env:JUEONY_ENGINE_PACKAGE = '<출력된 절대 pkg 경로>'
$env:JUEONY_BUILD_PROFILE = 'file-closure-check86'
node apps/editor/scripts/build.mjs
pwsh -File scripts/Build-Standalone.ps1 -OutputName jueony-file-review86 -FrontendProfile file-closure-check86 -ReviewPort 4355
```

최종 검수의 절대 환경·검수기 SHA·실행 결과와 한계는 근거 manifest에 연결한다. 공개 원문/변환본 전체, 폰트 프로그램, API 키, 브라우저 프로필, EXE/WASM은 Git 증거에 포함하지 않는다.
