# 주니 문서 편집기 개발판

한글 2024 Windows 편집기의 화면과 동작을 재현하는 작업용 앱이다. 현재는 rhwp 0.8.7의 Rust/WASM 엔진과 Studio 편집 화면을 기반으로 실행되며 **한글 2024 전체 기능 또는 문서 호환성 100%를 검증한 제품이 아니다.**

## 실행

프로젝트 루트에서 PowerShell로 실행한다.

```powershell
.\scripts\Start-Editor.ps1
```

Chrome 또는 Edge의 독립 창으로 열린다. 웹 서버는 `127.0.0.1:4173`에만 바인딩된다. 이 창의 문서 처리는 로컬 WASM에서 수행하며 외부 Studio 사이트를 호출하지 않는다. 현재 빌드의 WASM과 글꼴은 `dist` 안에 있다. 인터넷 없는 실행에는 이 빌드 결과, Node.js와 브라우저가 필요하다. 전체 OS 수준 네트워크 차단 검수는 별도다.

**현재 실행 경로의 저장은 브라우저 다운로드다.** 원본을 자동 덮어쓰지 않으며 저장 파일은 브라우저 다운로드 위치에서 확인한다. 다른 이름으로 저장에서 파일 이름을 지정할 수 있다. 네이티브 파일 대화상자와 Rust 파일 저장 서비스는 `src-tauri`에 구현했지만, 현재 PC의 애플리케이션 제어 정책이 Rust 빌드 프로그램 실행을 차단하여 아직 실행 검증하지 못했다.

## 포함한 변경

- 한글 2024 기준 탭별 기본 도구 상자, 공통 서식 줄, 파일 동작 버튼, 현재 문서 표시.
- 기존 rhwp의 문서·표·서식·되돌리기 엔진과 같은 명령 경로를 사용.
- 공식 `@rhwp/core@0.8.7` WASM, Studio 소스, 글꼴·자산을 로컬 번들에 포함.
- Rust 파일 서비스: 선택한 파일만 토큰으로 접근, 임시 파일 후 교체, 외부 변경 검사, 저장 오류 시 원본 보존.
- 네이티브 저장용 문서 버전 검사와 저장 중 입력 차단. 실제 WebView2 검증은 대기.
- 파일 대화상자 실패 후 다운로드로 우회하지 않도록 변경.

## 개발

참조 소스는 `../../upstream/rhwp-source`에 있고, 빌드는 `.build/studio`에 사본을 만들어 변경한다. 참조 저장소의 tracked 파일은 수정하지 않는다. 기본 커밋이 달라지거나 소스 패치 기준이 맞지 않으면 빌드를 중단한다.

```powershell
npm ci
npm run build
npm run preview
# 프로젝트 루트에서 네이티브 빌드: .\scripts\Build-Editor.ps1 -Native
```

`package-lock.json`과 `src-tauri/Cargo.lock`을 유지한다. `dist/build-evidence.json`에 기준 커밋과 공식 WASM 해시를 기록한다. 현재 엔진은 공식 배포 WASM을 쓰며 Rust 문서 엔진을 여기서 다시 컴파일한 것은 아니다.

## 검증 한계

현재 소스에는 upstream 편집기의 미지원·부분 지원 기능도 포함되어 있다. 메뉴가 존재하는 것과 한글 2024와 같은 동작이 검증된 것은 별개다. 보안 탭은 미연결 상태를 표시한다. 여러 문서를 동시에 관리하는 탭, 모든 상황별 도구 상자, 전체 대화상자 정합성, 인쇄 정합성과 실제 Windows IME 조합 입력은 추가 검증이 필요하다.

기본 저장물은 `evidence`에 모아 실제 한글에서 검사한다. rhwp 자체 재열기를 실제 한글 검수로 기록하지 않는다. 설치된 한글 2024 Viewer와 편집 가능한 한글 제품의 검수도 구분한다.

## 저작권과 라이선스

rhwp 소스와 자산의 기존 고지는 [LICENSE.rhwp.txt](LICENSE.rhwp.txt), 원본 `THIRD_PARTY_LICENSES.md`, `assets/fonts/FONTS.md` 및 각 개별 고지를 따른다. 빌드 결과에도 원본 고지를 복사한다. 한컴의 프로그램 소스나 상용 글꼴·아이콘을 추출해 사용하지 않았다. 참고한 화면 구조는 [한글 2024 공식 도움말](https://help.hancom.com/hoffice130/ko-KR/Hwp/hwpbase/screen.htm)과 [도구 상자 설명](https://help.hancom.com/hoffice130/ko-KR/Hwp/view/toolbar/toolbar.htm)이다. 제품 배포용 전체 third-party notices는 배포 구성 확정 뒤 작성한다.
