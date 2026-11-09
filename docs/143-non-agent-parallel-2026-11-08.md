# AI·참고 검색 제외 병렬 구현 기록 (2026-11-08)

이 문서는 AI 연결·Agent 실행과 참고 자료·검색·RAG를 제외한 편집기 병렬 작업의 검증 기록이다. 아래 항목은 제한된 범위만 완료로 표시하고 상위 N 작업은 남은 기능 때문에 `부분`으로 유지한다.

## 검증된 묶음

| 항목 | 구현·보호 범위 | 검증 | 남은 제한 |
|---|---|---|---|
| N011 | portable v1 언어별 글꼴·충돌 이름·다음 스타일 순환·문단 TabDef/기본 BorderFill과 basic character BorderFill의 원본 자원 인증·이식·실패 전체 롤백 | `7db995bd` basic character BorderFill HWP/HWPX 가져오기·저장·재열기·보존 보호 6/6; complete 번호/개요 graph 감사에는 코드 변경 없음 | **부분 유지·명시 차단:** 고급 BorderFill·번호/개요 complete definition graph Rust/WASM 포트·특수 영역·UI·Agent·한글 비교 |
| N013 | 기관 프로필 v1 검증·portable profile/package JSON UI import/export·CAS/rollback과 빈 새 문서 stored-time typed warning·evidence·acknowledgement·stale 차단 | `4ac67c16` 공식 npm WASM·실제 격리 Edge DOM 1/1: 경고/확인란·미확인 차단·확인 후 정확히 1회 적용·stale 재차단·nonblank 무경고, 외부/page/console/missing 0; 기존 custom 엔진 14/14·build 678 modules | **부분 유지:** 실제 앱 shell 메뉴 진입·한글 비교·Agent 연결 |
| N014 / G091 | 단일 root Rectangle의 logical textbox story와 top-level group 커서·선택을 exact owner/type/properties/geometry 및 공개 HWP/HWPX document graph fingerprint로 적용 전후 감사하고 restore readback을 확인 | `6c4f0dd3` object family 19/19: HWP/HWPX fingerprint·exact owner/type/properties/geometry·restore readback·lying callback rollback | **부분 유지:** nested/caption owner path restore port 부재·앱 재시작·한글 비교 |
| N015 | root vector shape 2~32개·중첩 group·embedded 이미지 2개 이상과 root 수식 2개 이상의 ordered selection·활성 개체·수식 속성·host/document private SHA 지문·stale 차단을 SessionCursor/Studio capture·restore wire에 연결 | 선택 검증 36/36·actual custom engine 수식 HWP/HWPX 저장·재열기·bytes invariant | **부분 유지:** 단일·mixed·nested 수식·OLE·table은 fail-closed; OLE payload typed property API와 table multi-restore port 없음·실제 앱 재시작·한글 비교 |
| N016 | root-body/table-cell 복원 계약에 nested table-cell depth 1~8의 nonempty ClickHere exact full selection을 전체 owner chain으로 순방향·역방향 복원 | `b096acda` 신규 nested 10/10·root 회귀 29/29·관련 묶음 42/42 | **부분 유지:** partial/empty/caption/overlap/기타 field·nested/caption object·실제 앱 재시작·한글 직접 비교 |
| N017 | read-only diagnostic→typed startup gate→memory-only activation→read-only runtime facade를 연결해 값 복사와 scope/backup projection만 노출하고 blocked/unknown key는 fail-closed | N015/N017 공동 선별 검사를 포함한 28/28·strict TypeScript·모듈 경계 diagnostics 0 | **부분 유지:** 실제 shell boot 주입·UI/facade consumer migration·Windows/한글/origin/DPI 수명 실측 미연결 |
| N020 | 증거 수집→정책→최대 1회 refresh→activate→post evidence 재검증→semantic input의 fail-closed coordinator | 정책·coordinator 19/19·strict TypeScript 통과 | **부분 유지:** 실제 host/Computer Use 관찰·실행 경로 미연결·실제 한글 대화상자 재검증 미실행 |
| N018 | 실제 upstream EventBus callback을 continuity 정책과 capability gate에 연결하되 exact top recipe producer·atomic state read/apply·동일 token event payload·verified save transition이 없으면 state-uncertain으로 차단 | 코드 변경 없이 fail-closed 선별 21/21; `clear(wasm)` snapshot release 경계 확인 | **부분 유지·명시 차단:** 실제 InputHandler/CommandHistory의 exact top recipe producer/read/apply/event payload/save transition 포트와 runtime/process restart 통합 미연결 |
| N007 | 반복 제목행 경계와 비병합 연속 제목 구간 index 0에서 삽입·삭제하고 제목/본문 분류·행 span·셀 값·원본 구조를 재검증 | `d0a04fcd` 새 기능 추가 없이 기존 지원을 증명: HWP/HWPX 재열기·exact undo/redo·insert/delete proof·save rollback 15/15 | **부분 유지:** crossing span은 rowSpan>1 병합으로 fail-closed·필드·그림/개체·병합/복합 주 셀 삭제·한글 비교 |
| N006 | 위/아래와 Left/Right 중첩 표 캡션에서 full path·원문·revision·live/portable geometry를 재검증하고 동일 Unicode scalar 길이 multi-run의 UTF-16/scalar 경계·서식·배치를 보존 | `e67ca6ee` custom engine HWP/HWPX 저장·재열기·undo/redo 18 pass·1 expected skip | **부분 유지:** 캡션 생성·일반 길이 변화·field/bookmark/object·실제 앱·한글 직접 비교 |
| N004 | 10pt 1→2줄 혼합 그림·필드 셀의 source/run/cursor offset 일치·가운데 정렬 재조판·실패 시 exact rollback | HWP/HWPX 네이티브 저장·재열기·undo/redo·4개 fault rollback 및 Edge 실제 편집→bound-save→UI 재열기 | 임의 필드 경계·중첩 셀·복합 개체·한글 비교 |
| N012 | 저장 글자 스타일과 직접 서식 타입 분리·stored character-style reference capture·UI 적용 시점 재해석·stale/race fail-closed·정의 변경 재열기 전파 | `66ab2768` UI stored-time 소비 경계 9/9·격리 build 673 modules | **부분 유지:** 실제 브라우저 UI·한글 비교·Agent 연결 |
| N021 | exact header/footer/footnote/endnote/textbox story에서 upstream/registry 계약으로 증명한 undo·redo·goto·select-all·save만 허용하고 unknown과 나머지 본문/파일/보기/서식 명령은 fail-closed | `1ec65059` 전용 25/25·전체 선택 묶음 61/61·strict TypeScript·module boundaries diagnostics 0 | **부분 유지:** 실제 앱·한글 비교·나머지 명령 story 의미·쪽 번호/매크로 pending·혼합 run |
| N023 | `0e48110b` 기준 실제 통합 메뉴 DOM을 visual viewport의 CSS 좌표로 경계 제한하고 DPR 이중 적용 없이 좁은 화면·resize·scroll에 재배치 | 실제 Edge 157에서 DPR 1.25/1.5/2.0·narrow·resize·visualViewport scroll·pageScale 1.5의 6 scenarios PASS; page/console/external/missing 0 | **부분 유지:** 실제 Windows OS DPI·다중 모니터·native 좌표·한글 비교 미검증 |
| N041 | 자체 생성한 본문·명시 글꼴, 2쪽 경계·용지, 표·셀, 내장 PNG, 본문 누름틀의 5종 manifest를 HWP/HWPX 입력 10개로 만들고 open→같은 형식 save→reopen; production preservation evidence·published layout 0.2 허용치·기능 최소조건·입력 SHA 불변을 fail-closed 검사 | custom Rust/WASM `source-c932adab64d8bc4e`에서 10/10·manifest 계약/위조 거절 3/3·구문/diff 검사 통과 | **부분 유지:** 같은 엔진의 합성 문서 기술 검수이며 실제 한글 2024 화면·인쇄·복구 경고, 기관 실문서·공개 문서 코퍼스 독립 비교는 미실행 |
| N042 | 같은 글꼴·DPI·용지와 실제 page definition을 봉인한 published layout baseline에서 쪽 수·텍스트 재조판·개체 위치 차이를 분류하고 교차 생산자·글꼴 SHA-256이 없으면 차단 | 계약 4/4·2쪽 표/그림/필드 복합 HWP/HWPX baseline 2/2 | **부분 유지:** Jueony 엔진 baseline일 뿐 실제 한글 2024·PDF raster·인쇄 드라이버·실제 글꼴 바이너리 비교는 미실행 |
| N043 | preflight→temp write/flush→final probe/revalidate→atomic compare-replace/readback coordinator와 race replace 0회·실패 cleanup·committed 후 `save-state-uncertain`/reopen 분류 | 정책·coordinator 15/15·strict TypeScript 통과 | **부분 유지:** 실제 Windows picker·ACL·identity 수집과 Rust/Tauri host 원자 교체/readback·실파일 Windows 검증 미연결 |
| N044 | 별도 v1 checkpoint·IndexedDB CAS와 document lifecycle을 실제 설치 Edge 157 격리 IndexedDB에서 commit·strict transaction complete·CAS conflict·blocked/versionchange fail-closed 분류까지 검증 | 실제 Edge 3 scenarios PASS·page/console/external/missing resource 모두 0 | **부분 유지:** 실제 app boot/shell 주입·Tauri/Windows 비정상 종료·사용자 문서 복구 미연결 |
| N045 | 빌드 입력의 CDN font literal 256개를 제거하고 로컬 WASM·런타임·폰트·third-party notices·hash·외부 URL을 fail-closed 감사 | `41b44529` 격리 build 673 modules; dist 외부 endpoint가 5개로 감소 | **부분 유지·FAIL/배포 차단:** AI 영역 제외·기관 allowlist·WebView2 포함 최종 설치본·고지 합본 검수 필요 |
| N005 | 보이지 않는 0길이 이웃 ClickHere의 셀 분할 이동을 앱·Rust에서 차단하고 guide-only 0길이 필드는 유지 | HWP/HWPX 저장·재열기 2/2·관련 회귀 32/32 | 겹친 필드·개체 혼합 셀·캡션 내부 필드·한글 비교 |
| N011 추가 | 문단 테두리 동작 플래그 `borderConnect`·`borderIgnoreMargin`의 portable style 교환·전체 롤백 | HWP/HWPX 가져오기→저장→재열기 2/2 | TabDef·실제 BorderFill·배경·간격·UI·한글 비교 |
| N011 추가 | portable v1 문단 사용자 TabDef와 기본 없음/실선 BorderFill·없음/단색 배경·네 방향 간격을 엄격 검증하고 원본 참조 인증 뒤 이식; 실패 전체 snapshot 복원 | 최신 검수 엔진의 HWP/HWPX 저장·재열기·exact-byte undo·stale ID 불변·중간 실패 rollback 3/3 | **부분 유지:** 글자 스타일 BorderFill·번호/개요·점선/무늬/그러데이션/그림/3D/대각선/투명도·특수 영역·UI·Agent·한글 비교 |
| N011 조사 | 문서별 번호/개요 complete definition portability를 최신 custom Rust/WASM read/write API에서 재감사 | 코드 변경 없음·기존 basic character BorderFill 회귀 6/6 | **명시 차단·부분 유지:** `getAgentNumberingDefinitions`는 id·editable·startNumbers만, `cloneAgentNumbering`은 동일 문서 전용, `createNumbering`은 levelFormats·numberFormats·startNumber만 쓰는 축약 생성, `getAgentOutlineDefinition`은 definitionId만 제공한다. 전체 7-level head와 level start/format, CharShape·font·BorderFill graph 인증 export, target resource/ID remap·충돌 정책, section outline binding, 원자 import/rollback과 HWP/HWPX readback 포트가 필요하다. |
| N012 추가 | Studio 스타일 적용 seam에서 stored character-style reference를 먼저 캡처해 기존 검증된 적용 함수에 전달; 숫자 style ID 직접 전달 회귀와 patch drift 차단 | 관련 테스트 8/8·격리 build 663 modules·해당 프로필 TypeScript 검사 통과 | **부분 유지:** 실제 UI 동작 검수·Agent 연결·한글 비교 |
| B031 | root-body 일반 문단의 `pghd` PageHide 조판 부호 한 종류를 위치·원문·revision·전체 문서 보존 상태 재검증 뒤 삭제하고 실패 시 snapshot 복원 | HWP/HWPX 저장·재열기·undo·stale/보호 실패 불변 4/4 | **부분 유지:** 다른 조판 부호·특수 story·종류별 UI·한글 비교 |
| N022 | 설치 한글 저장 증거 기준 Ctrl+F7 양쪽 여백 증가·Ctrl+F8 감소와 공개 표 차이 감사 | 문단 여백·IME·navigation 회귀 37/37·TypeScript compile | 공개 표와 설치본 차이의 근본 원인·한글 재비교 |
| N006 | 위/아래와 Left/Right 중첩 표 캡션을 full path·원문·revision·live/portable geometry 재검증 후 동일 Unicode scalar 길이 multi-run으로 교체 | `e67ca6ee` HWP/HWPX 저장·재열기·undo/redo 18 pass·1 expected skip | **부분 유지:** 캡션 생성·일반 길이 변화·field/bookmark/object·실제 앱·한글 비교 |
| N013 추가 | 프로필·항목·slot 계획·문서 style ID를 고정한 순수 preview와 snapshot apply controller | HWP/HWPX 저장·재열기·stale/충돌/중간 실패 복구 포함 9/9 | 전역 단축키 설정 저장·실제 UI·Agent·한글 비교 |
| N019 | 메뉴·리본·빠른 도구·문맥 메뉴의 정적 reachability 감사와 `insert:comment`·`insert:para-band` native API/durable model/atomic history/HWP·HWPX 재열기 증거의 fail-closed capability gate | 신규 gate 5/5·기존 N019 감사 5/5·strict TypeScript 통과 | **부분 유지:** 실제 native API·durable model·undo/HWP·HWPX adapter와 Studio CommandDispatcher 연결·동적 disabled 정책·한글 비교 |
| N006 추가 | 최대 32문단의 위/아래 중첩 표 캡션에서 명시한 문단 하나를 경로·원문·revision·전체 문단 서식 재검증 후 교체 | HWP/HWPX 저장·재열기·undo 포함 5/5·회귀 4/4 | 빈 문단·혼합 글자 서식·좌우 캡션·필드·책갈피·개체 |
| N013 추가 | preview 증거를 재검증하는 원자적 번호키 설정 저장·손상/상위 버전/쓰기 후 실패 복구 | 저장 adapter 5/5·TypeScript compile | 실제 UI와 keymap 소비·Agent·한글 비교 |
| N021 추가 | Ctrl+-로 일반 본문 단일 문단·단일 char-run의 직접 서식을 문단 스타일 정의로 복원 | HWP/HWPX 저장·재열기·undo/redo 포함 14/14·TypeScript compile | 쪽 번호·매크로 pending·셀/특수 story·혼합 run·한글 비교 |
| N006 추가 | 기존 위/아래 캡션의 정확히 하나인 빈 문단을 검증된 path·문단/글자 서식으로 채움 | HWP/HWPX 저장·재열기·undo 포함 8/8·회귀 4/4 | 캡션 생성·여러 빈 문단·좌우·혼합 서식·필드·개체 |
| N013 추가 | 저장된 번호키 profile을 현재 catalog digest·ID·이름·종류·source에 맞춰 read-only resolve | HWP/HWPX 재열기 후보·bytes 불변·stale/충돌 포함 3/3 | post-apply digest 생산 연결·실제 keymap/UI·Agent |
| N021 조사 | Ctrl+N,P 쪽 번호 매기기와 기존 새 번호 시작 명령을 구분하고 현재 API 부재 확인 | 단축키 회귀 11/11·코드 무변경 | Rust PageNumberPos 원자 API·WASM bridge·대화상자·명령 연결 |
| N006 추가 | 단일 캡션 문단의 연속 2~128개 글자 run을 동일 길이 BMP 텍스트로 교체하고 기존 run 경계·charShapeId·위치·인접 중첩 표 배치를 보존 | 기본 엔진 fail-closed 2/2·Jueony 패치 엔진 HWP/HWPX 저장·재열기·undo 10/10·회귀 4/4·TypeScript compile | 길이 변화·surrogate/emoji·제어문자·좌우 캡션·필드·책갈피·개체 |
| N006 추가 | 다중 빈 캡션 문단과 Left/Right 중첩 캡션에서 exact path/source/revision/style/run 및 live/portable geometry가 검증된 대상을 동일 Unicode scalar 길이의 BMP 또는 emoji 텍스트로 바꾸고 UTF-16/scalar run 경계와 재조판을 보존 | `e67ca6ee` custom Rust/WASM HWP/HWPX 저장·재열기·undo/redo 18 pass·1 expected skip | **부분 유지:** 캡션 생성·일반 길이 변화·필드·책갈피·개체·실제 앱/한글 |
| N013 추가 | 정확한 빈 새 문서와 stored-time fingerprint·created/modified 상태를 mutation 전에 봉인하고 official capability unavailable도 typed warning과 확인란으로 노출해 미확인 적용과 stale evidence를 차단한다. | `4ac67c16` 공식 npm WASM·실제 격리 Edge DOM 1/1, 확인 후 apply 정확히 1회·nonblank 무경고·외부/page/console/missing 0; 기존 custom 회귀 14/14·build 678 modules | **부분 유지:** 실제 앱 shell 메뉴·한글 비교·Agent 연결 |
| N016 추가 | nested table-cell depth 1~8의 nonempty ClickHere exact full selection을 전체 owner chain으로 순방향·역방향 복원하고 partial·empty·caption·overlap·다른 field는 fail-closed | `b096acda` 신규 10/10·root 회귀 29/29·관련 묶음 42/42 | **부분 유지:** nested/caption object·그 밖의 field·실제 앱 재시작·한글 직접 비교 |
| N013 추가 | import 후 현재 catalog digest와 style ID·이름·종류·source를 원자적 shortcut 설정에 결합하고 저장 단계별 실패 상태를 rollback/applied/disconnected로 구분 | HWP/HWPX 재열기 consumer 연결과 실패 복구 14/14·TypeScript compile | 실제 keymap/UI·Agent·한글 비교 |
| N021 조사 | 한글 스크립트 매크로와 기존 AI 명령 템플릿을 구분하고 Studio command/input recording 계약 부재 확인 | 단축키 회귀 11/11·코드 무변경 | dispatcher 성공 이벤트·IME/선택 기록·recordable capability·revision preflight·단일 undo/부분 실패 rollback·녹화 UI/저장 |
| B046 | 앱 보기 설정 `pageOutline`·메뉴·상태바·탭 간 동기화와 page gap·canvas shadow를 단일 렌더 트랜잭션으로 토글 | HWP/HWPX 바이트 비변경·재열기·설정 backup·고정 upstream 통합 patch 11/11·격리 build·실제 Edge 메뉴/상태바/교차 탭 smoke | 빈 문서 stored-time 초기화 경고·한글 직접 비교 |
| B025 / B027 | Studio 머리말·꼬리말 선택에서만 내부 JSON·plain text clipboard payload에 문서 identity·story owner·revision·selection·원문을 봉인하고 copy/cut/paste를 단일 snapshot으로 실행 | HWP/HWPX 저장·재열기·undo·실패 rollback·OS clipboard 실패/불일치 차단 포함 12/12·hfclipboard 격리 build 661 modules | 각주/미주 원자 API·RTF·그림·전체 OS clipboard 형식·한글 비교 |
| B028 | 단일 구역 root-body의 2~200개 일반 문단 선택을 여러 줄 plain text로 치환하고 edit:paste-special에서 identity·revision·선택을 봉인한 전용 command로 분기; snapshot 하나를 history resource로 소유해 execute·undo·redo·discard, 기존 한 문단 경로 유지 | 엔진 HWP/HWPX 9/9·Studio 연결 선별 7/7·프로필 TypeScript 통과·격리 build 664 modules; 원문/서식 보존·stale/부분 실패 rollback, 표/필드/책갈피/개체/특수 story fail-closed | **부분 유지:** 다구역·미지원 구조·HTML/그림/HWP 조각·실제 UI·한글 비교 |
| B071 | 기존 category/scatter 차트의 단일 숫자 cache 값·동일 차트의 2~128개 숫자 값 원자 일괄 변경·단일 계열 이름·단일 범주명을 revision·원문·구조 재검증과 dry-run 뒤 교체하고 Studio 제목줄의 차트 데이터 창에서 단일 명령 실행 | 일괄 adapter 13/13·기존 Studio 명령 14/14·격리 build 663 modules·실제 Edge HWP/HWPX 단일 값 편집→저장 바이트→UI 재열기·유형/축/범례/수식/unknown OOXML/비차트 자산 보존 | **부분 유지:** 실제 UI 다중 선택·여러 차트·복합 label·수식 자체 변경·up/down bars·Agent 연결·한글 비교 |
| N013 추가 | 저장된 Ctrl+1~Ctrl+0 slot만 기존 스타일 적용 명령으로 연결하고 IME·대화상자·표/개체/특수 story와 stale 설정을 차단; 설정 UI에서 표시·해제·초기화 | 통합 patch 보호·HWP/HWPX 저장·재열기·undo·stale 불변 3/3·격리 build·실제 Edge 설정창/단축키 smoke | 빈 문서 stored-time 초기화 경고·portable package UI·Agent·한글 비교 |
| 실행 기반 | 엔진 조건부 `DefaultTabSpacingDialog`가 없는 공식 npm build와 있는 custom-engine build를 구분하되 일반 Char/Para stale target 보호는 항상 유지 | patch seam 3/3·격리 전체 build 659 modules·N013/B046 marker·실제 Edge smoke 4건 확인 | 현재 공식 npm 엔진의 빈 문서 stored-time 초기화 경고 |
| B071 추가 | 단일 계열 이름과 공유 단일 범주명 cache 변경 시 원본 `c:f` 수식과 다른 범례·값·축·unknown OOXML·비차트 자산을 보존하고 실제 Studio UI를 같은 보호 계약에 연결 | HWP/HWPX 저장·재열기·undo·rollback과 UI 명령 포함 차트 전체 14/14·TypeScript compile | 다중 변경·복합 label·수식 자체 변경·한글 비교 |
| B071 일괄 | 동일 차트의 서로 다른 series/point 2~128개를 원문·중복·revision·source·owner 전체 사전 검증 후 dry-run하고 snapshot 하나로 원자 적용 | HWP/HWPX 저장·재열기·exact undo·부분 결과 rollback·수식/unknown OOXML/비차트 자산 보존과 1/129개·중복·stale·owner 교체 음성 사례 13/13 | **부분 유지:** Studio UI 다중 선택·다중 계열명/범주명·여러 차트·Agent·한글 비교 |
| B025 / B027 조사 | 각주·미주의 읽기 API와 단일 문단 mutation은 있으나 원자적 선택 복사·다문단 치환 계약 부재 확인 | 코드 무변경 | Rust/WASM `copySelectionInNote`·`replaceRangeInNote`와 형식 재열기 계약 |

