# 상태 저장·AI 제어·단축키·반복 작업 코드 감사

2026-10-11 · 감사 기준 HEAD `f5be2b81d247a5468750952cea20c7db297d188a`.

이번 보고서는 파일을 읽어 비교한 코드 감사다. 실제 한글 2024의 화면 조작·환경값 수명·저장 재열기·물리 단축키는 이 하위 감사에서 실행하지 않았다. 기존 검수 기록은 참고했으나 이번에 테스트를 재실행한 것으로 계산하지 않는다. 저장소 및 적용 가능한 상위 디렉터리에서 AGENTS.md를 찾지 못했다. 사용자 미추적 파일은 수정하지 않았다.

판정은 두 축으로 나눈다. **가능**은 제품 코드에 실행 경로가 있고 기존 검수 근거가 있다는 뜻이며 한글 동등성 통과를 뜻하지 않는다. **부분**은 범위 제한이 있는 실행 경로, **없음**은 제품의 해당 계약/명령 경로가 없는 경우, **한글 검증 필요**는 실제 한글 동작과 나란히 비교해야 할 사항이다. AI에 공개하지 않은 기능이라도 사람이 편집기에서 실행할 수 있을 수 있다.

## 1. 상태 저장: 현재 가능한 것과 실제 공백

| 항목 | 현재 판정 | 남은 공백/한계 | 코드 근거 |
|---|---|---|---|
| workspace·채팅·폴더 연결·실행 기록 | 가능 / Jueony 추가 기능 | IndexedDB 및 브라우저 origin별 상태. 포트를 바꾼 실행본 사이 자동 이관·업무 백업/내보내기 계약은 없음 | `apps/editor/src/mvp/store.ts:6`, `apps/editor/src/mvp/model.ts:21`, `apps/editor/src/mvp/model.ts:27` |
| 문서 복구 bytes·dirty·이름 | 가능 / 한글 검증 필요 | `documents`에 최신 복구본을 저장하며 원본 파일 자동 저장과는 다름. 원본 형식·개체 보존은 독립 한글 재열기 필요 | `apps/editor/src/shell.ts:175`, `apps/editor/src/mvp/recovery-export.ts:4` |
| 열린 탭 순서·활성 문서 | 가능 / 한글 검증 필요 | `documentOrder`를 보존하고 복원 시 적용. 이전 CSV의 ‘순서 필드 없음’은 잘못된 현재 상태 | `apps/editor/src/mvp/model.ts:25`, `apps/editor/src/shell.ts:155`, `apps/editor/src/shell.ts:215` |
| 브라우저 원본 파일 handle·SHA-256 복원 | 가능(브라우저 handle 한정) / 한글 검증 필요 | structuredClone 가능한 handle만 저장. 권한이 필요하면 다시 연결. 원본 변경/삭제는 자동 덮어쓰기하지 않음. 네이티브 emulation handle은 직렬화 못함 | `apps/editor/src/file-connection.ts:21`, `apps/editor/src/file-connection.ts:34`, `apps/editor/src/shell.ts:166`, `apps/editor/src/shell.ts:315` |
| 문서별 배율·폭/쪽 맞춤·스크롤 | 가능 / 한글 검증 필요 | 문서 세션 복구값. 한글이 파일/사용자 중 어느 범위로 기억하는지, 문서 재열기·다른 PC·창 변경 시 수명은 대조 필요 | `apps/editor/src/preferences/document-view.ts:2`, `apps/editor/src/preferences/document-view.ts:39`, `apps/editor/src/preferences/document-view.ts:77` |
| 재실행 후 커서·선택·표/개체 편집 모드 | 없음 / 한글 검증 필요 | 저장 계약에 커서 위치, 선택 anchor, 셀/개체 선택 모드가 없음. 실행 중 iframe 유지와 재실행 복원을 구분해야 함 | `apps/editor/src/preferences/document-view.ts:27`, `apps/editor/src/mvp/model.ts:26` |
| 실행 중 undo/redo | 가능 / 한글 검증 필요 | 일반 엔진 undo/redo와 AI 요청 undo가 연결됨. 모든 컨테이너/IME/복합 명령의 묶음 경계는 실측 필요 | `apps/editor/src/shortcuts/keymap.ts:22`, `apps/editor/src/mvp/editor-bridge.ts:117`, `apps/editor/src/mvp/editor-bridge.ts:132` |
| 재실행 후 undo 이력 | 없음 / 한글 검증 필요 | 문서 bytes 복원은 history 직렬화가 아님. 한글도 재실행 이력을 보존하는지는 별도 실측 전까지 한글 대비 결함이라고 단정하지 않음 | `apps/editor/src/preferences/document-view.ts:27`, `apps/editor/src/mvp/model.ts:26` |
| AI 요청 단위 되돌리기 | 부분 | 해당 요청이 undo 맨 위이고 revision이 일치해야 함. 뒤에 수동 편집이 있거나 재실행했으면 요청 선택 복원 불가. 요청 redo 전용 UX 없음 | `apps/editor/src/mvp/editor-bridge.ts:132`, `apps/editor/src/shell.ts:93` |
| 새 문서 기본값 | 부분 / 한글 검증 필요 | 용지·방향·여백·기본 글꼴/크기만 저장. Normal.hwtx 상당의 스타일/문단/개요/번호/다단/기본 서식 템플릿 관리 없음 | `apps/editor/src/preferences/document-defaults.ts:4`, `apps/editor/src/preferences/document-defaults.ts:9`, `apps/editor/src/preferences/document-defaults.ts:72` |
| 앱 환경 설정·탭 간 갱신 | 부분 / 한글 검증 필요 | theme/view/font/autosave와 일부 대화상자 옵션은 저장·변경 필드 병합·storage event 동기화. 전체 한글 환경 설정 항목 대응 아님. localStorage의 동시 프로세스 CAS 보장은 없음 | `apps/editor/src/preferences/persistence.ts:84`, `apps/editor/src/preferences/binding.ts:16`, `apps/editor/scripts/build.mjs:69`, `upstream/rhwp-source/rhwp-studio/src/core/user-settings.ts:101` |
| 대화상자 이전 탭·값·단위 기억 | 부분 / 한글 검증 필요 | 그림 비율 유지·PDF 안내 등 일부 값은 존재. 모든 대화상자의 확인/취소/재열기/재실행 수명을 통일한 계약 없음 | `upstream/rhwp-source/rhwp-studio/src/core/user-settings.ts:165`, `docs/editor-state-contract.csv:S14` |
| 자동 복구 설정 일관성 | 부분 / 한글 검증 필요 | Studio recovery/idle 설정 외에 shell은 상태 변경 후 고정 1.4초 복구를 별도 예약. 사용자가 자동 복구를 끄거나 간격을 바꿀 때 전체 동작이 동일한지는 미정리 | `apps/editor/src/shell.ts:145`, `upstream/rhwp-source/rhwp-studio/src/recovery/autosave-manager.ts:148`, `upstream/rhwp-source/rhwp-studio/src/core/user-settings.ts:473` |
| 암호 문서 자동 복구 | 의도적으로 제한 | 평문 복구 export를 금지하고 이전 평문 복구본 제거. 암호를 유지한 안전한 자동 복구는 없음 | `apps/editor/src/mvp/recovery-export.ts:1`, `apps/editor/src/shell.ts:185` |
| 중단된 AI 실행 복구 | 부분 | 진행 기록은 interrupted로 표시하고 자동 재적용하지 않음. 정확히 어느 명령까지 적용됐는지 crash journal로 복원하거나 안전 재개하는 기능 없음 | `apps/editor/src/mvp/model.ts:35`, `apps/editor/src/mvp/store.ts:8` |
| 창 위치·최대화·DPI·모니터 복원 | 앱 계약 없음 / 한글 검증 필요 | 기본 실행 인자는 1440×960. 앱 자체 창 상태 직렬화 없음. Chromium/OS가 일부 기억하는지와 한글 동작은 실제 런처 대조 필요 | `apps/launcher/main.rs:112`, `scripts/Start-Jueony.ps1:67` |
| 임시 첨부·이번 요청 참고 체크 | 부분(설계상 임시) | 첨부는 세션 메모리, 새로고침 시 해제. 참고 체크는 업무 전환 시 비움. 지속 보관 첨부/공통 기관자료 계층은 별도 요구사항 | `apps/editor/src/mvp/temporary-references.ts:2`, `apps/editor/src/shell.ts:213` |
| 사용자 단축키 프로필·메뉴/도구상자 사용자화 | 없음/부분 | 기본 keymap은 고정 코드. 표시/숨김은 가능하지만 사용자 키 재매핑·키맵 import/export·메뉴 편집의 영구 설정 경로 없음 | `apps/editor/src/shortcuts/keymap.ts:8`, `apps/editor/src/shortcuts/install.ts:12` |

