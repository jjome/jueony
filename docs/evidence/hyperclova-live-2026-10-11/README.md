# HCX-005 서비스 실호출 검증

2026-10-11 한국 시간. 승인된 서비스 모델은 사용자의 코드 보기 화면과 실제 API에서 **HCX-005**로 확인했다. 인증 헤더와 키는 이 폴더에 없다. API 호출에는 합성 문서만 사용했다.

## 통과한 기능

최종 실호출 실행은 `2026-10-10T16:10:17Z`~`16:10:47Z`(한국 시간 10월 11일 01:10)이며 API 요청 3회로 10개 흐름 검사를 통과했다. 상세 입력·정규화 결과·모델 도구 응답은 [result.json](result.json).

1. 서비스 키 인증과 편집안 함수 계약.
2. UI에서 실제 제공자 등록.
3. 실제 모델의 새 문서 명령 적용.
4. 생성 문서 HWP 저장, HWP/HWPX 재파싱.
5. 미저장 문단을 읽어 제목 일부 제거와 마지막 문단 삽입.
6. 수정 문서 저장·재파싱.
7. 비교 화면의 실제 변경 전후 일치.
8. 요청 undo가 미저장 사용자 문맥을 복원.
9. 되돌린 문서 저장·재파싱.
10. IndexedDB에 키 원문이 없음.

## 품질과 검증 한계

최종 초안은 `주민 교육 계획 / 목적 / 일정 / 기대 효과` 네 문단을 만들었다. 각 항목의 내용을 한 문장으로 쓰라는 요청에는 충분히 응하지 않았다. **명령 전송·편집·저장 흐름의 통과이며 초안 품질 통과가 아니다.** 사실성, 다양한 자료의 인용, 긴 문서와 복잡한 서식은 후속 평가가 필요하다.

실제 한글 2024는 이 실행에서 사용하지 않았다. HWP는 UI의 실제 다운로드 결과이며 HWPX는 해당 HWP를 같은 WASM 엔진으로 변환했다. 사용자는 아래 파일을 한글에서 열어 독립 검사한다.

| 파일 | 기대 본문 |
| --- | --- |
| 01-created.hwp / .hwpx | 주민 교육 계획, 목적, 일정, 기대 효과 |
| 02-applied.hwp / .hwpx | 위 네 문단 뒤 문의 안내 문단 추가 |
| 03-reverted.hwp / .hwpx | 미저장 주민 교육 계획, 목적, 일정, 기대 효과 |

`live-diff.png`, `live-workspace.png`는 실제 모델 검사 화면이다. 기관망과 OS 전체 네트워크 차단 검사는 아니다. 이 실호출에는 참고 파일을 선택하지 않았으므로 V14의 자료 인용 항목은 PARTIAL이다.

## 확인한 실패와 보완

[attempt-summary.json](attempt-summary.json)은 실패 실행도 남긴다. 사용자 테스트 키의 HCX-007 호출과 서비스 키의 HCX-005 호출은 별개다. 키 값은 기록하지 않았다.

- HCX-007 서비스 호출: No Service App. 승인 모델 HCX-005와 불일치.
- 자유문 출력: JSON 코드 블록, 잘못된 JSON, 글자 수 오산, 근거 없는 연도 생성이 관찰됨.
- 최종 HCX-005 구현: 공식 function calling으로 지정 도구 하나만 받는다. `originalText`를 문서 원문과 정확히 대조하여 앱이 Unicode 범위를 계산한다. 임의 문장을 JSON으로 복구하거나 잘못된 명령을 조용히 수정하지 않는다.
- UI 검사 중 설정 모달의 비동기 초기화 전에 입력한 테스트 타이밍 오류도 수정했다.

## 다른 자동 검사

- [launcher-tests.txt](launcher-tests.txt): 22개 통과. DPAPI 실제 암·복호화, 서버 재시작·키 교체·삭제·손상 파일 보존, 두 모델 wire 계약, 지정 도구·원문 검사, 세션/출처 경계, 오류·취소.
- 앱/엔진 19개 및 TypeScript 검사·Vite 빌드 통과.
- [hcx007-fixture-ui.json](hcx007-fixture-ui.json): 결정적 로컬 제공자 19개 통과.
- [compatible-ui.json](compatible-ui.json): OpenAI 호환 로컬 제공자 18개 통과.
- [connection-ui.json](connection-ui.json): 가짜 키/임시 저장소로 실제 설정 UI 6개 통과. 키 저장·재실행·빈 키 유지·목적지 변경 차단·키 교체·연결 삭제.

실호출 JSON의 frontend 해시는 실호출 당시 빌드를 가리킨다. 이후 안내와 모델별 입력 토큰 한도를 갱신하고 설정 UI 6개를 다시 통과했다. 최종 실행 묶음의 해시는 build/jueony-mvp/bundle-evidence.json에 있다.

## 재현

루트: `node --test apps/launcher/tests/*.test.mjs`

apps/editor:

```powershell
node scripts/build.mjs
node node_modules/typescript/bin/tsc --project .build/studio/tsconfig.json --pretty false
node --experimental-strip-types --test tests/*.test.ts
node scripts/verify-connections.mjs
node scripts/verify-hyperclova-live.mjs
```

실호출 검사는 숨김 키 입력을 요구하며 실행당 최대 3회의 API 사용량이 발생한다. 실제 키 설치는 launcher/configure-hyperclova.mjs의 숨김 입력 또는 앱 설정으로 진행한다. Windows 현재 계정에만 암호화 저장하며 Git과 실행 묶음에는 키를 넣지 않는다.
