# Agent 구역 기본 탭과 HWPX 줄 번호 도구

2026-10-14. 수동 편집에서 사용하던 구역 기본 탭과 기본 본문 줄 번호를 Agent의 제공자 중립 명령으로 연결한다. 기존 문서 엔진·편집 명령·요청 단위 snapshot·안전 저장을 재사용한다. 한글 2024 직접 비교와 전체 기능 도구화는 완료하지 않았다.

## 실제 지원과 명령 계약

`set_section_tabs`는 기존 구역 하나의 기본 탭 간격을 0.1~9999pt로 바꾼다. HWP/HWPX 모두 지원하며, 문단의 개별 탭 목록을 새로 만들거나 수정하지 않는다. 문서 전체에 적용하려면 조회한 각 구역에 명령을 보낸다. 기존 수동 편집의 실측 계약과 같은 `pt × 200` 모델 값을 사용한다. 원본의 0은 수동 편집과 동일하게 기본 40pt로 읽으며 같은 값의 요청은 setter를 호출하지 않는다.

`set_line_numbers`는 HWPX의 가로쓰기·한 단·일반 본문 구역에 기본 줄 번호를 설정한다. 조회 결과 `lineNumbers.editable`과 파일 형식을 검사한다. 쪽마다/구역마다 새 번호 또는 이어서 매기기, 시작 번호와 표시 간격 1~65535, 본문과의 간격 0~50mm를 받는다. 간격은 왼쪽 용지 여백 안에 있어야 한다. 기본 번호 글꼴은 기존 엔진의 8pt이며 문단의 번호 억제 설정을 임의로 해제하지 않는다.

```json
{
  "message": "구역의 기본 탭과 줄 번호를 설정합니다.",
  "sourceIds": [],
  "operations": [
    {"kind": "set_section_tabs", "section": 0, "spacingPt": 24},
    {"kind": "set_line_numbers", "section": 0, "enabled": true,
     "restart": "page", "countBy": 2, "startNumber": 10, "distanceMm": 4}
  ]
}
```

줄 번호 명령의 모든 필드는 필수다. 현재 유효한 설정은 요청하지 않은 한 유지하며, 꺼진 원본의 0/미지 기본값으로 새로 켤 때는 쪽마다·1부터·매 줄·5mm의 기본값을 안내한다. 그 간격도 실제 여백 안이어야 한다. HWP 문서는 먼저 사용자가 HWPX로 저장한다. Agent가 자동 변환·저장했다고 응답하지 않는다.

표·개체·특수 영역·세로쓰기·숨긴 빈 줄 등 기존 엔진 지원 범위 밖의 줄 번호는 변경하지 않는다. 지원 범위 밖의 원본 줄 번호가 켜져 있으면 끄는 명령도 읽기 전용으로 거절한다. 개별 문단 탭, 줄 번호 글꼴 변경, 자동 HWPX 저장, 구역 생성·삭제, 임의 메뉴 실행과 외부 MCP 서버는 이번 구현에 포함하지 않는다. 새 명령을 반복 작업으로 기록하는 확장도 별도다.

## 레이어와 실행

공통 wire schema는 본문 4종과 구조/서식 15종, 총 19종이다. UI와 Agent는 문서 모듈의 public DTO/Facade만 사용한다. `Structure.sections`에 물리 단위의 `defaultTabSpacingPt`, `lineNumbers`를 선택 필드로 추가하여 현재 파일·저장되지 않은 상태를 모델과 변경 비교 화면에 전달한다. 기존 채팅/receipt의 선택 필드가 없는 경우도 유지한다. native 엔진 핸들을 UI나 provider adapter의 응답 타입으로 전달하지 않는다.

`domain/agent-section-settings.ts`는 값과 단위 변환, `control-operations.ts`는 대상·능력·요청 내 설정의 상호 검사를 맡는다. `adapters/rhwp/agent-section-settings.ts`는 기존 엔진 호출과 실제 결과 확인을 맡고, `line-numbers.ts`의 수동 지원/검증 경계를 재사용한다. SDK별 응답 형태나 인증 방식이 이 경계에 들어오지 않는다. GPT·Claude·Gemini·CLOVA·호환 API는 같은 canonical schema와 provider 안내를 사용한다.