상태 보존이 구현되어 있어도 기존 한글 파일에서 글꼴·줄바꿈·쪽/구역·필드·그림·머리말·속성이 같은지는 이 코드 감사로 판단할 수 없다. 특히 ‘undo 재실행 보존’처럼 한글 기준 수명 자체를 아직 관찰하지 않은 항목은 제품 확장 요구와 실제 호환성 차이를 분리한다.

## 2. AI 제어: 현재 14종 명령만 연결

본문 4종 + 구조/서식 10종이다. 전체 한글 기능을 AI가 조작하는 상태는 아니다.

| 가능 명령 | 실제 제한 |
|---|---|
| `create_document` | 새 본문 문단 1~100개. 같은 응답에 다른 명령을 묶을 수 없음 |
| `insert_body_paragraphs` | 편집 가능한 본문 문단 뒤 삽입. 문단마다 4,000자, 줄바꿈/탭은 별도 문단으로 표현 |
| `replace_body_text`, `delete_body_text` | 편집 가능한 단순 본문 문단의 문자 범위. 문단 구조 삭제/이동이 아님 |
| `format_characters`, `format_paragraph` | 기본 글꼴/크기/색/굵기/장평/자간/첨자, 문단 정렬/여백/들여쓰기/줄·문단 간격 등 허용 속성. 글자 서식은 문단 전체, 범위별 혼합 서식 편집 아님 |
| `create_table` | 50행·20열·200셀 이내 단순 표. 새 표 resultId 사용 가능 |
| `set_table_cell`, `format_table_cells` | 한 셀 한 문단·동일 글자 서식·컨트롤 없는 셀. 병합/중첩 셀 제외. 글자·배경·정렬은 있으나 셀 테두리·여백 없음 |
| `insert_table_row`, `insert_table_column`, `delete_table_row`, `delete_table_column` | 병합/중첩/혼합 서식 없는 표, 결과 50행·20열·200셀 이내. 마지막 행/열 삭제 불가 |
| `set_page_setup` | 기존 구역의 용지 크기·방향·여백. 구역 생성/삭제, 쪽 내용 조작 아님 |

