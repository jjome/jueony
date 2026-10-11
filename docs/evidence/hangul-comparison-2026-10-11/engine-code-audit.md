# 문서 엔진·저장 경계 감사

검토일: 2026-10-11 (Asia/Seoul). Jueony HEAD `f5be2b81d247a5468750952cea20c7db297d188a`.

이 문서는 **코드와 기존 실행 증적을 재검토한 결과**다. 이 감사 담당자는 한글 GUI를 조작하거나 새 문서 왕복·인쇄 시험을 실행하지 않았다. 실제 한글 2024와의 화면/기능 비교는 상위 보고서의 별도 현장 증거와 합쳐야 한다. 코드에 메서드가 있는 것은 실물 문서에서 한글과 같은 결과를 낸다는 뜻이 아니다.

## 판정 기준

- **구현 있음**: 현재 앱으로 연결된 코드 경로를 찾음. 전체 동등성 통과를 의미하지 않는다.
- **부분 구현/제한**: 일부 문서·속성·조작만 지원하거나 명시적으로 거부하는 경로가 있음.
- **AI 미연결**: 수동 편집/엔진 기능은 있으나 현재 Agent 편집 명령 계약에 없음. 편집기 전체 미구현과 분리한다.
- **미구현 확인**: 비활성 stub, 명시적 지원 제외, 노출 경로가 없는 기능을 확인한 범위.
- **미검증/추가 조사**: 코드 검색이나 API 유무만으로 결론을 낼 수 없음.

`file:line`은 감사 당시 저장소 기준 상대경로다. 아래 `core.d.ts`는 `apps/editor/node_modules/@rhwp/core/rhwp.d.ts`, `studio/`는 `upstream/rhwp-source/rhwp-studio/src/`, `rust/`는 `upstream/rhwp-source/src/`를 뜻한다.

## 실제 사용 중인 엔진과 패치

| 항목 | 확인 결과 | 근거 |
|---|---|---|
| Studio 소스 | rhwp `1a76570e833917d15817415a53c09ad61ab3203f`에 고정 | `apps/editor/scripts/build.mjs:15`, 실제 `git -C upstream/rhwp-source rev-parse HEAD` 일치 |
| 실행 엔진 | npm `@rhwp/core@0.8.7` Rust/WASM 바이너리 | `apps/editor/package.json:26`, `apps/editor/node_modules/@rhwp/core/package.json:3` |
| WASM 해시 | `54cf95014312e605c51b98eb9021247ea79ef2bbd0a7080e11c011d0246e3989` | 설치 WASM와 `apps/editor/evidence/dist-continuation/assets/rhwp_bg-BkVWMBaR.wasm`를 새로 SHA-256 계산, 일치 |
| Rust 엔진 소스 재빌드 | 현재 앱 빌드에서 수행하지 않음 | `apps/editor/scripts/build.mjs:201`, `:227`; `docs/evidence/continuation-2026-10-11/integration/build-evidence.json` |
| Tauri 네이티브 | 데스크톱·파일 기능의 Rust host. rhwp Rust crate를 이 앱 Cargo에서 직접 링크하는 구조가 아님 | `apps/editor/src-tauri/Cargo.toml:12` |
| Studio 패치 | 소스를 `.build/studio[-profile]`로 복사 후 편집기/Agent bridge, 환경 동기화, 문서별 뷰 상태, 새 문서 기본값, 글자 대화상자, 키보드 표 생성, 저장 오류/충돌 처리를 패치 | `apps/editor/scripts/build.mjs:26`, `:65`, `:84`, `:89`, `:145`, `:149`, `:161`, `:189` |
| HwpCtrl | 빌드의 `__RHWP_HWPCTRL__`는 false. upstream의 HwpCtrl 호환 계층 존재를 현재 앱 외부 자동화 지원으로 볼 수 없음 | `apps/editor/scripts/build.mjs:198` |
| 외부 웹폰트 | 빌드에서 외부 웹폰트 비활성, 로컬 포함 폰트 사용 | `apps/editor/scripts/build.mjs:40`, `:198`. 한글과 모든 설치 글꼴/대체 글꼴이 일치하는지는 별도 검사 필요 |

upstream `AGENTS.md`, `CLAUDE.md`, Codex MEMORY와 문서 지도를 확인했다. upstream 수정은 수행하지 않았다. 읽기·보존·편집·출력과 동일 엔진/독립 한글 검증을 분리하는 upstream 지침도 이 감사에 적용했다.

