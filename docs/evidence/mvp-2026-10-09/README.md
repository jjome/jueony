# MVP 검증물 · 2026-10-09

앱/엔진 19개, 서버 7개, headless Edge UI 18개가 통과했다. result.json에는 실제 실행한 화면 검사, 런타임, 빌드 커밋/해시, 외부 페이지 요청 목록을 담았다. UI 테스트의 LLM은 결정적인 로컬 HTTP fixture이며 실제 추론 모델이 아니다. 폴더 핸들은 OPFS를 사용했다. validation.json에 검증물 SHA-256을 기록했다.

새 Rust exe는 컴파일했지만 이 PC의 Windows 애플리케이션 제어가 실행을 차단했다. 최종 작동 경로는 **Start-Jueony.cmd → PowerShell → 동봉한 Node 서버 → Edge/Chrome**다. 정책을 변경하지 않았다. TypeScript 검사는 종료 코드 0이며 결과 출력이 없는 정상 검사다.

## 실제 한글에서 확인할 파일

| 단계 | HWP | HWPX | 기대 내용 |
| --- | --- | --- | --- |
| 초안 | [01-created.hwp](01-created.hwp) | [01-created.hwpx](01-created.hwpx) | 올해 업무 계획 / 추진 목적을 정리합니다. / 일정을 검토합니다. |
| 적용 | [02-applied.hwp](02-applied.hwp) | [02-applied.hwpx](02-applied.hwpx) | 제목이 수정된 업무 계획, 마지막에 추가 검토 사항 |
| 되돌림 | [03-reverted.hwp](03-reverted.hwp) | [03-reverted.hwpx](03-reverted.hwpx) | 초안과 같은 3개 문단 |

HWP는 UI에서 새로 다운로드한 파일이다. HWPX는 해당 HWP를 같은 엔진으로 읽어 변환한 동반 파일이다. 텍스트와 문단 경계는 두 형식 모두 같은 엔진으로 재검사했다. 실제 한글 호환성 판정은 아직 아니다.

각 파일을 한글 2024에서 열어 오류 여부, 본문/문단 경계, 제목·글자 서식, 쪽 수를 확인한다. 다른 이름으로 다시 저장하고 재열기까지 확인한다. [검사 상태 CSV](../../mvp-acceptance-results.csv)의 V28에 결과를 기록한다. 모든 문서는 합성 검수 자료이며 기관 업무 원본이나 실제 API 키는 포함하지 않는다.

[화면](workspace.png), [UI 검사 로그](ui-tests.txt), [서버 검사 로그](server-tests.txt), [엔진/앱 검사 로그](unit-tests.txt), [검증 요약과 해시](validation.json).
