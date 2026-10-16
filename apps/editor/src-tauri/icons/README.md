# Windows 검수 앱 아이콘

`icon.ico`는 `scripts/generate-native-icon.mjs`로 만든 자체 기하학적 문서/J 표시다. 외부 그림·폰트는 사용하지 않는다. Windows Tauri 리소스 생성에 필요한 기본 경로를 제공한다.

프로젝트 루트에서 `node scripts/generate-native-icon.mjs --check`로 소스와 바이트 일치를 검사한다. 다시 생성할 때는 `--check`를 생략한다. 이 아이콘은 Windows 실행 파일 리소스이며 편집기·Agent 기능의 완료 상태를 나타내지 않는다.
