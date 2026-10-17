# 최신 정식68 Windows 네이티브 검수 준비

- 실행 파일: `JueonyNativeFinal68Review.exe` (52,376,064바이트)
- SHA256: `382757d18deee426a43db2b87b29b39ea426b4c486b4a2c111bf7b426d7d397b`
- 앱 식별자: `local.jueony.nativefinal68review20261017`
- 창 제목: `Jueony Native Final68 Review 20261017`
- 엔진: `cda65172283c6657`, WASM `4a9acaf931b91b967f93b777cf5b987c7e73d23cff0f0a9a9c719b5e244938e9`
- frontend: `apps/editor/evidence/dist-file-lifecycle-verified68`
- 현재 판정: **빌드 완료, GUI 미실행·검수 NOT_RUN**

기존 Native65 recipe를 바탕으로 복제한 Rust 소스에 고유 Cargo bin과 mainBinaryName을 지정했습니다. Windows 의존성 캐시는 재사용했지만 기존 기본 `jueony-editor.exe`를 교체하지 않았습니다. production native 입력9개, 최종 frontend85파일, 기존 검수 exe6개(기본 cache exe 포함)를 빌드 전후 SHA로 대조해 모두 불변임을 확인했습니다. Cargo.lock은 그대로이며 Windows Rust만 `--offline --locked`로 실행했습니다. WSL Cargo, 외부 설치·다운로드, 앱 실행·종료는 수행하지 않았습니다.

기존 앱을 종료하거나 승인된 exe 경로의 파일을 교체하지 않았습니다. 새 exe는 별도 앱 사용 승인이 필요할 수 있으며, 이전 승인 timeout이 해결됐다는 뜻이 아닙니다. 실제 GUI 열기·원본 저장·취소·종료 복구·다른 이름 저장은 root 작업자가 이 새 경로의 exe를 명시적으로 승인받아 따로 확인해야 합니다. 이 단계의 무결성 PASS는 실제 GUI PASS가 아닙니다.

config는 `frontendDist`를 상대 PathBuf로 지정하고 창 URL은 `index.html`입니다. 따라서 과거 Windows 절대경로를 file URL로 오인해 폴더 목록을 띄우던 설정을 재사용하지 않습니다. production의 withGlobalTauri/CSP는 그대로 상속합니다. self/IPC/WASM 허용과 같은 origin의 editor iframe 경계, `main` 창의 compiled allow-close/allow-destroy 권한을 정적으로 확인했습니다. 런타임 확인으로 확대하지 않습니다.

이 exe에는 별도 HTTP/API 서버가 포함되지 않습니다. 기존 Native51/65와 앱 식별자가 달라 예전 검수의 local draft·연결을 자동 이전하지 않습니다. 기존 사용자 문서와 앱 데이터를 가져오거나 고치지 않았습니다.

`build-result.json`, `preparation.json`, `tauri-final68-review.conf.json`, `native-build.log`, `source-capabilities.json`, `compiled-capabilities.json`, before/after SHA 목록을 함께 보관합니다. `node verify-native-build-proof.mjs`는 현재 바이너리/원본/기존 exe의 해시 및 설정/권한만 재검증하며 앱을 실행하지 않습니다. 검수 스크립트는 기존 고유 exe가 있으면 덮어쓰기를 거절합니다.
