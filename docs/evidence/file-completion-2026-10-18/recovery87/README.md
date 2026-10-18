# 파일 복구 구현87 근거

- 소스 검수: 전체 Node945/945(skip0), 타입·모듈 경계 통과.
- XML: 별도 복구 단위9, 실제 IndexedDB·격리 headless Edge13, 기존 XML 사본 내보내기·재열기13 통과.
- Windows library32(기존29+경계2+source witness1), Node native host/recents33. 합산해 호환률로 표시하지 않음.
- XML 초기 비동기 버튼의 즉시 크기 오류 표시 회귀1은 별도 실패 보고서를 유지하고 선검사 복구 후 원형13을 재실행했다.
- native 폴더의 baseline 실패와 준비 TEMP 오류는 성공 결과와 구별한다. 원래 manifest도 보존한다.
- 사용자 창·입력장치·한글 조작0. Windows library/IPC와 headless IndexedDB 검사는 실제 OS 대화상자/한글 비교가 아니다.
- 자체 XML/XSD만 포함. 사용자 파일·공개 원본 전체·프로필·폰트·API 키·실행파일은 제외.

상위 manifest는 각 payload SHA-256을 기록한다. 기존 엔진86 실행본을 새 소스 검수본으로 소급하지 않는다.
