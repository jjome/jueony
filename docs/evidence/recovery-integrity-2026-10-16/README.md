# 복구본 무결성·강제 종료 검증

[구현과 제한](../../106-recovery-integrity.md) · [검증 요약](verification-summary.json)

- 편집기 단위 812개, 실제 Edge 46개 통과. TypeScript 오류 0.
- integrity-browser 10개: 실제 checkpoint·보기 상태·두 형식의 Browser.crash/재실행·UI 저장·손상 격리·예전 기록 업그레이드.
- save-browser 29개, story-browser 7개는 같은 새 프런트엔드에서 수행한 관련 회귀 검사.
- recovered-saved-hwp.hwp / recovered-saved-hwpx.hwpx는 실제 강제 종료 복원 후 저장한 자체 문서다.
- 실제 사용자 창·문서·키를 사용하지 않았다. 프로필 데이터/고의 손상 파일은 배포 근거에 포함하지 않았다.

문서 바이트·문서/업무 ID·이름·dirty·checkpoint 시각을 검증한다. 뷰와 handle은 지문 범위 밖이며, checksum은 서명/암호화/공격 방지가 아니다. 지문 없는 구버전 기록은 기존 유효성 검사로 읽는다. 실제 Windows 파일 선택창·ACL·공유 잠금, OS 전원 장애, 한글 직접 비교는 남아 있다.

이번 결과는 이전 저장 배치의 전체 엔진/브라우저 실행 수와 합산하지 않는다. 빌드 메타데이터의 commit/dirty 값도 원래 값 그대로 유지한다.
