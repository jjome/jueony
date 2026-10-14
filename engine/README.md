# 문서 엔진 패치와 검수 빌드

Jueony는 MIT 라이선스의 rhwp `0.8.7`, 커밋 `1a76570e833917d15817415a53c09ad61ab3203f`를 기준으로 사용한다. `upstream/rhwp-source`는 읽기 전용 참조다. 제품 엔진 변경은 `patches/`에 Git 패치로 추적하고, `build/rhwp-engine/source-<입력 해시>` 사본에 적용한다. 원본 저장소를 수정하거나 npm의 공식 바이너리를 덮어쓰지 않는다.

현재 패치는 구역별 기본 탭 간격과 실제 본문 구역 분할을 구현한다. API `insertSectionBreak(sectionIdx, paraIdx, charOffset)`는 논리 글자 단위 좌표를 받고 `{ok, sectionIdx, paraIdx, charOffset, pageCount}`를 반환한다. 전체 문서 snapshot은 UI의 기존 명령 라우터가 소유한다. 개체/필드/범위 태그가 있는 분할 대상, 여러 문단에 걸친 필드, 구역 내부의 중복 구역 정의는 변경 전에 거부한다.

HWPX 저장은 `tabStop`과 `tabStopVal`을 함께 기록한다. 한글의 `HWPUNIT` 값은 raw 거리의 절반이며 0은 기본 `8000/4000`으로 저장한다. 같은 엔진의 왕복만으로는 남은 템플릿 `tabStopVal` 오류를 발견하지 못하므로 실제 ZIP XML 진단과 [한글 실측](../docs/36-native-section-comparison.md)을 함께 사용한다.

`mergeSectionBoundary(rightSectionIdx)`는 뒤 구역의 시작 경계를 제거하고 경계 문단을 결합한다. 앞 구역의 설정을 유지하며 같은 결과 계약으로 이전 본문 끝의 논리 좌표를 반환한다. 경계의 개체/필드/범위 태그/차례 표시, 뒤 구역의 독립 머리말·꼬리말 및 추가 구역·단 정의는 변경 전에 거부한다. Delete/Backspace와 snapshot undo 연결 및 직접 한글 비교 제한은 [35번 결과](../docs/35-section-boundary-merge-result.md)를 따른다.

`table-creation-consistency.patch`는 검증에서 발견한 신규 표의 메모리 IR/저장 기본값 차이를 수정한다. 기존 serializer와 보존 검사는 그대로 유지한다. 최종 검수 범위·결과와 실제 한글 비교 제한은 [34번 결과](../docs/34-sections-tabs-result.md)에 기록한다.

## 재현

`document-insertion.patch`는 `insertDocumentBytes(sectionIdx, paraIdx, charOffset, bytes)`를 추가한다. 단일 구역 원본의 본문·표·그림을 기존 외부 문서 이식 경로로 옮기며 대상 쪽 설정을 유지한다. 원본의 지원 컨트롤·참조·크기를 변경 전에 검증한다. HWPX 그림의 HWP 저장 종류 비트와 빈 대상 문단의 스타일 이식을 보완한다. 파일 선택·사본 검사·한 번 undo·실제 한글 재열기 결과와 제한은 [42번 결과](../docs/42-document-insertion-result.md)를 따른다. 실제 native API가 없는 기본 npm 엔진에서는 명령을 활성화하지 않는다.

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

`style-reference-deletion.patch`는 스타일 삭제 후 본문뿐 아니라 표/중첩 문단·개체/특수 story·바탕쪽의 스타일 참조를 함께 보정한다. 삭제된 연결은 0으로, 뒤 ID는 하나 낮춘다. 기존 문단의 직접 모양과 텍스트는 변경하지 않는다. 브라우저 편집/undo와 독립 중첩 XML 검사 결과 및 모양 전파 제한은 [43번 결과](../docs/43-style-management-result.md)에 기록한다.

2026-10-13 후속 패치는 다음 계약을 추가한다. [통합 구현과 검증 범위](../docs/44-editor-stages-result.md)를 함께 확인한다.