근거: `apps/editor/src/mvp/model.ts:10`, `apps/editor/src/document-control/operations.ts:4`, `apps/editor/src/document-control/operations.ts:20`, `apps/editor/src/mvp/edit-schema.ts:24`, `apps/editor/src/document-control/structure.ts:35`.

추가 한계: 요청당 명령 최대 30개(`edit-schema.ts:27`), 전체 문서 텍스트 120,000자(`editor-bridge.ts:36`), 표 구조 조회 1,000셀(`structure.ts:27`). 대상 ID는 현재 문서의 구역/문단/표 위치이며 버전이 바뀌면 거부한다. 일부 컨트롤 종류는 `unsupportedControls` 목록에만 나타난다(`structure.ts:20`). 긴 문서를 나눠 읽거나 특정 노드를 모델이 추가 조회하는 API는 없다.

### 아직 AI 명령으로 제공되지 않는 기능

| 영역 | 빠진 명령 | 기존 기능표 대응 |
|---|---|---|
| 본문 고급 편집 | 혼합 서식 범위, 필드 경계, 문단 나누기/합치기/이동/복제, 찾아 바꾸기, 복사/잘라내기/붙이기/모양 복사 | F015~F018 |
| 스타일·번호 | 스타일 CRUD/적용/상속, 탭·문단 테두리/배경, 글머리표/문단 번호 수준·재시작 | F023~F025 |
| 표 | 표 전체 삭제/이동, 행열 재배치, 병합/분할, 폭·높이·균등 분배, 셀 여백/테두리, 표 배치/반복 제목/쪽 넘김, 중첩 표, 표 나누기/붙이기, 계산/정렬/전치 | F026·F028~F034 |
| 쪽·구역 | 구역 생성/삭제, 다단, 쪽/단 나누기, 쪽 테두리·배경·바탕쪽, 머리말/꼬리말 CRUD, 쪽 번호/재시작/필드 | F036~F040 |
| 개체 | 그림 삽입/교체/삭제/자르기, 도형, 글상자, 배치/anchor/감싸기/앞뒤, 그룹/캡션, 수식, 차트/OLE/첨부 | F041~F048 |
| 참조·필드·검토 | 각주/미주, 책갈피/링크/교차참조, 누름틀/양식, 메모, 변경 추적·수락/거절, 차례/색인 갱신 | F049~F053·F055 |
| 자동 작성 | 맞춤법/사용자 사전, 통계, 메일 머지, 외부 데이터 연결 | F056~F057 |
| 파일·앱 | 열린 문서 선택/열기/닫기, 저장/다른 이름/형식, PDF/인쇄, 문서 속성/보호, 보기 이동/배율, workspace·폴더 관리 | F011~F013·F058~F063 |
| 외부 Agent | 현재 열린 문서를 제어하는 제품 MCP server | F066 |