## 기능별 읽기·편집·저장 분리

| ID | 기능 | 현재 수동/엔진 경로 | 현재 Agent | 남은 기능·검증 |
|---|---|---|---|---|
| EN01 | HWP/HWPX 열기·저장 | 구현 있음. `HwpDocument`, `exportHwpWithReport`, `exportHwpxWithReport` (`core.d.ts:548`, `:564`) | 사용자가 열린 문서 상태를 공유. AI 저장 명령은 편집 계약에 없음 | 원본/무수정 저장/수정 저장을 한글에서 각각 재열기. 쪽 수·내용·개체·글꼴·조판 전부 확인 |
| EN02 | 본문 여러 위치 수정 | 삽입·삭제·분할·복사·서식 엔진 API 있음 | 부분 구현. 본문 생성/삽입/범위 교체/범위 삭제 | 혼합 글자 서식 문단, 필드/컨트롤 포함 문단, 구조적 문단 삭제/이동, 개체 동반 이동은 현 AI 계약으로 처리 불가 |
| EN03 | 글자·문단 서식 | 다양한 엔진/Studio 서식 경로 있음 (`core.d.ts:58`, `:90`; `studio/command/commands/format.ts`) | 허용 목록 속성만 연결. 문단 전체 적용 | 선택 범위별 혼합 서식 유지, 탭/내어쓰기/글머리/번호/문단 테두리 등 전체 옵션 연결과 한글 왕복 대조 |
| EN04 | 스타일 | 조회·생성·적용·수정·삭제 API 있음 (`core.d.ts:116`, `:300`, `:392`, `:1313`, `:2474`) | AI 미연결 | Agent 스타일 생성/수정/재사용/문서 전체 적용. 스타일 상속·번호·저장·undo 대조 |
| EN05 | 표 생성/단순 셀/행·열 | 엔진/Studio 경로 있음 | 부분 구현: 새 표, 단순 셀 내용/서식, 단순 표 행·열 추가/삭제 | 병합·중첩·개체·복수 문단·혼합 서식 셀을 AI 대상화. 기본 작업을 처음부터 재구현할 필요 없음 |
| EN06 | 셀 병합/나누기 | 수동 명령 및 엔진 API 있음 (`core.d.ts:1719`, `:2392`, `:2398`; `studio/command/commands/table.ts:593`, `:645`) | AI 미연결 | 병합 범위의 내용 순서·서식·셀 주소 변화·undo·저장 검증 후 명령 추가 |
| EN07 | 표 나누기/붙이기/뒤집기 | API/Studio 명령 있음 (`core.d.ts:1732`, `:2386`, `:2453`; `studio/command/commands/table.ts:668`, `:812`, `:859`) | AI 미연결 | 경계 병합/셀 안 개체/다른 표 속성 처리·저장 대조. ‘표 전체 미지원’으로 분류하지 말 것 |
| EN08 | 표 속성·배치·쪽 넘김 | `setTableProperties`, `setCellProperties` 있음 (`core.d.ts:2117`, `:2328`) | 셀 배경/정렬 등 일부만 연결 | 반복 제목 행, 표와 글 배치, 여러 쪽 표, 여백·테두리·대각선·세로쓰기 등 각 속성의 AI 연결 및 출력 대조 |
| EN09 | 표 계산식·숫자 형식 | 엔진 `evaluateTableFormula`와 수동 계산식/합계/평균/곱/소수점 명령 있음 (`core.d.ts:488`; `studio/command/commands/table.ts:983`) | AI 미연결 | 계산식 종류, 재계산 시점, 저장 후 수식 보존과 한글 결과 비교. 단순 값 쓰기를 계산식 지원으로 대체하지 말 것 |
| EN10 | 셀 너비/높이 같게 | upstream 빈 execute만 보고 미구현 판정하면 안 됨. Jueony 별도 geometry/shortcut 보강 경로가 있음 | AI 미연결 | 병합·복잡 표 범위는 수동 보강의 제한까지 별도 대조 (`apps/editor/src/shortcuts/install.ts:102`) |
| EN11 | 용지/여백/방향 | `setPageDef`와 수동 편집 용지 있음 (`core.d.ts:2275`) | 구역별 용지 크기·방향·여백 일부 연결 | 제본·맞쪽·줄 격자·구역 적용 범위 등 모든 옵션과 한글 값/출력 대조 |
| EN12 | 구역·다단·강제 쪽/단 나눔 | `breakAtCursor`, `setColumnDef`, `setSectionDef` 등 API 있음 (`core.d.ts:151`, `:2166`, `:2300`) | AI 미연결 | 구역 생성/삭제/경계 이동, 단 설정, 새 번호·나눔을 구조 명령으로 연결. 레이아웃과 저장 별도 검증 |
| EN13 | 머리말/꼬리말 | 생성/편집/템플릿/필드 API 있음 (`core.d.ts:278`, `:1557`, `:1661`) | AI 미연결 | 쪽 종류/구역 상속/교차 적용/그림 포함 편집과 한글 대조 |
| EN14 | 현재 쪽 감추기 | 현재 Studio `page:hide-headerfooter`, `page:hide-current`는 세션 토글 경로 | AI 미연결 | **저장되는 문서 속성으로서의 감추기와 동일하지 않음.** `setPageHide`는 별도 엔진 API로 존재 (`core.d.ts:2279`). 아래 상세 참조 |
| EN15 | 바탕쪽 | parser/serializer에 바탕쪽 보존 처리 있음. 완전 편집 UI/Agent 명령은 이 범위에서 확인 못함 | AI 미연결 | 읽기 보존과 편집을 분리. 후속 secPr 변환에는 masterPageCnt=0 제한 확인. 바탕쪽 생성·편집·구역 적용·저장 대조 필요 |
| EN16 | 각주/미주 | 삽입·내용/모양 편집 API 있음 (`core.d.ts:85`, `:1549`, `:1561`, `:1655`) | AI 미연결 | 본문 참조↔주석 대상 주소, 번호 방식, 구역/쪽 분리, 각주 안 표/수식, 저장/인쇄 검증 |
| EN17 | 그림 | 삽입/이미지 교체/속성·셀 내부 경로 API, Studio 속성 UI 있음 (`core.d.ts:133`, `:1591`, `:2296`) | AI 미연결 | 자산 입력·크기/자르기/감싸기/배치·대체 텍스트·그림 안 텍스트 OCR. 읽기 시 이미지 문맥도 현재 제공되지 않음 |
| EN18 | 도형/선/글상자 | 생성/속성/본문·셀 경로 API 있음 (`core.d.ts:293`, `:2310`, `:2332`) | AI 미연결 | 생성/이동/크기/회전/글상자 내용/개체 정렬과 겹침, 복사·undo·저장 검증 |
| EN19 | 그룹/앞뒤/캡션 | 그룹/해제/앞뒤/캡션 API 있음 (`core.d.ts:137`, `:179`, `:1428`, `:2457`) | AI 미연결 | 다중 선택/그룹 내부 대상/캡션 위치·번호 제어. 수동 캡션 방향 9개 항목은 비활성 stub (`studio/command/commands/insert.ts:251`) |
| EN20 | 수식 | native 수식 삽입/편집/렌더와 일부 OLE 승격 지원 (`core.d.ts:1553`, `:1879`, `:2192`) | AI 미연결 | 수식 언어·명령별 표시/저장 비교. 레거시 OLE를 그대로 수정하는 방식은 아님 (`studio/command/commands/insert.ts:429`) |
| EN21 | 차트 | 기존 차트 열거/OOXML 데이터 조회·수정과 수동 데이터 대화상자 있음 (`core.d.ts:1681`, `:2155`; `studio/command/commands/insert.ts:387`) | AI 미연결 | 새 차트 생성/전체 차트 디자인/모든 형식 편집 API는 설치 계약에서 확인 안 됨. 다층 라벨/레거시 차트 등 명시적 제한 있음 |
| EN22 | OLE·외부 개체 | OOXML/레거시 차트/일부 이미지·수식 해석과 미리보기 폴백 | AI 미연결 | 임의 외부 앱 OLE 편집·MS Graph/Excel 객체 전체 편집은 지원 범위 밖. 미리보기는 편집 가능함의 증거가 아님 |
| EN23 | 책갈피·하이퍼링크·누름틀 | API·일부 수동 UI 있음 (`core.d.ts:41`, `:1505`, `:1562`, `:2213`; `studio/command/commands/hyperlink.ts`) | AI 미연결 | 필드 내부 서식/범위/이름 충돌/상호참조/저장 처리. 본문 문자열 치환으로 우회하면 필드 의미 손상 위험 |
| EN24 | 양식 개체 | 기존 Form 조회/값 설정 API 있음 (`core.d.ts:953`, `:2228`) | AI 미연결 | 양식 개체 생성·속성·다양한 컨트롤 상호작용을 완전 지원하는지 추가 조사. 기존 값 읽기/쓰기를 전체 양식 편집으로 표시하지 말 것 |
| EN25 | 메모·변경 추적·전자서명 | 메모 삽입 수동 stub 확인 (`studio/command/commands/insert.ts:261`). 변경 추적/전자서명의 사용자 작성·수락/거절·검증 API는 설치 d.ts 및 Studio commands에서 확인 못함 | AI 미연결 | 원본 파일의 raw 정보 보존 여부와 새 기능 작성은 별개. 메모 편집/답글, 추적 변경 승인, 서명 검증은 별도 설계·검증 과제 |
| EN26 | 암호 문서 | 암호 열기 및 HWP/HWPX 암호 저장 엔진·Studio 경로 이미 있음 (`core.d.ts:536`, `:556`, `:1803`; `studio/command/commands/file.ts:278`) | 기존 암호 문서 AI 편집은 preflight의 평문 복구 거부로 제한됨 | 암호 전체 미구현으로 분류 금지. HWP3 구버전/비압축 암호와 DRM 제외, 암호 유지·변경·취소/실패 및 실제 한글 교환검증 필요 |
| EN27 | 배포용 문서 | 파싱 경로 존재. 일반 HWP serializer는 배포 플래그를 지우는 변환 경로 (`rust/serializer/cfb_writer.rs:71`) | AI 미연결 | 배포용 저장·권한/제약 유지까지 구현됐다는 뜻이 아님. 배포용 작성·원래 제한 유지에 대한 UI 정책/검증 필요 |
| EN28 | 인쇄·PDF | 모든 페이지의 print-profile SVG를 만든 뒤 브라우저 인쇄를 호출 (`studio/command/commands/file.ts:583`, `:665`, `:722`) | AI 인쇄/저장 미연결 | 한글의 인쇄 옵션 전부와 동일한 자체 출력 엔진 아님. 실제 프린터/PDF의 쪽 크기·확대/모아찍기·양면·글꼴·이미지 검증 |
| EN29 | Undo/Redo·요청 되돌리기 | 엔진 snapshot와 수동 history. AI 1요청 snapshot 묶음 | 최신 AI 요청에 한해 버전/undo-top 일치 때 되돌리기 | AI 뒤 수동 편집이 있으면 해당 AI 요청만 선택적으로 제거하지 않음 (`mvp/editor-bridge.ts:133`). 저장/재시작 후 history 보존은 별도 앱 감사 |
| EN30 | 기타 파일 형식 | HWP/HWPX 외 HML 등 제한적 경로 있음 | 참고 파일 읽기는 별도 경로 | 한글의 모든 가져오기/내보내기 형식과 동등하다고 볼 수 없음. DOCX/RTF/ODT/옛 한글/HML별 읽기·변환·편집·저장을 각각 검증해야 함 |

