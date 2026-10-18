# 원본 HWP 행 보존92의 고정 자동 검증

공식 새 엔진 `source-247b8244ffa41455`(99패치), 프런트 `dist-file-preservation92`. 기존98패치의 자원/메타데이터 보존과 새13파일 변경을 통합했다. 소스13개의 after SHA가 private freeze와 일치한다.

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| 같은 프런트 파일·복구16군 | 194/194 | 별도 headless/OPFS/IPC 및 직접 WASM 검사 |
| Node22 단위 | 970/970, skip0 | 새 고정 엔진을 명시 |
| UI native-row | 변경 전0/13 → 변경 후13/13 | 같은 verifier SHA; 전6개 실제 SaveAs 차단과 종속 실패를 구별 |
| 직접 native-row 엔진 | 18/18 | 혼합 저장/본문 수정/복원, 앞 문단 재조판은 불일치 차단도 통과에 포함 |
| 기존 단·표 고정 근거/저장 | 24/24 | 과거 독립 한글 출력 파일과의 고정 비교; 새 GUI 조작 아님 |
| Rust 소유권 | 7/7 | 로컬행/공유프레임/known caret raw 범위; 전체Rust 테스트 주장 아님 |
| 새 실행 묶음 | 7/7 | 서버·CSP·인증·실제 WASM 해시; 데스크톱 창 실행 안 함 |
| TypeScript·모듈 경계 | 통과 | 로그와 JSON 보관 |

앞 문단 줄/쪽 재조판 후 HWPX 저장은 여전히 차단되며 해결됐다고 표시하지 않는다. private candidate의110 export 중90개 checked,20개 blocked(기존 방향8, 앞 문단 재조판12)다. Undo/Redo48상태는 모두 동일했다. 공식 통합 엔진의194검사는 이 private110개와 별도이며 단순 합산해 제품 검증률로 표시하지 않는다.

semantic과 공개된 전체 본문·개체 좌표를 비교하며 production guard 및0.2허용오차는 유지했다. 직접 OS 파일 대화상자/한글 화면·인쇄·최초 조판 일치/명시 방향HWP5 매핑은 검증하지 않았다. 저장 UI는 pass-through export report와 실제 OPFS 디스크 바이트를 대조했고 source HWP를 바꾸지 않았다.

`workflows/`는 각 군의 원본 JSON을 gzip으로 보관한다. `candidate/`는 freeze된 소스/실패 원인/재현 runner·결과를 보관하며 일부 경로는 당시 build 경로다. 재실행용 production verifier는 `apps/editor/scripts/verify-native-row-{preservation,engine}.mjs`, 합본은 `scripts/verify_file_workflows.py`다. fixture는 이미 버전 관리된 자체6개 HWP이며 SHA를 강제한다. 사용자 문서·폰트·API키·WASM·EXE는 포함하지 않는다.

`verify.py`로 모든 바이트 지문을 확인한다.
