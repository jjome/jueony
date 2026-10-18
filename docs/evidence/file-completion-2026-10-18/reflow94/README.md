# 재조판 저장 수정과 자동 검증94

최종 공식102패치 엔진 `source-7c10dba04ed65742`, 프런트 `dist-file-preservation94b`. [구현·지원 범위·잔여 표](../../../116-reflowed-native-storage.md)를 함께 읽는다. 실제 한글 GUI 비교는 실행하지 않았다.

| 검사 | 결과 | 고정 기록 |
| --- | --- | --- |
| 동일 공식 빌드 파일/복구19군 | 242/242 | [종합 결과](workflows/result.json), 군별 결과·gzip 로그 |
| 앞 문단 줄/쪽 재조판 실제 저장 | 12/12 | [결과](workflows/reflowed-native-storage/result.json); 실패 차단은 PASS로 세지 않음 |
| 실제 저장 UI·history·재열기 | 13/13 | [결과](workflows/reflowed-native-ui/result.json); 격리 Edge·OPFS |
| 독립 ZIP·캐시·원본 바이트 바인딩 | 22/22 | [결과](workflows/computed-row-package/result.json); CRC·실제 XML·양성 대조군 |
| Node22 단위 | 970/970, skip0 | `checks/unit94.log.gz` |
| 기존 단·표 회귀 | 24/24 | [결과](columns/result.json); 이전 고정 한글 근거를 재사용, 새 GUI 검사 아님 |
| 실제 Windows Rust 파일 저장 | 10/10, ignore0 | [결과](windows/result.json), 원형 gzip 로그 |
| 실행 묶음 | 7/7 | [결과](bundle/result.json); 독립 memory 서버·CSP·인증·WASM |
| TypeScript·모듈 경계 | 통과 | `checks/*94.log.gz` |
| Native 선택 계약·UTF-8/ZIP | 17/17, ignore0 | `authority-fix/`; 동결 후보, 공식 WASM 실행과 별도 |
| Native HWP 어댑터 | 10/10, ignore0 | `native-adapter/`; 자체12사례의 두 체인84회 재열기 |

242에는 위12·13·22가 포함된다. 별도 단위/Native/Windows 검사를 더해 제품 검증률로 만들지 않는다. old safe-refusal 검사도 유지하며 그것을 실제 저장 성공 검사와 구분한다. 전체 의미·배치는 기존 공개 기준을 사용하고 0.2 좌표 허용오차를 바꾸지 않았다. Native 불균등 단의 `charX`에는 약0.1px 차이가 있어 원형을 그대로 보관한다. 전체 숫자 차이0이라고 주장하지 않는다.

## 실패 재현과 개선

`before/`의 동일 검사기 SHA에서 이전101패치 엔진은 실제 저장0/12·UI0/13이었다. 캐시22검사는 그 엔진3/22(새 기능 부재 포함), 첫 통합 후보18/22였다. 첫 통합 후보의 나머지4건은 실제 UTF-8 바이트 충돌·header/section 중복에서 권한이 유지되는 결함이었다. 정확한 실패를 확인한 뒤 최종 엔진22/22를 검증했다. 이 수치를22개의 기존 버그 개수로 해석하지 않는다.

`candidate/`, `native-adapter/`, `authority-fix/`는 각 후보 당시의 원형 실패/진단·코드·재현 runner·SHA를 gzip으로 보관한다. 내부 manifest의 "공식 검수 대기"는 그 인계 당시 상태이며, 공식 검수 결과는 위 `workflows/`가 기준이다. 후보를 최종 빌드와 혼동하지 않는다.

## 소스와 바이트 증명

[공식 소스26개 지문](official-source-proof.json), [엔진 빌드](engine-build.json), [프런트 빌드](frontend-build.json)를 보관한다. 패치는 LF이며 Rust 소스 텍스트의 CRLF→LF만 명시적으로 정규화한 지문과 원시 지문을 분리했다. 기하·원본 문서·검사 결과를 정규화하여 맞추지 않았다. 측정 파이프라인223개 입력의 생성 지문은 `c02f5a92d7e6e81fe708973d2d99d9782c7bf9362bc97a2569ecf78941459e2c`다.

공식 소스의 직접 Native 테스트 컴파일은 상류 외부 시험 파일 누락으로 실패했다. 원본은 변경하지 않고 Rust/Cargo1,155개 바이트가 같은 임시 사본에 시험 파일12개만 추가한 검사를 구별해 보관했다. 공식 WASM은 추가 시험 파일/환경 하니스 없이 컴파일했고 실제 실행으로 검증했다.

새 파생 캐시 계약은 폰트·본문·표·전체 IR의 그림자 사본이 아니다. 예약된 v1 HWPX 캐시는 손상·미지원 버전·측정 세대 불일치 시 폐기하고 표준 XML을 읽는다. 전용 캐시의 opaque 보존이나 전자서명을 주장하지 않는다. CFB 미확인 원시 스트림의 보존 규칙은 유지한다. 최초 조판·명시 글 방향 매핑·미지원 복합 프레임·모든 OS 선택창/한글 동등성은 이번 PASS의 범위가 아니다.

[한글 재열기용 자체 저장24개](samples/README.md)를 준비했다. 사용자 문서·API 키·폰트·EXE·WASM은 이 증거 폴더에 포함하지 않았다. `python -X utf8 verify.py`로 모든 보관 바이트와 결과의 연결을 확인한다. 전체 재실행 명령은 상위 구현 보고서에 있다.