## 실행한 선별 검사

```text
node --test apps/editor/tests/style-package.test.ts apps/editor/tests/style-gallery-profile.test.ts apps/editor/tests/style-slots.test.ts apps/editor/tests/session-textbox.test.ts
17 tests passed
node --test apps/editor/tests/preference-lifetime-audit.test.ts
4 tests passed
node --test apps/editor/tests/session-object-selection.test.ts
5 tests passed
node --test apps/editor/tests/session-endnote.test.ts
6 tests passed
node --test apps/editor/tests/session-endnote.test.ts apps/editor/tests/session-endnote-wiring.test.ts
8 tests passed; root endnote capture/restore and SessionCursor/Studio callback wire covered
JUEONY_BUILD_PROFILE=endnote-selection-session npm run build
671 modules transformed; isolated build and profile TypeScript passed
JUEONY_ENGINE_PACKAGE=build/rhwp-engine/source-c932adab64d8bc4e/pkg node apps/editor/scripts/verify-session-endnote-engine.mjs
HWP/HWPX engine save-reopen 4/4 passed
node --experimental-strip-types --test apps/editor/tests/preference-startup-diagnostic-n017.test.ts
8 tests passed; strict TypeScript passed separately
node --experimental-strip-types --test apps/editor/tests/preference-startup-diagnostic-n017.test.ts apps/editor/tests/preference-startup-gate-n017.test.ts
13 tests passed; strict TypeScript passed separately
node --experimental-strip-types --test apps/editor/tests/native-dialog-activation-policy-n020.test.ts
8 tests passed; strict TypeScript passed separately
node --experimental-strip-types --test apps/editor/tests/native-dialog-activation-policy-n020.test.ts apps/editor/tests/native-dialog-activation-coordinator-n020.test.ts
19 tests passed; strict TypeScript passed separately
node --experimental-strip-types --test apps/editor/tests/windows-file-preflight-n043.test.ts
9 tests passed; strict TypeScript passed separately
node --experimental-strip-types --test apps/editor/tests/windows-file-preflight-n043.test.ts apps/editor/tests/windows-atomic-save-coordinator-n043.test.ts
15 tests passed; strict TypeScript passed separately
node --test apps/editor/tests/undo-lifetime.test.ts apps/editor/tests/document-history95.test.ts apps/editor/tests/recovery-record.test.ts
17 tests passed
node --experimental-strip-types --test apps/editor/tests/undo-lifetime.test.ts apps/editor/tests/undo-lifecycle-coordinator-n018.test.ts
12 tests passed; strict TypeScript passed separately
node --experimental-strip-types --test apps/editor/tests/recovery-checkpoint-transaction-n044.test.ts
24 tests passed; strict TypeScript passed separately
node --experimental-strip-types --test apps/editor/tests/indexeddb-recovery-checkpoint-n044.test.ts
19 tests passed; module boundary audit passed separately
npm test -- tests/preference-startup-gate-n017.test.ts tests/preference-memory-activation-n017.test.ts tests/undo-lifetime.test.ts tests/undo-lifecycle-coordinator-n018.test.ts tests/undo-history-port-n018.test.ts tests/recovery-checkpoint-transaction-n044.test.ts tests/indexeddb-recovery-checkpoint-n044.test.ts tests/recovery-checkpoint-lifecycle-n044.test.ts
59 tests passed; strict TypeScript passed for the three committed source files and module boundary audit passed with 455 files and 0 diagnostics
N015/N017 committed selected verification bundle (embedded image selection + read-only preference runtime and regressions)
28 tests passed; strict TypeScript and module boundary audit passed with 0 diagnostics
N014 public HWP/HWPX top-level group document graph restore verification
19/19 passed; exact owner/type/properties/geometry, restore readback and lying callback rollback covered; nested/caption owner path remained fail-closed
N007 non-merged contiguous title segment index-0 verification
15/15 passed; HWP/HWPX reopen, exact undo/redo, insert/delete proof and save rollback covered; crossing rowSpan>1 remained fail-closed
N015 root equation multi-selection verification with actual custom engine HWP/HWPX save/reopen and bytes invariant
36/36 passed; single/mixed/nested equation, OLE and table selection remained fail-closed
N021 special-story shortcut boundary verification
36/36 passed; strict core TypeScript and module boundary audit passed with 0 diagnostics
N011 basic character BorderFill HWP/HWPX verification
6/6 passed; advanced BorderFill and numbering/outline remained partial
N012 stored character-style UI consumer boundary verification
9/9 passed; isolated build transformed 673 modules
N021 exact special-story safe global command verification
25/25 focused and 61/61 selected bundle passed; strict TypeScript and module boundary audit passed with 0 diagnostics
N045 offline font source rewrite and isolated bundle audit
256 CDN font literals removed; isolated build transformed 673 modules; five external endpoints remained and release stayed FAIL/PARTIAL
node apps/editor/scripts/verify-recovery-checkpoint-browser-n044.mjs
Edge 157 IndexedDB 3 scenarios passed; page/console/external/missing resource arrays were all empty
JUEONY_ENGINE_PACKAGE=build/rhwp-engine/source-4843b7d7aa6cc842/pkg npm test -- tests/insert-placeholder-capability-n019.test.ts
5 tests passed; actual HWP/HWPX export/reopen remained unchanged
npm test -- tests/menu-reachability-audit.test.ts
5 existing N019 audit tests passed; strict TypeScript for the capability source passed separately
node --test apps/editor/tests/shortcut-audit.test.ts apps/editor/tests/hangul-shortcuts.test.ts apps/editor/tests/navigation.test.ts
34 tests passed
node --test apps/editor/tests/character-style-reference.test.ts apps/editor/tests/style-flow.test.ts
7 tests passed
JUEONY_ENGINE_PACKAGE=build/rhwp-engine/source-c932adab64d8bc4e/pkg node --experimental-strip-types --test apps/editor/tests/style-package.test.ts
3 tests passed
node --experimental-strip-types --test apps/editor/tests/page-hide-control-delete.test.ts
4 tests passed
npm test -- tests/chart-data-edit.test.ts
13 tests passed
npm test -- tests/chart-data-edit.test.ts tests/chart-data-edit-studio.test.ts
14 tests passed
npm run build
663 modules transformed; isolated build passed
node scripts/verify-chart-data-edit-ui.mjs
Edge HWP/HWPX value edit, saved-byte reopen and UI reopen passed; page/chart console/external errors 0
npm test -- tests/header-footer-clipboard.test.ts tests/header-footer-clipboard-integration.test.ts
12 tests passed
JUEONY_BUILD_PROFILE=hfclipboard npm run build
661 modules transformed; isolated build passed
npm test -- tests/multi-paragraph-plain-text.test.ts tests/text-transform.test.ts
9 tests passed; HWP/HWPX reopen and exact snapshot undo passed
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict src/adapters/rhwp/multi-paragraph-plain-text.ts
passed
npm test -- tests/multi-paragraph-paste-special-command.test.ts tests/multi-paragraph-plain-text.test.ts
7 tests passed; Studio command routing, single snapshot execute/undo/redo/discard and single-paragraph regression passed
JUEONY_BUILD_PROFILE=paste-special-multi npm run build
664 modules transformed; isolated build and profile TypeScript passed
npm test -- tests/viewport-placement.test.ts tests/unified-chrome.test.ts
7 tests passed; visual viewport clamp, above/below flip and existing menu navigation passed
JUEONY_BUILD_PROFILE=dpi-viewport npm run build
665 modules transformed; isolated build and profile TypeScript passed
JUEONY_ENGINE_PACKAGE=build/rhwp-engine/source-c932adab64d8bc4e/pkg node apps/editor/scripts/verify-n041-engine-corpus.mjs
synthetic C01~C05 × HWP/HWPX open-save-reopen 10/10 passed; production preservation evidence, published layout tolerance, feature minima and input SHA checked
npm test -- tests/n041-corpus-contract.test.ts
3 tests passed; manifest coverage, forged input rejection and bounded failure classification checked
npm test -- tests/n042-print-contract.test.ts
4 tests passed; environment, page/text/object difference classification and cross-producer fail-closed contract passed
JUEONY_ENGINE_PACKAGE=build/rhwp-engine/source-c932adab64d8bc4e/pkg node apps/editor/scripts/verify-n042-print-layout.mjs
2-page table/picture/field HWP/HWPX Jueony baseline 2/2 passed; real Hancom/PDF/font fingerprint not run
npm test -- tests/n045-offline-contract.test.ts
4 tests passed; local asset, hash, notice, allowlist and URL rejection contract passed
node apps/editor/scripts/verify-n045-offline-bundle.mjs
FAIL_OFFLINE_BUNDLE as expected: isolated dist contains 269 CDN font URLs; release readiness remains blocked
npm test -- tests/session-object-selection-wiring.test.ts tests/session-object-selection.test.ts
31 passed; 2 existing skipped; grouped selection SessionCursor/Studio wire and engine HWP/HWPX 4/4 covered
JUEONY_BUILD_PROFILE=group-selection-session npm run build
666 modules transformed; isolated build and profile TypeScript passed
node apps/editor/scripts/verify-n013-b046-browser-smoke.mjs
4 Edge smoke scenarios passed; pageErrors/consoleErrors/externalRequests 0
JUEONY_ENGINE_PACKAGE=build/rhwp-engine/source-c932adab64d8bc4e/pkg npm test -- tests/nested-caption-text.test.ts
18 tests passed; 1 expected guard skipped; Left/Right full path/live+portable geometry and equal Unicode scalar multi-run preservation, HWP/HWPX save-reopen and undo/redo passed
node --experimental-strip-types --test apps/editor/tests/style-package-dialog-browser-n013.test.ts
1/1 passed in actual isolated Edge with official npm WASM; warning checkbox, unchecked block, acknowledged one apply, stale block and nonblank no-warning covered; external/page/console/missing 0
N013 portable style profile/package JSON UI import-export verification
14/14 passed with the custom engine; blank stored-time typed warning/evidence/ack/stale protection covered; isolated build 678 modules
N016 nested table-cell depth 1~8 nonempty ClickHere full-selection verification
10/10 new nested, 29/29 root regression and 42/42 related selection bundle passed; exact owner-chain forward/backward selection and fail-closed negatives covered
```

