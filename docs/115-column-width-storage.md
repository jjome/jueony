# 다단 너비 형식 변환과 저장 검수

> 후속94: 아래에 남겼던 앞 문단 재조판 저장 차단은 [후속 구현·자동 검증](116-reflowed-native-storage.md)에서 수정했다. 이 문서는93 당시의 결과를 유지한다.

2026-10-18. 파일·저장·복구·형식 보존의 후속 수정이다. [원본 행 저장92](114-native-row-storage.md)의 구현에 두 패치를 더했다. 한글 직접 비교는 사용자 요청에 따라 하지 않았다.

| 항목 | 수정·확인한 범위 | 남은 제한 |
| --- | --- | --- |
| HWP 비례 단 너비→HWPX 절대 너비 | 실제 구역 본문 폭과 native 공통 계산으로 너비·간격을 변환 | 소유 폭을 확인할 수 없는 중첩 subList는 손실 보고 후 저장 차단 |
| 방향·쪽 방향·여백·제본 여백 | PageAreas와 native 단 계산을 공유; 논리 너비 목록을 임의로 뒤집지 않음 | 잘못된 크기/배열, 표현 범위를 넘는 변환은 성공으로 처리하지 않음 |
| 정수 범위 | unsigned HWP word의 의미를 유지하며 XML 단위로 변환 | 현재 XML reader의32767 상한을 넘으면 명시 손실 보고; wrapping/clamping 없음 |
| 검증의 누락 방지 | 실제 ZIP의 colSz를 독립 검사하고 앞 문단 편집의 실제 텍스트 증가도 확인 | 공개 getter가 내놓지 않는 값을 같은 엔진 왕복만으로 완료 판정하지 않음 |
| 원본 행 지문의 렌더링 비용 | 그 권한을 소비하는 HWP5-origin HWPX에서만 lazy 계산 | origin HWPX의 큰 문서에는 반복 해시 비용이 남음; revision 캐시를 임의로 만들지 않음 |

## 수정 근거

고정 자체 문서의 HWP 단 너비 `[12000,20768]`와 간격`1000`은 비례값이다. 기존 writer는 이를 HWPX의 절대 colSz에 그대로 기록했다. 이 문서의 실제 본문42520HU에 맞는 XML 정수는 너비`15110/26150`, 간격`1259/0`이다. 독립 ZIP 검사를 추가하자 기존92 엔진의19사례 중 이 검사만 실패했다. 기존 캐시된 행 때문에 바로 화면 차이가 드러나지 않는 경우까지 잡기 위한 검사다.

새 writer는 `ColumnDef::proportional_dimensions`를 native renderer와 공유한다. section의 실제 PageDef에서 본문 폭을 구하고 뒤쪽 본문 SectionDef가 바뀌면 갱신한다. 모델·원본 파일·지면 보호 검사·허용오차를 바꾸어 결과를 맞추지 않았다. 알 수 없는 중첩 frame이나 출력/파서 범위를 넘는 값은 `ContentLoss`에 기록하여 앱이 쓰기 전에 거절한다.

별도 렌더링 패치는6개 진입점에서 `hwp5_origin_hwpx()`인 경우에만 원본 행 프레임 지문을 계산한다. 공유 LayoutEngine에는 해당하지 않을 때도 `None`을 설정한다. **로드 봉인과 serializer의 지문 검사는 그대로 유지한다.** Native HWP→HWPX 저장 검사를 꺼서 연산을 줄인 것이 아니다.

## 빌드와 검증

- 엔진: `source-448ba81d29c9095a/pkg`,101패치의 새 WASM release 빌드.
- 프런트: `apps/editor/evidence/dist-file-preservation93`.
- 패치: `proportional-column-persistence.patch`(`43bf22538170222f634321eae536026c969af85d956cc3ebb8d2b9901a6b7e12`), `lazy-native-row-render-context.patch`(`0dc75bc3af81aa8c3383b7310a6d21fb3e326112b4bb279328d59956bd115b59`).
- 고정 결과·로그·SHA: [자동 검증93](evidence/file-completion-2026-10-18/columns93/README.md).

**같은 새 빌드의16군195/195**, **단위970/970(skip0)**, **기존 단/표24/24**, **실제 Windows 저장10/10**, **실행 묶음7/7**, **TypeScript·모듈 경계**를 확인했다. 직접 엔진19사례는 동일verifier로 이전18/19→새19/19였다.195에는 앞 문단 불일치의 안전한 차단 검사도 포함한다.

각 검증은 실제 새 WASM·프런트 SHA와 verifier SHA를 확인한다. UI 검사는 별도 headless Edge/OPFS/Native IPC 경계에서 실행하며 사용자 창이나 파일을 사용하지 않는다. 실제 Windows 저장 검사는 자체 생성한 HWP/HWPX 파일만 대상으로 한다. 이런 검사와 실제 한글의 화면·인쇄·메뉴 동등성을 구별한다.

## 완료하지 않은 부분

**파트 전체 완료가 아니다.** 원본 행 저장과 비례 단 너비 결함은 수정했지만 다음은 남는다.

1. 앞 문단의 줄/쪽 재조판 뒤 HWPX 저장은 새 계산 행의 수명·축·프레임 연결이 해결되지 않아 차단한다. 행 태그 제거, 행만 XML에 복사, 중간 HWP 재열기만으로는 해결되지 않았다. 원본 행으로 재봉인하거나 손실 검사를 생략하지 않는다. 기존 stress12변환의 차단과 정확한 Undo/Redo를 기록한다.
2. 명시 글 방향의 HWP5 비트 매핑, 원MCST와 Python3의 최초 조판/글꼴 차이는 별도 잔여다. 실제 한글 비교는 보류한다.
3. HWT/XSL/일반XSD, 모든 한글 파일 메뉴·OS 대화상자의 동등성 등 상위 범위는 기존 작업표의 미완료 상태를 유지한다.

## 실행

루트 `Start-Jueony-FileReview.cmd`는 새 `build/jueony-file-review93/Start-Jueony.cmd`(포트4360)를 사용한다. 기존 실행본·열린 문서·브라우저 상태를 종료하거나 덮어쓰지 않았다. 새 origin에 기존 workspace/복구 상태를 자동 이관하지 않는다. 백엔드의 기존 DPAPI 연결 키 저장소와 브라우저 origin 상태는 별개다.

```powershell
python -X utf8 scripts/verify_file_workflows.py `
  --engine C:/Users/jjome/Documents/work/jueony/build/rhwp-engine/source-448ba81d29c9095a/pkg `
  --dist C:/Users/jjome/Documents/work/jueony/apps/editor/evidence/dist-file-preservation93 `
  --output C:/Users/jjome/Documents/work/jueony/build/my-file-review93 `
  --node C:/Users/jjome/AppData/Local/Volta/tools/image/node/22.22.2/node.exe --workers 2
```

출력 폴더는 새 이름을 지정한다. 직접 검사 두 군의 단독 실행은 `verify-native-row-preservation.mjs`와 `verify-native-row-engine.mjs`를 사용한다.