## 코드에서 확인된 명확한 공백

### 1. 저장 손실 보고가 모든 손실을 검출하지 않는다 — 우선순위 P0

`rust/serializer/content_loss.rs:32`에서 `ControlOmitted`, `MetadataReduced`를 **후속 생산자용**으로 정의한다. 현재 serializer의 실질 보고 생산자는 `ContentLoss::binary_content_emptied` 경로이며, HWP의 BinData 크기/압축/원본 부재(`cfb_writer.rs:378`, `:392`), HWPX 자원 읽기/상한(`hwpx/mod.rs:181`, `:227`) 등을 보고한다.

한편 HWPX 출력에서 `Control::Unknown`은 출력 표현이 없어 경고 후 빠지는 경로가 있다(`rust/serializer/hwpx/section.rs:2329`, `:2587`). 이는 현재 `ContentLossReport`에 `ControlOmitted`를 추가하는 코드가 아니다. `Form`과 OLE XML 작성 오류도 `eprintln!` 경로가 있다(`:2516`, `:3116`). 발생 표본에서의 실제 손실 여부/가시성은 아직 새로 실행하지 않았다.

따라서 앱의 `count === 0`을 **문서 모든 요소 무손실 보장**으로 표시하면 안 된다. enum이 존재한다는 이유만으로 보고가 연결되었다고 평가해서도 안 된다. 후속 과제는 모든 omission/error를 구조화해 UI/사전 검사/복구 저장에 연결하고, 실제 손실 표본으로 거부·기존 복구본 보존을 확인하는 것이다.