- `style-reference-order.patch`: `moveStyle(from, to)`로 정의와 모든 문단 트리의 참조·다음 스타일 번호를 함께 재배치한다. ID 0은 고정한다.
- `style-shape-stories.patch`: 정의 변경 때 특수 문단 트리에도 모양을 전파하고 직접 서식은 유지한다. `styleShapeStoriesEnabled()`로 adapter가 지원 여부를 확인한다.
- `page-border-entries.patch`: `getPageBorderFillEntry(section, kind)`와 `setPageBorderFillEntry(section, kind, json)`로 both/even/odd 설정, 첫 쪽 표시, 두 색 그러데이션을 처리한다. 공유 자원은 복사하며 구역 첫 쪽 표시와 홀짝 선택을 조판·렌더링에 반영한다. 머리말/꼬리말 포함 플래그의 저장 보존은 가능하지만 실제 배치 계산은 아직 지원하지 않는다.
- `border-fill-identity.patch`: 배경색뿐 아니라 무늬·그러데이션·그림·투명도 전체를 비교하여 다른 채우기를 같은 자원으로 합치지 않는다.
- `note-query-json.patch`: 각주/미주 텍스트 조회에서 탭·줄바꿈·제어문자를 JSON 규칙대로 이스케이프한다.
- `merged-table-transpose.patch`: 기존 `transposeTableCellsInPlace`를 병합 표로 확장한다. 전체 격자의 겹침·누락·span·보호·반복 제목행을 변경 전에 검사한다. 셀의 모든 문단/직접 서식과 영역 배경을 함께 옮기며 row_sizes와 격자를 재구축한다. 전체 너비 안에서 새 열 너비를 분배하므로 원래 지면과 동일한 크기 정책은 별도 검증 대상이다. 선택 블록의 행/열 바꿈 복사 기능에는 이 확장을 적용하지 않는다. 최신 검수 엔진은 `source-1b04490267c6bf57/pkg`이며 결과와 제한은 [48번 연속 구현](../docs/48-advanced-editor-continuation.md)을 따른다.
- `page-border-inclusion.patch`: 본문 기준 쪽 테두리에서 attr의 머리말/꼬리말 포함 비트를 renderer와 getPageInfo에 반영한다. 종이 기준 좌표는 바꾸지 않는다. `pageBorderInclusionEnabled()`로 지원 여부를 노출한다. 포함 범위·전체/새 구역 적용 검수 엔진은 `source-7faba1e743412dab/pkg`이며 [49번 결과](../docs/49-page-border-inclusion-and-scope.md)를 따른다.
- `page-border-region.patch`: 테두리와 배경이 같은 좌표 계산을 사용한다. `fillArea=border`에서 종이 전체를 채우던 경로를 실제 테두리 영역으로 교체하고 종이 바깥 영역은 잘라낸다. `pageBorderFillAreaEnabled()`로 새 엔진의 지원 여부를 노출한다. 쪽 영역은 머리말/꼬리말 포함과 무관한 본문 영역을 유지한다. 결과와 선 두께·특수 조판 제한은 [50번 결과](../docs/50-page-background-region.md)를 따른다.
- `page-border-z-image.patch`: 임베드 PNG/JPEG 등록과 쪽 배경 참조·배치·효과·화면 기준 밝기/대비 편집을 추가한다. 전용 byte reader로 감춰진 배경도 저장 전후 검사한다. 기존 자원 등록 규칙을 재사용하고 새 자원의 실제 디코딩과 크기를 변경 전에 검증한다. HWP의 비율 유지 배경 맞춤은 저장 왕복이 달라 UI에서 비활성화한다. [51번 구현](../docs/51-picture-background-and-paper-scope.md)에 적용 범위와 제한을 기록한다.
- `master-page-editing.patch`: 기본 텍스트 바탕쪽의 조회·생성·수정·삭제와 양쪽/홀짝 조판을 제공한다. 균일 기존 서식은 유지하고 복잡한 바탕쪽은 거절한다. HWP는 보존 가능한 종류 조합만 허용한다. 검수 엔진 `source-b5764245b2c033bb/pkg`, 적용 범위와 제한은 [52번 결과](../docs/52-master-page-basic-editing.md)를 따른다.
- `zz-line-number-settings.patch`: HWPX 구역 줄 번호와 문단 제외 값의 IR·파싱·저장 보존, 기본 가로/한 단 본문 번호 렌더링을 추가한다. HWP 바이너리 매핑은 추측하지 않으며 유실되는 내보내기는 앱 보존 검사에서 거절한다. 검수 엔진 `source-c1cfb65fcfbbea50/pkg`, 제한과 결과는 [53번 구현](../docs/53-basic-line-numbers.md)에 기록한다.
- `zzz-page-body-delete.patch`: 실제 페이지네이션의 완전한 본문 문단 범위만 지우고 첫 문단의 구역/단 정의를 재연결한다. 걸친 문단과 복합 구역은 변경 전에 거절하며 마지막 구역 문단은 비워 유지한다. 검수 엔진 `source-a9cbdd94c8aad084/pkg`, 결과와 제한은 [54번 구현](../docs/54-complete-body-page-deletion.md)을 따른다.

rhwp 원문의 MIT 고지와 별도 third-party 고지를 유지한다. 변경한 엔진에도 같은 라이선스 조건이 적용된다. 개발 도구는 실행 묶음에 포함하지 않는다. 엔진 코드를 컴파일한 사실, 구조·저장 왕복, 한컴의 실제 저장·인쇄·시각 일치는 서로 다른 검증이다. 새 조판 golden을 독립 한컴 출력 없이 추가하거나 테스트 통과만으로 한글 2024와 같다고 판정하지 않는다. 최종 실행 결과는 프로젝트의 작업 결과 문서에 별도로 기록한다.

`zzzzzzzzzzzz-agent-paragraph-tabs.patch`는 일반 본문 문단의 기본 사용자 탭에 private 원본 토큰·attr/예약 바이트/추가 데이터·위치/정렬/채움 검사를 추가한다. 현재 API는 `getAgentParagraphTabs`/`setAgentParagraphTabs`이며 지원 여부만 모델에 전달한다. 표/필드/실제 탭/혼합·고급 원본은 유지한다. 기존 빈 CTRL_DATA 슬롯과 실제 payload를 구분한다. 검증 결과와 제한은 [74번 문서](../docs/74-agent-paragraph-tabs.md)를 따른다.

`zzzzzzzzzzzzz-agent-paragraph-decoration.patch`는 기본 본문 문단의 네 방향 실선/없음·단색 배경·간격/연결 속성을 Native 원본 토큰으로 검사한다. 알려진 비활성 대각선 선모양과 색 없음/빈 winBrush는 복제·유지하며 요청 밖 BF 필드를 대조한다. 공유 자원을 원위치에서 수정하지 않고 고급 효과/알 수 없는 원본을 거절한다. 결과와 제한은 [75번 문서](../docs/75-agent-paragraph-decoration.md)를 따른다.