회전 글상자의 실제 WASM 검사는 `source-cc7eb97e2669dc19` 엔진으로 HWP·HWPX 저장·재열기와 바이트 비변경을 확인했다. 기존 공유 dirty 빌드를 덮어쓰지 않기 위해 새 Edge 전체 빌드는 실행하지 않았다.

N004는 동결된 206개 patch 엔진 `source-1c95e8f557d95b73`으로 네이티브 양형식과 격리 Edge 검사를 완료했다. N012는 실제 Rust 엔진의 양형식 저장·재열기에서 정의 연결 전파와 직접 서식 비전파를 확인했다. 한글 2024 직접 비교는 지시대로 실행하지 않았다.

B071 Edge 검수에서는 차트 시나리오의 page 오류·console 오류·외부 요청이 모두 0이었다. 다만 공유 검수 빌드에서 차트와 무관한 favicon 404와 빈 문서 stored-time 초기화 API가 공식 npm WASM에 없는 오류가 별도로 관찰됐다. 소유 HWP/HWPX를 직접 연 차트 검수에는 영향을 주지 않았으며, 이 두 항목은 해결된 것으로 표시하지 않는다.

## 변경 집합

- `0eb379ec feat(editor): preserve styles and rotated textbox state`
- `b74d53ee test(editor): audit preference storage lifetimes`
- `0407bcee refactor(editor): expose preference and style facades`
- `49c6a1cc feat(editor): validate grouped object selection state`
- `4aae2329 feat(editor): validate endnote selection state`
- `9f3b431a feat(editor): restore verified endnote selections`
- `08c02ce5 test(editor): add fail closed preference startup diagnostics`
- `b014e627 test(editor): model native dialog activation safety`
- `3eedb6e5 test(editor): add safe Windows file preflight`
- `d419acd3 feat(editor): gate preference startup activation`
- `06d5af57 feat(editor): coordinate safe native dialog activation`
- `1d5ce959 feat(editor): coordinate fail-safe Windows atomic saves`
- `e3637581 feat(editor): coordinate undo lifecycle boundaries`
- `9f2be03a feat(editor): coordinate verified recovery checkpoints`
- `e5bacd63 feat(editor): add durable recovery checkpoint storage`
- `6769bcb0 feat(editor): fail closed unsupported insert placeholders`
- `f9524b4f test(editor): define undo history lifetime policy`
- `88fb3974 feat(editor): activate safe preference defaults in memory`
- `c8635b9b feat(editor): gate undo lifecycle through atomic history port`
- `4ef8c385 feat(editor): coordinate recovery checkpoints across document lifecycle`
- `24bc5eb6 feat(editor): expose read only preference runtime`
- `2d486daf feat(editor): restore verified multi image selections`
- `7ab73783 test(editor): verify recovery checkpoints in browser`
- `ee0f5a75 feat(editor): audit nested textbox restore capability`
- `0daeb3c7 feat(editor): restore verified equation selections`
- `86e629d4 feat(editor): guard shortcuts by special story`
- `7db995bd feat(editor): preserve basic character style borders`
- `66ab2768 feat(editor): resolve stored character styles at UI apply`
- `1ec65059 feat(editor): admit verified global special-story shortcuts`
- `41b44529 build(editor): strip external font URLs from offline bundle`
- `2bd2c75b feat(editor): preserve portable style references`
- `4ea193ce feat(editor): delete verified page hide controls`
- `ddb53c86 feat(editor): edit verified blank caption paragraphs`
- `bb23990f feat(editor): import portable style packages from UI`
- `3a9d86b8 feat(editor): restore verified ClickHere selections`
- `554ccfd9 feat(editor): preserve scalar-aligned caption runs`
- `59d9d368 feat(editor): restore verified cell ClickHere selections`
- `8e3512eb feat(editor): warn before blank stored-time style apply`
- AI·Agent 실행과 참고 자료·검색·RAG 코드는 이 묶음에서 변경하지 않았다.