현재 앱은 `recovery-export.ts:8`에서 보고를 검증하고 손실 건수가 있으면 기존 복구본을 유지한다. `mvp/editor-bridge.ts:83`은 AI 사전 검사에서 손실 보고를 거부하고 저장 후 내용을 다시 읽는다. **보호 로직이 있는 것과 보고 범위가 완전한 것은 별개다.**

### 2. 현재 사전 검사 구조 모델은 문서 전체를 표현하지 않는다 — P0

`apps/editor/src/document-control/structure.ts:14`는 각 본문 문단의 첫 위치 글자 속성과 문단 속성을 읽는다. `:21`은 최상위 본문 표만 구조 대상으로 만들고 나머지 개체 종류를 `unsupportedControls` 목록에 넣는다. 셀 안 다중 문단/혼합 글자/중첩 개체도 `:35`의 editable 조건에서 제외한다.

`apps/editor/src/mvp/editor-bridge.ts:85`가 검사하는 텍스트와 `readStructure` 동등성은 지원 범위에서 유용하지만, 그림 바이트·도형 기하·필드 모든 속성·바탕쪽·모든 글자 run·서명·원본 XML 완전성을 검사하지 않는다. 개체가 있는 문서에서 동일 엔진 왕복이 같다고 한글 완전 호환/모든 자산 보존을 선언할 수 없다.

