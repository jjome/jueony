# 정식68 · 저장 보존과 파일 수명 후속

이 묶음은 파일·저장·복구·형식 보존 파트 전체의 완료 선언이 아니다. 상위10개는 미완료다. 완료한 수정과 남은 범위는 [109번 기록](../../../109-file-preservation-hancom-followup.md) 및 [기능별 현황](../../../features/05-files-storage-recovery.md)에 구분했다.

| 검사 | 결과 | 실제 범위 |
| --- | --- | --- |
| 엔진 | `cda65172283c6657`, 68패치 | WASM `4a9acaf931b91b967f93b777cf5b987c7e73d23cff0f0a9a9c719b5e244938e9` |
| 기존 회귀 | 44/44 묶음 | `dist-file-summary-outer68`, Native27·실제 격리 Edge17. 종료 후속 수정 전 profile |
| 최종 단위 | 870/870, skip0 | 저장·metadata·새 문서 instance/종료 계약 포함 |
| 최종 타입 | PASS | `dist-file-lifecycle-verified68`의 전체 생성 Studio 프로젝트. 최초 history 타입6오류도 보존 |
| 최종 저장 화면 | Save14·Agent/여백16·폭/여백18 | 최종 profile에서 다시 확인. 실제 OPFS 쓰기·재열기·Undo·취소·의도된 실패/보존 |
| 문서 요약 | 후보 Native15·정식 API9·Edge10 | 다섯 요약 필드, 원자 CAS·undo/redo·양형식 저장. [별도 범위](metadata/README.md) |
| 닫기·끝 | 단위29·실제 Edge10 | 실제 UI/IDB와 합성 native IPC·destroy. 모두 저장/폐기/복구/취소·부분 저장 실패·다른 업무 checkpoint·실패 원복/CAS |
| 문서 표 | 17문서·142표·440ID | 실제 Edge 렌더링·620/1100 폭, 기능별 표 구조 보존 |
| Windows 실행 파일 | 빌드·정적 무결성만 PASS | GUI는 실행하지 않음. 새 OS 선택창·종료·재시작 검수 NOT_RUN. AI backend는 포함하지 않음 |

최종 검수용 실행 파일은 로컬 `build/native-file-final68-20261017/JueonyNativeFinal68Review.exe`이다. 기존 사용자 데이터와 실행 파일을 덮어쓰지 않도록 별도 식별자·이름으로 준비했다. 파일 SHA와 NOT_RUN 범위는 `native-preparation/build-result.json`에 있다. 예전 51패치 실행본의 실제 GUI 검수를 이 새 실행본의 검수로 옮겨 적지 않는다.

## G073의 새 메타데이터 계약과 이전 실패

정식66의 실제 live/save 위치 실패3개와 UI 저장 보호 거절은 [이전 증거](../engine66/regression-failure-followup/README.md)에 보존했다. 후속은 알려진 생성 raw6 상태와 Native 편집 세션의 정확한 host 소유만 보완한다. 보호·여백 불일치·unknown 비트·산술 관계의 음성 검사는 유지한다.

기존31개 검사를 새 metadata API와 함께 처음 실행한 결과9/31 및 독립 oracle 도입 후27/31도 보존했다. 과거63 엔진에 없던 새 필드를 무조건 삭제하지 않고, 원본17개의 raw CFB/OPF oracle을 SHA에 묶어 과거 baseline의 누락된 기대값만 추가했다. 현재 엔진의 모든 원본 필드는 그 독립 값과 다시 대조한다.

HWPX 실제 한글 사본에는 빈 제목을 `앞 본문`으로 채운 **title1차이**가 남는다. 전체 비교 결과에 이 차이를 그대로 유지하고, 다른 모든 공개 필드·전체 지면의 일치를 검사했다. 두 사본 모두 의미0이라고 하지 않는다.

네 HWPX 보호 반례의 HWP 변환에서는 과거 writer의 `edward` 작성자를 실제 원본 OPF `rhwp`로 보존하는 수정 때문에 전체 파일 bytes가 달라진다. 이를 임의 허용하지 않고, 다른9개 logical stream 및 unknown9개 PID·padding·순서·prefix/suffix의 정확한 보존과 전체 Summary bytes의 독립 재구성을 검사했다. 본문/unknown PID 변조·잘못된 작성자 기대값·BOM 이름 위장도 거절한다. 최종 `outer/contract31-bom-preserving.json`은31/31이다. 지면 허용값0.2와 운영 저장 보호는 완화하지 않았다.

## 재현과 무결성

`verify-evidence.py`는 외부 패키지나 네트워크 없이 묶음의 모든 payload SHA 및 결과 관계를 검사한다. 운영 검수기는 원래 `apps/editor/scripts` 위치에서 실행하며, 보관한 `.mjs`의 상대 import는 그 위치를 기준으로 한다. 엔진은 저장소의 고정 upstream과68패치로 `scripts/Build-DocumentEngine.ps1`을 실행해 재생성한다.

공개·사용자 문서, API 키, 글꼴 프로그램, WASM/SDK/실행 파일 바이너리는 이 묶음에 넣지 않았다. 검수용 자체 문서와 한글이 저장한 사본은 이전66 묶음·metadata 하위 묶음의 SHA로 추적한다. 기존 실패·옛 manifest는 바꾸지 않았다.
