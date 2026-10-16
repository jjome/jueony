# 파일 저장·복구·형식 보존 검증

2026-10-16. [구현 범위와 남은 제한](../../105-file-storage-preservation.md) · [기능별 작업표](../../features/05-files-storage-recovery.md).

| 검증 | 통과 | 근거 |
| --- | ---: | --- |
| 편집기 단위 검사 | 804 | [unit-tests.txt](unit-tests.txt) |
| 제공자·서버 합성 검사 | 52 | [provider-tests.txt](provider-tests.txt) |
| 실제 WASM 엔진 검사 | 430 | [52개 묶음별 결과](verification-summary.json) |
| 실제 Edge 브라우저 검사 | 312 | [실행 이력](regressions.json) |
| TypeScript | 오류 0 | [컴파일 로그](typescript.txt) |
| 모듈 경계 | 9개·소스 303개 | [검사 결과](boundaries.json) |

모든 엔진·브라우저 검사는 최종 WASM `15c3227b32bd836cc2601eae1577a17c52183ecdfa7d7026d42aa3759b6709e9`에서 수행했다. 각 결과의 주 엔진/빌드 지문을 대조했다. 이전 진단용 엔진 결과를 통과 수치에 합산하지 않았다. 합성 provider 검사에는 실제 키나 과금 호출이 없다.

새 검증: 저장·취소·다른 형식 저장·readback·복구 쓰기 실패 29개, 병합 행 높이 85개, 겹침 표 원점·손상 저장 보호 30개, 머리말·각주 문맥 복원 22개. 기존 회귀 검사 Native 330개·브라우저 246개도 같은 최종 실행본에서 통과했다.

## 검수 문서

실행 묶음 `build/jueony-storage-20261016/Start-Review.cmd`와 `review-documents/storage/`에 자체 작성한 정상 결과를 준비한다. `save-browser/`의 readback 두 형식과 SaveAs 네 조합부터 검수한다. 병합 표·겹침 표·머리말/각주는 동명 브라우저 결과 폴더에 있다. 파일 이름에 포함된 테스트 구분은 결과의 기능 범위를 나타낸다.

일부 공개 문서 파생 파일은 [해시 목록](related-artifact-hashes.json)으로 추적하며 이 폴더에 재배포하지 않았다. 일부러 손상시킨 저장 결과도 [장애 주입 파일 해시](fault-artifact-hashes.json)만 기록했다. 예상된 장애와 예기치 않은 오류는 개별 결과에서 구분한다.

## 남은 제한

한글 2024 직접 비교는 아직 미실행이다. 실제 Windows 선택창·ACL·공유 잠금·강제 종료 복구와 모든 미해석 원시 개체/서명 보존을 보증하지 않는다. 겹침 원본의 알려진 미지원 배치 세 유형은 저장 전에 차단하며, 편집 내용과 기존 복구본을 유지한다. 해당 문서의 새 복구본 생성도 거절될 수 있다. 검사 통과 수는 전체 기능 완료율이 아니다.

빌드 메타데이터의 pre-commit/dirty 값은 사실대로 유지한다. `source-baseline-notes.json`은 완료 커밋과 실제 소스·패치의 동등성을, `launcher-check.json`은 별도 검수 서버의 실제 응답·자산을, `packaged-evidence.json`은 실행 묶음에 포함한 근거 파일의 동일성을 기록한다.
