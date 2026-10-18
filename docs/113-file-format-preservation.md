# 파일 형식 보존 결함 수정

2026-10-18. 파일·저장·복구·형식 보존 파트만 수정했다. 한글 직접 비교는 사용자 요청에 따라 보류한다.

| 결함 | 수정 | 자동 검증 |
| --- | --- | --- |
| 속성·자기닫힘·다른 접두사의 HWPX metadata 누락 | 실제 OPF namespace와 직접 부모를 확인하고 원문 블록 보존 | 독립 ZIP·실제 WASM14사례에 포함 |
| 상속한 namespace가 사라져 정상 문서 저장 거절 | 원래 XML namespace 소유를 보존하고 fragment에 필요한 선언을 함께 기록 | alias·default·확장 namespace·foreign 재정의 확인 |
| 문서 정보 조회·수정이 특정 접두사만 허용 | namespace 기반 읽기, 원래 QName·속성·알 수 없는 내용은 유지하며 다섯 속성 수정 | 본문 수정·2회 저장·속성 수정·3번째 저장/재열기 |
| package 식별자·버전·확장 속성 소실 | 원본 id·unique-identifier·version·xml:lang·확장 속성 보존 | 식별자와 메타데이터 참조 유지 확인 |
| 작은따옴표·여러 줄·명시 닫힘 Script manifest 누락 | 원래 item과 Script 참조의 속성·상호 순서를 보존하고 없는 참조를 만들지 않음 | script bytes·참조 유무·linear/properties 확인; script 실행 안 함 |
| namespace 복제에 의한 메모리 증폭 | 선언4MiB·누적 fragment32MiB를 복제 전에 검사 | production writer 격리 Rust21사례에 포함 |

내보내기만 고친 중간 엔진에서는12사례 중6개가 문서 정보 읽기에 막혔다. 읽기·쓰기 양쪽을 연결한 최종 엔진은 확대된14사례 전부 통과했다. 원래 고정86과 최종91의14사례는 **같은 verifier로0/14→14/14**를 재현했다. 보호 검사를 생략하거나 허용 오차를 늘리지 않았다.

## 통합 검증

- 엔진: `build/rhwp-engine/source-f339aba305da3aa9/pkg`,98패치의 새 WASM release 빌드.
- 프런트: `apps/editor/evidence/dist-file-preservation91`.
- 단위:970/970, 건너뜀0. TypeScript 통과.
- 같은 프런트의 파일·저장·복구14군:163/163. 각 검증기의 SHA와 실제 engine/build SHA를 확인했다.
- Rust21/13은 production writer/Xml 코드를 추출한 격리 검사다. 전체 Rust 테스트를 실행한 것으로 표시하지 않는다.
- OS 대화상자·한글 직접 비교·실제 API 과금 호출을 실행하지 않았다. 브라우저 검사는 별도 headless 프로필과 자체 fixture/IPC를 사용했다.

[고정 결과와 변경 전 실패 근거](evidence/file-completion-2026-10-18/package91/README.md) · [기능 작업표](features/05-files-storage-recovery.md) · [기존 저장·복구 구현89](112-file-recovery-implementation.md)

## 실행

루트 `Start-Jueony-FileReview.cmd`는 새 `build/jueony-file-review91/Start-Jueony.cmd`를 사용한다. 포트4358이며 LLM 백엔드를 포함한다. 기존 앱/서버/문서는 종료하거나 교체하지 않았다. 새 실행 묶음의 로컬 서버·보호 설정·WASM·wire 계약7검사를 통과했으며 데스크톱 창을 열지는 않았다. 이전 포트의 업무·선택 상태·복구본을 새 origin으로 자동 이관하지 않는다. 백엔드의 API 키는 포트별 브라우저 데이터와 별개인 기존 Windows 암호화 연결 저장소를 사용한다.

```powershell
$env:JUEONY_ENGINE_PACKAGE=(Resolve-Path 'build/rhwp-engine/source-f339aba305da3aa9/pkg').Path
$env:JUEONY_TEST_OUTPUT=Join-Path (Get-Location) 'build/package-review-own-run'
node --experimental-strip-types apps/editor/scripts/verify-package-preservation.mjs
```

## 남은 결함과 완료 판정

**파트 전체 완료 선언이 아니다.** 상위0/10을 검증 없이 완료로 바꾸지 않는다.

1. **N001 실제 저장 결함:** 음수 배치 HWP6개를 HWPX로 변환하면 표/셀 위치가 약3.8px 달라져 보존 검사가 차단한다. 원본에 저장된 bit31 줄 정보와 런타임 합성 줄 정보를 구별하는 후속 후보를 검증 중이다. 이 문서의91 엔진에는 아직 포함하지 않았다.
2. **원문 최초 조판:** 원MCST15쪽과 실제 한글16쪽, Python3의 독립 한글 출력 차이가 남는다. 같은 엔진 저장 왕복 통과와 구별한다. 실제 원문 글꼴에 누락 기호의 선언된 대체 글꼴이 없으며 임의 폭을 대입하지 않았다.
3. **글 방향 변환:** 공식 API는 AUTO0/RTL1/LTR2를 명시하지만 HWP5 저장 비트 위치는 확정하지 못했다.138쌍6,221서식의 후보 비트에1,812반례가 있어 추측 구현하지 않았다. HWPX의 명시 방향 보존과 손실 발생 HWP 변환의 쓰기 전 차단은 유지한다.
4. **상위 기능 범위:** HWT/XSL/일반XSD, 일부 파일 Agent 명령, 전체 한글 메뉴·대화상자 동등성은 기존 미완료 상태다. 이번 수정으로 구현했다고 표시하지 않는다.

다음 작업은1번 저장 결함의 안전한 수정과 합본 회귀다. 직접 한글 검수는 마지막에 별도로 진행한다.