### 3. 머리말/꼬리말 감추기가 세션 동작이다 — P1

`studio/command/commands/page.ts:375`는 현재 감추기가 `hidden_header_footer` 세션 집합과 렌더 캐시만 변경하고 문서를 변경하지 않으며, snapshot undo에도 기록하지 않는다고 명시한다. `page:hide-current`도 같은 토글 경로를 사용한다(`:402`).

영구 문서 속성을 쓰는 `setPageHide` API(`core.d.ts:2279`)는 별도로 존재한다. 한글의 해당 명령에 기대하는 저장·재열기·되돌리기 동작을 실제로 확인한 뒤 UI 명령을 올바른 경로와 연결해야 한다. 현재 화면에서 숨겨 보이는 것만으로 완료 처리할 수 없다.

### 4. 바탕쪽 변환 제한이 있다 — P1

`rust/serializer/hwpx/section.rs:734`의 후속 구역 secPr 생성 경로는 바탕쪽을 지원하지 않아 `masterPageCnt="0"`을 유지한다. **모든 바탕쪽 읽기/보존이 불가능하다는 뜻은 아니며**, 이 변환 경로에 구체적인 공백이 있다는 뜻이다. 한 문서의 여러 구역/바탕쪽 종류·내용·상속을 넣어 원본과 파생 저장물의 한글 출력을 비교해야 한다.

### 5. 차트/수식/OLE는 유형별 지원이다 — P1

- `rust/document_core/commands/object_ops/chart.rs:116`: HWPX 차트에 쓸 수 있는 중첩 CFB 사본을 찾지 못하면 변경을 거부한다.
- 같은 파일 `:162`: 두 OOXML 표현의 데이터가 다르면 `representationMismatch`로 거부한다.
- 같은 파일 `:599`: 다층 카테고리 차트의 행/라벨 구조 편집 미지원, 값만 변경 가능.
- `studio/command/commands/insert.ts:429`: 레거시 `hwpeq5` OLE 수식의 원래 방언 되쓰기는 하지 않고 native equation으로 승격한 뒤 수정한다.
- `upstream/rhwp-source/mydocs/tech/chart_ole_v1_boundary.md:99`: ChartOBJ 전체, MS Graph, Excel BIFF/임베드 XLSX OLE, 레거시 Contents 전체 편집/되쓰기는 v1 지원 범위 밖이라고 명시. 원본 표시용 미리보기와 데이터 편집을 혼동하면 안 된다.

이 범위는 ‘차트/수식/그림이 아예 없음’도 ‘전부 지원’도 아니다. 원본 형식별 테스트 대상을 나눠야 한다.

### 6. AI 지원 범위는 엔진보다 훨씬 좁다 — P1

명령 allowlist는 `apps/editor/src/document-control/operations.ts:4`, `:13`과 `apps/editor/src/mvp/edit-schema.ts:30`에 있다. 현재 새 문서 본문 작성, 본문 삽입/교체/삭제, 일부 글자·문단, 단순 표·셀·행/열, 용지·여백만 연결되어 있다.

