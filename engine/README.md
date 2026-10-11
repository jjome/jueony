# 문서 엔진 패치와 검수 빌드

Jueony는 MIT 라이선스의 rhwp `0.8.7`, 커밋 `1a76570e833917d15817415a53c09ad61ab3203f`를 기준으로 사용한다. `upstream/rhwp-source`는 읽기 전용 참조다. 제품 엔진 변경은 `patches/`에 Git 패치로 추적하고, `build/rhwp-engine/source-<입력 해시>` 사본에 적용한다. 원본 저장소를 수정하거나 npm의 공식 바이너리를 덮어쓰지 않는다.

현재 패치는 구역별 기본 탭 간격과 실제 본문 구역 분할을 구현한다. API `insertSectionBreak(sectionIdx, paraIdx, charOffset)`는 논리 글자 단위 좌표를 받고 `{ok, sectionIdx, paraIdx, charOffset, pageCount}`를 반환한다. 전체 문서 snapshot은 UI의 기존 명령 라우터가 소유한다. 개체/필드/범위 태그가 있는 분할 대상, 여러 문단에 걸친 필드, 구역 내부의 중복 구역 정의는 변경 전에 거부한다.

HWPX 저장은 `tabStop`과 `tabStopVal`을 함께 기록한다. 한글의 `HWPUNIT` 값은 raw 거리의 절반이며 0은 기본 `8000/4000`으로 저장한다. 같은 엔진의 왕복만으로는 남은 템플릿 `tabStopVal` 오류를 발견하지 못하므로 실제 ZIP XML 진단과 [한글 실측](../docs/36-native-section-comparison.md)을 함께 사용한다.

`mergeSectionBoundary(rightSectionIdx)`는 뒤 구역의 시작 경계를 제거하고 경계 문단을 결합한다. 앞 구역의 설정을 유지하며 같은 결과 계약으로 이전 본문 끝의 논리 좌표를 반환한다. 경계의 개체/필드/범위 태그/차례 표시, 뒤 구역의 독립 머리말·꼬리말 및 추가 구역·단 정의는 변경 전에 거부한다. Delete/Backspace와 snapshot undo 연결 및 직접 한글 비교 제한은 [35번 결과](../docs/35-section-boundary-merge-result.md)를 따른다.

`table-creation-consistency.patch`는 검증에서 발견한 신규 표의 메모리 IR/저장 기본값 차이를 수정한다. 기존 serializer와 보존 검사는 그대로 유지한다. 최종 검수 범위·결과와 실제 한글 비교 제한은 [34번 결과](../docs/34-sections-tabs-result.md)에 기록한다.

## 재현

```powershell
./scripts/Build-DocumentEngine.ps1 -Runtime Wsl
$env:JUEONY_ENGINE_PACKAGE = '<출력된 pkg 경로>'
$env:JUEONY_BUILD_PROFILE = 'sections-tabs'
cd apps/editor
node scripts/build.mjs
```

WSL Ubuntu에 C 컴파일러, `.tools/linux-rustup`의 Rust 1.93.1/wasm32 타깃, `.tools/linux-cargo`, 공식 wasm-bindgen 0.2.127 Linux 실행 파일이 필요하다. Windows 직접 빌드는 `-Runtime Native`로 선택한다. 이 컴퓨터에서는 Windows 애플리케이션 제어가 Cargo build-script 실행을 차단하므로 WSL 경로를 사용한다. 보안 정책을 해제하지 않는다.

Cargo metadata와 build 모두 `--locked`로 실행한다. WSL 캐시는 Linux `/tmp/jueony-rhwp-engine/target/pr-review`를 사용한다. 기본 경로의 사본과 입력 해시를 재사용하며 다른 작업의 캐시를 초기화하지 않는다. 현재 빌드는 Rust release + web binding의 **검수용 비최적화 WASM**이며 upstream의 Docker/wasm-opt 배포 관문을 대신하지 않는다.

`jueony-engine-build.json`은 기준 커밋, 모든 패치 해시, 실제 JS/WASM 해시와 빌드 방식을 기록한다. 프런트엔드 빌드는 이 해시를 확인하고 바뀐 패치가 있으면 재빌드를 요구한다. 환경변수를 생략하면 공식 npm WASM을 사용하고 새 탭 대화상자 패치를 적용하지 않는다. 구역 분할 명령은 실제 API가 있을 때만 활성화된다.

## 라이선스와 검증 경계

rhwp 원문의 MIT 고지와 별도 third-party 고지를 유지한다. 변경한 엔진에도 같은 라이선스 조건이 적용된다. 개발 도구는 실행 묶음에 포함하지 않는다. 엔진 코드를 컴파일한 사실, 구조·저장 왕복, 한컴의 실제 저장·인쇄·시각 일치는 서로 다른 검증이다. 새 조판 golden을 독립 한컴 출력 없이 추가하거나 테스트 통과만으로 한글 2024와 같다고 판정하지 않는다. 최종 실행 결과는 프로젝트의 작업 결과 문서에 별도로 기록한다.