요청 내 명령 순서를 추적한다. 줄 번호가 켜진 구역을 다단으로 바꾸거나 표를 추가하거나 왼쪽 여백보다 번호 간격이 커지게 만드는 명령을 거절한다. 명시적으로 번호를 끈 뒤 다단/표로 바꾸는 순서는 허용한다. 첫 번째 명령 뒤에 미지원 명령이 있어도 전체 검증·사본 저장 검사 뒤에만 실제 문서를 변경한다. 번호가 켜진 문서에 대한 후속 요청도 같은 경로를 사용한다.

Agent 실패 복원 비교는 현재 파일 형식의 `recoveryBytes`를 사용하도록 보강했다. HWPX 줄 번호를 HWP로 변환해 비교하면 설정 손실 또는 변환 거절 때문에 정상 요청과 복원 판정이 막힐 수 있다. 현재 형식의 내용 손실·재열기 보존 검사와 바이트 비교를 모두 유지한다. 복원이 확인되지 않으면 기존 PartialApplyError/손상 차단을 계속 적용한다.

구조 DTO의 `lineNumbers.editable`은 문서 내용에서 계산하는 능력 값이다. 표를 삽입하면 설정이 그대로여도 false로 바뀐다. 문서 삽입 회귀는 저장되는 쪽·탭·번호 설정을 전부 비교하고, 능력 값은 별도로 true→false와 대조한다. 실제 보호 검사를 완화하지 않는다. 한 단의 `sameWidth=false`도 엔진이 지원하는 경우가 있어 줄 번호 판정에는 실제 단 수를 사용한다.

## 검증과 실행

전용 실제 엔진 11개와 Edge 10개를 검사한다. HWP/HWPX 구역별 탭, 남은 구역/문단 서식 유지, 세 번호 방식, 실제 번호 조판, 저장 재열기, snapshot undo, 번호가 켜진 파일의 후속 변경, HWP/표/다단 거절, 명시 해제 뒤 다단, 늦은 사본 실패와 실제 문서 실패 복원을 포함한다.

실제 채팅에서는 GPT Responses·Claude Messages·Gemini GenerateContent·OpenAI 호환 adapter를 선택하고 각각의 모델 ID와 최신 문서 설정이 로컬 합성 provider에 전달되는지 검사한다. 설정만 바뀌는 요청의 변경 비교·요청 undo/redo·안전 저장과 재실행도 확인한다. 잘못된 모델 명령과 응답 대기 중 문서 변경은 전체 적용을 막는다. 유료 API 호출 성공이나 실제 모델의 한국어 판단 품질로 계산하지 않는다.

CLOVA HCX-005의 tool 응답과 HCX-007의 JSON 응답도 provider fixture 검사에 포함한다. 키는 합성 문자열을 서버 메모리에만 등록하며 사용자 키 저장소를 읽거나 수정하지 않는다. 검증 기록에 키/인증 헤더를 남기지 않는다. RAG·적용 전 재검토·취소·기존 반복 작업은 기존 회귀로 별도 검사한다.

최종 전체 수치와 실제 앱/패치/WASM 해시는 [검증 요약](evidence/agent-sections-2026-10-14/verification-summary.json)을 따른다. 초기 브라우저 스크립트의 변경 비교 대화상자 ID 오류는 실제 `change-dialog` 경로로 바로잡았다. 첫 탭 검사에서는 구역에서 상속한 문단의 defaultTabSpacing도 바뀌므로 이 값의 예상 변경과 나머지 명시 서식 보존을 구분했다.

새 실행 묶음은 `build/jueony-agent-sections-20261014/Start-Review.cmd`, 같은 폴더의 Rust 실행 파일은 `JueonyEditor.exe`, 주소는 `http://127.0.0.1:4242/`다. 합성 검수 문서는 `review-documents/agent-sections/section-native`와 `section-browser`에 포함한다. 이전 서버·실행 창·사용자 문서를 유지한다.

기본 탭과 HWPX 줄 번호의 내부 Agent 도구 연결을 완료하는 범위다. 전체 쪽 편집, 개체·복잡한 표·필드, 구역 생성/삭제의 Agent 도구, 외부 MCP, 기관 배포와 한글 2024 직접 비교는 남는다. 전체 문서화된 범위는 완료되지 않았으므로 자동 계속 작업을 유지한다.