이 표는 **AI 경로의 누락**이다. 사람이 메뉴로 표 셀 병합이나 그림/쪽 나누기를 할 수 있는지 여부를 ‘미구현’으로 덮어쓰면 안 된다. 수동 명령 `executeCommand`가 bridge에 있어도 모델 생성 계약에는 위 14종 이외의 명령이 없으므로 AI가 자유롭게 호출할 수 없다(`editor-bridge.ts:53`, `model.ts:15`).

사전 검사는 현재 문서 사본에 명령 적용→동일 형식 저장→같은 엔진으로 재열기 텍스트/구조 비교다(`editor-bridge.ts:59`). 원본 변경을 막는 유용한 검사이지만 **한글 렌더러 대조, 이미지/개체 배치·줄바꿈 보존 검증 전체를 대체하지 않는다**.

## 3. 단축키·매크로·Agent의 남은 범위

| 영역 | 현재 | 명확한 남은 범위 | 근거 |
|---|---|---|---|
| 한글 기본 키 매핑 | 부분 구현 | 일부 한글 키는 pending 예약만 있고 실행 없음: 문서 끼워 넣기 Ctrl+O, 머리말/꼬리말 Ctrl+N,H, 쪽 번호 Ctrl+N,P, 매크로 정의 Alt+Shift+H, 이전/다음 커서 Ctrl+=/Ctrl+Shift+=, 글자 스타일 해제 Ctrl+- | `apps/editor/src/shortcuts/keymap.ts:17`, `:56`, `:75` |
| 키 전달·선택 문맥 | 코드상 문서/표/셀/개체 구분 | 브라우저/IME/입력창과 한글의 물리 키 전달·연속키 대기 3초·반복키 처리·F3 단계 등 실제 일치 검수 필요. 등록됐다는 뜻과 한글과 같은 동작은 다름 | `apps/editor/src/shortcuts/keymap.ts:101`, `apps/editor/src/shortcuts/install.ts:94`, `:128` |
| 패널 F6 | 스타일 키맵과 채팅 이동 capture listener가 충돌 | 통합 감사에서 build.mjs가 iframe 내부에 먼저 설치하는 F6 listener를 확인했다. stopImmediatePropagation 후 채팅 이동을 요청하므로 상위 창으로의 전파 여부와 무관한 충돌이다. 실제 한글 메뉴의 F6는 스타일이며 Jueony 물리 키 재현은 후속 검사 | `apps/editor/scripts/build.mjs:140`, `apps/editor/src/shell.ts:304`, `apps/editor/src/shortcuts/keymap.ts:31`; 같은 폴더 `editor-code-audit.md` |
| 반복 작업 | 7종 지원 명령 저장·변수·재실행 | 기존 표/쪽 명령 기록 불가. 키/마우스 녹화, 한글 스크립트 매크로 가져오기·실행, 조건/반복, 다중 파일 일괄 처리 없음. 원문과 동일한 문단이 한 곳일 때만 재지정 | `apps/editor/src/macros/commands.ts:5`, `:18`, `:39` |
| 기관 업무 템플릿 | 공문·계획·결과보고의 단순 본문 템플릿 | 기관별 실제 결재/대외 공문 표·로고·서명/직인·붙임 양식, 공식 서식 검증, 결재·문서관리 연동 없음 | `apps/editor/src/macros/commands.ts:59` |
| RAG | 명시 자료의 어휘 검색 구현 | 영구 인덱스, 증분 감시, 임베딩/벡터 검색/reranker, OCR, PDF/DOCX/XLSX, 페이지/셀 수준 근거 위치, 공통 기관자료 범위 관리 없음 | `apps/editor/src/retrieval/selected-sources.ts:14`, `:31`, `:103`; `apps/editor/src/mvp/references.ts:33` |
| RAG 범위 | 요청당 20파일/120,000자, 1,000자 chunk, 8개/8,000자, 파일당 3개 | 폴더 등록만으로 자동 분석/검색되지 않음. 참고 폴더 내 미지원 파일은 건너뛰지 않고 오류. 실제 업무 검색 품질·사실 정확도 평가는 별도 | `apps/editor/src/mvp/references.ts:26`, `:33`, `:34`, `apps/editor/src/retrieval/selected-sources.ts:14`, `:33` |
| loop | 후보 생성+검토 최대 3회 후 한 번 적용 | 문서 읽기/도구 실행/관찰을 반복하는 일반 agent loop 없음. 명령 실패를 새 관찰로 삼아 재계획하는 흐름 없음. 비용/토큰 상한이 아니라 시간/문자 예산 | `apps/editor/src/agent/run-bounded.ts:22`, `:25`, `:52` |
| 실행 이력 | 단계·출처·revision·중단 상태 기록 | crash 후 단계별 안전 재개 journal 없음. 사용자 편집 이후 선택적 요청 undo/branch 없음 | `apps/editor/src/mvp/model.ts:21`, `:35`, `apps/editor/src/mvp/editor-bridge.ts:132` |
| 모델 연결 | GPT·Claude·Gemini·HyperCLOVA X·OpenAI 호환 API key 구성 | 브라우저 로그인/OAuth/PKCE/기기 코드 연결 없음. Gemini Vertex 인증 미지원. 현재 API-key 경로와 CLI 구독 인증은 별개 | `apps/editor/src/mvp/provider-presets.ts:3`, `apps/editor/src/mvp/llm.ts:12`, `apps/editor/src/shell.ts:371` |
| API key 저장 | Windows CurrentUser 보호 저장 선택 가능 | 키가 등록됨과 실제 제공자/모델 호출 성공은 별도. 이번 감사에서는 새 유료 호출 안 함 | `apps/launcher/credential-protect.ps1:8`, `apps/editor/src/shell.ts:382` |
| MCP | 없음(제품 live editor 경로) | upstream 파일 기반 MCP 후보가 있어도 Jueony의 미저장 열린 문서/권한/undo 계약에 연결된 서버는 없음 | 제품 `apps/editor/src`·`apps/launcher`에서 MCP tools/list·tools/call 및 서버 구현 검색, `docs/ai-editor-capability-matrix.csv:F066` |

