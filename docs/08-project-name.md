# 프로젝트 이름 변경

2026-10-09 사용자 수정에 따라 `joouni` / `Joouni`를 `jueony` / `Jueony`로 변경했다.

| 항목 | 변경된 이름 |
| --- | --- |
| 제품 표시 이름 | Jueony 문서 편집기 |
| Node / Rust 패키지 | `jueony-editor` |
| Tauri 식별자 | `local.jueony.editor.preview` |
| 실행 진입점 | `Start-Jueony.cmd` |
| 실행 / 빌드 스크립트 | `scripts/Start-Jueony.ps1`, `scripts/Build-Jueony.ps1` |
| 실행 묶음 | `build/jueony-preview/JueonyEditor.exe` |
| 프로젝트 폴더 변경 목표 | `C:\Users\jjome\Documents\work\jueony` |

화면, CSS, 내부 메시지와 호스트 API, 빌드 출력과 문서를 함께 변경했다. 이전 검증 기록의 경로·해시·스크린샷과 참조 저장소는 당시 증거이므로 수정하지 않았다. 변경 전에 열어 둔 부모 창이 새 문서의 저장 상태를 인식하도록 `joouniEditor`와 이전 메시지 이름 두 개는 호환 별칭으로 유지한다. 기존 rhwp 브라우저 저장 데이터는 그대로 사용한다.

## 실제 폴더 변경 마무리

초기 자동 변경은 Windows의 폴더 사용 잠금으로 거부되었다. 이후 사용자가 폴더 변경을 완료했으며, 2026-10-09 `C:\Users\jjome\Documents\work\jueony`에서 실제 파일과 Git 이력을 확인했다. 아래 절차는 당시의 복구 안내로 보존한다.

1. 편집 문서를 저장하고 Codex 및 해당 폴더를 사용하는 편집기·터미널 창을 닫는다.
2. 현재 폴더의 `Rename-Folder-to-Jueony.cmd`를 더블클릭한다. 전체 폴더를 같은 상위 경로의 `jueony`로 바꾸며, `.git`, 참조 저장소, 로컬 변경 파일도 함께 이동한다. 목적지가 이미 있으면 덮어쓰지 않고 중단한다.
3. 성공 후 `C:\Users\jjome\Documents\work\jueony\Start-Jueony.cmd`로 실행한다.
4. Codex의 프로젝트 메뉴 → **Edit project**에서 새 폴더를 지정하고 새 대화를 시작한다. [공식 프로젝트 안내](https://learn.chatgpt.com/docs/projects)에 따르면 기존 대화는 기록된 작업 디렉터리를 유지하므로, 표시 이름 수정만으로 기존 대화의 경로가 바뀌지는 않는다.

프로젝트 이름 변경 후 프런트엔드 빌드·타입 검사, 편집기 테스트 8개, Rust 실행기의 HTTP 검사 13개를 통과했다. 실제 루트 폴더 이동 후의 실행은 폴더 잠금 해제 후 추가 확인이 필요하다.
