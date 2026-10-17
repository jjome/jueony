# 파일 보존 최종 합본86 근거

| 구분 | 결과 | 해석 |
| --- | --- | --- |
| 같은 최종 엔진 | b59322fd380dc175 /95patch | WASM ef130c08536b38349bfb0c9b94a4478094c85df04ba2969ef4e4f65d05363f17 |
| unit |933/933·실패0·skip0 |85의 머리말/각주 커서2 회귀는 final86에서 해소 |
| 기존 회귀 | 직접WASM27군·실제Edge17군 |공개 변환 군은7지원/3미지원 거절로 명시 분류; 모든변환지원 아님 |
| 파일·복구 화면 |133/133 |격리 실제Edge와 Native IPC seam, 실제 OS picker 검수 아님 |
| 타입·경계 |PASS |최종 화면·모듈·계약 검사 |
| GulimChe |23/23 |지원8·혼합2·font미지원2·독립XML11,16strict재열기/4차단 |
| 방향·폰트 |14/14 |출력14개/독립XML·HPF98entry,미지원 저장 거절 포함 |
| v1 story |3/3 |old83/new86 raw/의미/실제지문 차이0·12재열기·old bookmark복원,caret적용callback은합성 |
| 표 원점/수명 |3/3 |4px·187차이 해결; 실제XML의HWP미지원188경로 거절과 구별 |
| 3단 |9/9 |신규3·기존음성6,생산guard와전체layout그대로 |
| 실행 묶음 |7/7 HTTP·바이트 검사 |임시owned loopback server/메모리연결저장소,실제launcherUI·유료모델호출없음 |
| Windows native |빌드 성공·GUI NOT_RUN |현재Rust5서비스컴파일;구실행본7개불변;APIbackend미포함 |
| 원형 mandatory4군 |실패4 보존 |명시LTR188개의HWP변환미지원;원래지원조건의완료가아님 |

**전체 파일·저장·복구·형식 보존 파트는 아직 완료가 아니다.** 원공개 MCST의15→16 초기조판, Python3직접oracle92차이, 명시방향HWP매핑과 최신 실제Windows/한글 검수가 남는다. 이전83의 실제한글저장·닫기·디스크재열기 근거는 그대로 유지하며 final86실제한글검사로 소급하지 않는다.

`summary.json`은 같은 최종 빌드의 종합 판정, `regression-index.json`은 gzip 보고서의 원래SHA·경로다. `regressions/`는129개 명시보고서/로그만 포함한다. 브라우저 프로필은 재귀 복사하지 않았다. `final/`은 같은b59322 엔진의 개별 검수, `candidates/`는 별도 Native후보와 초기실패를 구분한다. 원형85 unit2FAIL·기존변환3FAIL과 Native 하니스/숫자표현 오탐은 역사로 남긴다. 검수기 계약의 변경이 지원범위 확대라고 주장하지 않는다.

실제 엔진명령→Undo/Redo→export→생산보호검사→사본재열기를 사용했다. 의미·모든공개layout필드·좌표0.2·한도·alias/소유 보호를 약화하지 않았다. 잘못된namespace를 동일엔진이관대하게다시읽는오탐을 막기 위해 Python ZIP CRC/ElementTree 독립검사를 추가했다. Native후보의CRLF/LF 바이트차이는각rawSHA와코드동일성으로분리하며,최종컴파일 source와manifest를별도로고정했다.

재현 도구는 고정Rust/Node22.22.2/Python3.14/PowerShell7과 기존로컬의핀된공개입력이필요하다. 공개입력은원본SHA를검사해읽기전용사용하며이묶음에는포함하지않는다. 같은 repository에서 scripts/verify_file_preservation.py 및 scripts/verify_file_workflows.py에최종절대engine/dist와새output을지정한다. 개별검수기의절대환경·sourcepin·SHA는각선택묶음에기록했다. root verify.py는배포된전체증거바이트만검사하며기능검수를다시실행한것은아니다.

공개본문/전체publicsnapshot/공개파생파일/폰트프로그램/API키/브라우저프로필/WASM/EXE는Git에포함하지않는다. 자체합성HWP/HWPX fixture만선택했으며실행본은로컬build폴더에남긴다. [사용방법·남은완료조건](../../../111-file-storage-final-review.md).