## 4. 기존 문서의 오래된 분류를 교정할 항목

CSV 자체는 다른 감사의 충돌을 피하려고 수정하지 않았다. 통합 문서에 아래 현재 상태를 반영해야 한다.

| 기존 문서/행 | 오래된 설명 | 최신 코드 기준 권고 |
|---|---|---|
| `editor-state-contract.csv` S15, S19 | 파일 handle 없음 / SavedDocument 누락 / 재연결 미지원 | **부분 가능**으로 변경. 브라우저 handle+fingerprint 저장/재연결 구현, 네이티브 emulation/권한 범위 한계 기재 |
| 같은 CSV S16 | getAll key 순서 / 순서 필드 없음 | **가능, 한글 실측 대기**로 변경. `documentOrder`와 정렬 복원 반영 |
| 같은 CSV S08 스타일 창 | 다른 열린 탭 갱신 미연결 | rhwp UserSettings의 일반 동기화는 추가됨. `jueony-style-panel` 별도 키는 같은 경로가 아니므로 해당 창 키만 따로 확인 후 판정 |
| 같은 CSV S11/S12/S20 | 커서·선택·undo 세션만 | 여전히 맞음. 스크롤 복원과 커서 복원을 합쳐서 ‘완료’ 처리하지 않음 |
| `ai-editor-capability-matrix.csv` F007/F008 | 10종 공통 명령 | 현재 **14종**으로 정리. 본문 4종/구조 10종 구분 |
| 같은 CSV F065 | 런타임 미착수·single만 | **부분 구현**. 2~3회 후보 검토 후 단일 적용, 일반 도구 loop는 없음 |
| 같은 CSV F030 | AI 표 균등 미지원 | AI 경로에서는 여전히 미지원. 사람이 실행하는 전체 열/행 균등 부분 구현과 혼동 금지 |
| 같은 CSV F010 | 새 문서/템플릿 미착수 | AI 새 본문 문서, 수동 새 문서 기본값, 간단 업무 초안은 존재. 임의 HWP/HWPX 기관 템플릿 채우기는 별도 미지원 |
| 같은 CSV F006/F011~F013/F062~F063 | 미착수 | AI tool 확장 판정으로는 유효하지만 수동 앱/복구 기능은 이미 존재. 표 제목에 AI 노출 여부임을 명시 |
| `27`·`28` 문서 | 당시 편집기 없음/컴퓨터 도구 없음 | 당시 결과는 보존. 실제 한글 2024 설치와 이후 일부 GUI 관찰 결과는 최신 비교 보고서에서 별도 갱신 |