코드에 명시된 한도:

- 전체 문서 입력 120,000자 (`mvp/editor-bridge.ts:36`).
- AI 한 요청 명령 30개, 생성 문단 한 묶음 1~100개, 한 문단 4,000자, 생성 본문 60,000자 (`mvp/edit-schema.ts:7`, `:27`, `:44`, `:48`).
- 새 표/행열 변경 최대 50행·20열·200셀, 구조 조회는 표당 1,000셀 (`document-control/operations.ts:44`, `:87`; `structure.ts:27`).
- 행/열 변경은 병합·중첩·혼합 서식 없는 단순 표만 허용 (`operations.ts:37`). 셀 텍스트는 제어문자 없이 4,000자, 복수 문단 셀은 AI 편집 대상 아님.
- 본문 제어문자/필드/혼합 서식은 `collectTargetEvidence` 검사, 셀 혼합 서식/개체는 `readStructure` 검사에서 거부.
- 암호 문서는 평문 복구본을 만들지 않음 (`mvp/recovery-export.ts:1`, `:5`). 기존 문서 AI preflight가 이 경로를 호출하므로 암호 문서 AI 편집에는 별도 안전한 사본 경로가 필요하다.

API가 있는 스타일·표 고급 조작·머리말/꼬리말·각주·그림·도형·수식·차트·필드부터 대상 주소, 허용 인자, 버전, snapshot, 자산 보존 검증을 연결해야 한다. 엔진 API 이름을 LLM에 무제한 노출하는 작업으로 대체하면 안 된다.

## 기존 증적 재검토

`docs/evidence/hangul-parity/2026-10-11-autonomous/engine/`의 24행 목록 및 보고서를 읽었다. 다음 부분은 여전히 유효하지만 당시 `BLOCKED_REFERENCE`는 **그 실행 당시 실제 한글 편집기가 없었다는 기록**이다. 지금 설치 확인만으로 과거 결과를 PASS_HANCOM으로 바꾸지 않는다.

- 당시 단위/엔진 검사 36개 통과는 기존 `engine-and-save-tests.txt`의 결과다. 이번 감사에서 재실행하지 않았다.
- 당시 공개 원본 5개·HWP/HWPX 무수정 출력 10개, 단순 셀 편집 출력 2개는 같은 엔진 재열기 검사다. 4개 `PASS_CONTENT_ONLY`, 1개 `REVIEW_REQUIRED`.
- `public-corpus-report.json:133`의 `python-hwpx-1`은 HWP 변환에서 `textEqual=false`, `bodyEqual=false`인데 `contentLoss.count=0`이다(`:145`, `:146`). HWPX 경로는 일치했다. 손실 보고 0과 텍스트/구조 동등성은 별도 측정이어야 한다.
- ‘실제 한글에서 잘 열린다’와 ‘모든 개체/서식/쪽 구성이 같다’는 별개. 기존 한글 재열기 성공 사용자 보고도 표본·기능 한정 증거로 기록해야 한다.

## 후속 검증 순서

1. 현재 설치 한글에서 **원본과 Jueony 저장본을 별도 이름으로** 열고 HWP/HWPX 각각의 쪽 수·글자/문단·표·개체 구조와 출력 PDF를 확보한다. 원본은 덮어쓰지 않는다.
2. 기존 공개 corpus의 `python-hwpx-1` 차이를 먼저 재현하고 끝 문단이 실제 내용/쪽 수에 미치는 영향까지 판정한다.
3. 감추기/바탕쪽/혼합 서식/병합 표/중첩 표/각주·수식/OLE/필드·메모를 독립 표본으로 나눠 무수정 왕복과 실제 편집 왕복을 각각 수행한다.
4. 손실 보고 누락 및 AI 문맥 모델의 범위를 보강한다. 실패 때 적용/복구 저장 중단과 기존 원본 보존을 확인한다.
5. 엔진에 있는 기능의 AI 연결을 작은 명령군으로 추가한다. 사용자 편집·undo/redo·저장·한글 재열기까지 통과한 범위만 지원으로 표시한다.

이 문서는 미구현/제한/미검증을 분리한 엔진 감사이며 한글 2024의 모든 메뉴·대화상자·상태 저장에 대한 전수 시험 완료 선언이 아니다.
