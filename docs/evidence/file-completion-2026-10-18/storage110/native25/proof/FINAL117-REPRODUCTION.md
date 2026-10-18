# 자체 HWT / preview 최종 재현

생산 runtime은 hwt-preview-utf16-and-repeat117.patch(공식116 기준 5파일)로 동결했다. 공식 합본 source/pkg는 root가 제공하며 이 절차는 공식소스를 수정하지 않는다.

1. Native25: native-preview-final25.rs를 별도 Native crate의 src/lib.rs로 사용한다. native-v4/Cargo.toml과 Cargo.lock을 재사용하되 rhwp와 vendor/svg2pdf 경로는 승인된 정확 source로 명시한다. JUEONY_HWT_WRITE_OUTPUT은 새 절대경로, Cargo target은 다른 작업과 공유하지 않는다. offline/locked, --test-threads=1로 실행한다. 실제25/25 로그는 native-preview-scalar117.log이고 문서원본/GUI/COM 없음.
2. 독립 raw reader 준비: JUEONY_TEST_OUTPUT을 새 절대경로로 정한 뒤 node apps/editor/scripts/prepare-preview-raw-auditor117.mjs. 별도 offline Cargo.lock 생성 후 cargo build --offline --locked로 빌드한다. 원본프로그램은 scripts/lib/preview-raw-audit117.rs이고 스스로 컴파일된 source SHA를 결과에 포함한다.
3. 실제 Node WASM preview: JUEONY_ENGINE_PACKAGE와 JUEONY_TEST_OUTPUT(새 경로), JUEONY_PREVIEW_RAW_AUDITOR(컴파일된 WSL 실행파일 절대경로)를 지정해 node scripts/verify-preview-utf16-storage117.mjs. 7cases, 자체fixtures5개 SHA 확인, 정상 한글/astral 양형식/기존XMLaux/invalid3종×HWPX4API/전체rawstream 검사. fixture 원본은 쓰지 않는다. Python stdlib zipfile은 UTF8 preview entry만 독립 읽는다.
4. HWT standalone: 같은 package에서 verify-hwt-leaf115.mjs 13cases. 실제 shell/iframe은 JUEONY_TEST_DIST를 지정해 verify-hwt-leaf-integrated115.mjs 7cases, 고유4496. synthetic Native actual factory는 verify-hwt-leaf-native-ui115.mjs 10cases, 고유4497. 순차 isolated headless만 실행한다.

Windows Native picker/write 실측은 root가 별도 수행한다. Node Native UI는 실제host factory+메모리 IPC이며 realWindows/Hancom GUI 성공으로 합산하지 않는다. typed preview+opaque raw conflict는 Native25에서만 주입 가능한 IR 상태이다. 단일 CFB /PrvText 입력은 파서가 typed와opaque 동시 소유로 만들지 않으므로 실제WASM conflict case를 만들어냈다고 주장하지 않는다.

116 actualWASM의 처음13중11PASS2FAIL/실제shell7중6PASS1FAIL은 HWT 두번째편집 미리보기 손실이고 그대로 보존한다. Native-shim 첫 실행은 IPC command 오타로 시작전 timeout(0case)였으며 제품성공이 아니다. preview7 baseline116은2PASS5FAIL로 정상astral 및 invalid preview 바이트 소실을 입증한다. 실패를 허용치/비교필드 삭제로 바꾸지 않았다.