## 5. 우선 검수/개발 순서 제안

1. **P0 상태 수명 실측**: 같은 검수 복사본으로 한글/Jueony의 수정→undo→저장→재열기, 두 탭 전환, 배율/커서/대화상자 기본값, 종료 복구, 원본 외부 변경, 암호 문서 복구 정책을 기록한다. 코드가 없다는 이유만으로 한글도 하는 기능이라 가정하지 않는다.
2. **P0 키·문맥 실측**: 실제 키보드/IME와 본문/표/셀/개체/대화상자별 핵심 키를 대조하고 pending 키의 기능부터 구현 목록에 반영한다.
3. **P1 편집 엔진과 AI 연결 확장**: 표의 병합·분할/크기/테두리/여백/머리행→머리말/쪽번호/다단→그림/글상자/필드. 각 수동 동작·양 형식 저장 검수 후 같은 명령을 AI schema에 추가한다.
4. **P1 데이터 보존**: 통합 자동 복구 정책, 기관 템플릿/기본 스타일, 상태 백업·이관, crash journal과 복구 UX. 커서/선택은 실측한 한글 수명에 맞춰 구현한다.
5. **P2 Agent 확장**: 익명 업무 평가 corpus를 바탕으로 검색 품질·긴 문서 추가 조회·실행 후 관찰 loop를 확장하고 매크로 범위를 검증된 명령에 맞춰 늘린다. 브라우저 인증은 제공자의 공식 허용 경로를 확인해 별도 구현한다.

이 목록은 ‘완전한 한글 대체’ 완료 선언이나 전체 기능의 최종 분모가 아니다. 사용자 요구의 전수 비교에는 메뉴/대화상자/우클릭/입력 모드별 GUI 재현과 파일 보존·렌더링 독립 검증이 추가로 필요하다.
