# 이음오피스 후속 구현과 검증

2026-11-21. [144번 계획](144-ieumoffice-reuse-plan.md)과 [첫 적용 기록](145-ieumoffice-implementation.md)을 이어서 진행했다. 이음오피스의 공개 고정 버전 `8602a39410adb86037f3008588b64efc75b08c60`에서 단축키, 저장, 사용자 모델 주소 관련 세 파일을 추가로 개별 확인했다.

## 바로 사용하는 기능

| 기능 | 구현과 사용 범위 |
| --- | --- |
| 문서 검토 | 행정 문서 검사에서 병합이 많은 표와 텍스트가 있는 한 칸짜리 표를 선택 검사한다. 중첩 표의 쪽 배치 검사에서는 정확한 부모·셀 경로를 사용한다. 화면에 기록된 글줄과 확인 가능한 셀을 검사한다 |
| 메모 | **검토 → 문서 메모**에서 본문 점 메모의 위치 이동, 한 줄 내용 수정과 삭제를 제공한다. 변경은 한 번에 되돌릴 수 있다. 필드 ID·작성자 메타데이터·앵커가 보존되는지 확인하며, 일반 저장에서도 재열기한 메모 본문과 앵커가 달라지면 원본 쓰기를 차단한다 |
| 참고 자료 | XLSX에서 보이는 시트의 셀 주소, 문자열과 저장된 수식 결과를 읽는다. PDF 글자 인식을 켜면 내장 OCR로 디지털 텍스트가 없는 쪽을 읽는다. 한국어 검색을 켠 동안 선택한 폴더와 파일의 증분 색인을 화면이 열려 있을 때 90초마다 확인한다. OCR은 자료를 보내는 요청이나 변환 창에서 실행한다 |
| 변환 사본 | 문서 패널의 **변환 사본**에서 DOCX의 본문과 단순 표, PDF의 텍스트 또는 OCR 결과를 HWPX로 만든다. 새 탭을 열기 전에 원문에서 옮기지 못한 항목을 보여준다. 원본 파일은 연결하지 않으며, 사본 바이트는 엔진 재열기로 검증한다 |
| 기본 업무 양식 | 문서 패널의 **양식 사본**에서 기관명·공문 제목이나 시작일·종료일을 넣고 미리 본 뒤 새 HWPX 탭으로 연다. 반복 실행마다 독립 사본을 만들며 기존 탭과 기본 양식 정의를 보존한다. **파일 → 기본 업무 양식 (빈 문서)**에서는 같은 값과 기본 서식을 한 번에 적용하고 되돌릴 수 있다 |
| 중첩 셀 병합·분할 | 검증 가능한 가로 한 행에서만 적용한다. 안쪽 표의 열 너비와 대상 경로를 증명하고, 이웃 표와 본문과 문양·서식 보존, HWP·HWPX 재열기, 되돌리기를 검사한다. 보호·필드·복합 구조가 포함된 표는 현재 범위에서 거절한다 |
| AI와 모델 연결 | Claude와 OpenAI 호환 모델에서 조회 결과를 다음 호출에 전달한다. OpenAI 호환 연결 설정은 문서 본문을 포함하지 않은 합성 요청으로 실제 도구 호출 지원을 시험할 수 있다. 변경 확인은 영수증의 실제 표·구역 변경을 보여준다 |
| 외부 명령 | 허용 폴더 안에서 저장된 HWP/HWPX 본문을 조회하고, SHA-256을 다시 대조한 뒤 서식이 균일한 본문 문단을 새 경로의 사본에서 교체하거나 삭제한다. 출력 경로가 이미 사용 중이면 기존 파일을 보존하며, 반환값에는 재열기 검증과 전후 해시를 포함한다 |

OCR은 한국어와 영어를 지원하며 PDF의 디지털 텍스트가 없는 쪽 중 최대 12쪽에서 실행한다. OCR 엔진·언어 데이터는 실행 묶음 안에 두고, PDF 해독용 worker와 이미지 해독기도 로컬에서 불러온다. XLSX는 시트 30개, 셀 3만 개, 내부 XML 합계 8MB로 제한한다. XLSX 수식 재계산과 표시 서식, PDF 표·쪽 배치, DOCX의 글꼴·복합 표·각주·개체 등은 새 사본에 재현되지 않거나 변환 전에 알려준다. [제3자 고지](../THIRD_PARTY_NOTICES.md) · [Tesseract.js 로컬 설치 계약](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)

## CLI·MCP 문서 사본

`JUEONY_DOCUMENT_ROOT`에 허용한 폴더를 지정하고, `JUEONY_ENGINE_PACKAGE`에 로컬 엔진의 `pkg` 절대 경로를 지정한다. `inspect input.hwpx`의 `revision`이 편집 계획의 `expectedSha256`이다. 아래 명령은 같은 폴더 안의 `input.hwpx`를 읽고 `output.hwpx`를 새로 만든다.

```powershell
node apps/launcher/document-cli.mjs inspect input.hwpx
node apps/launcher/document-cli.mjs apply-copy plan.json
node apps/launcher/document-cli.mjs mcp
```

```json
{
  "source": "input.hwpx",
  "output": "output.hwpx",
  "expectedSha256": "조회 결과의 revision",
  "operations": [{"kind":"replace_body_text","target":"s0p0","start":0,"count":1,"text":"수정"}]
}
```

로컬 stdio MCP의 `jueony_inspect_document`와 `jueony_save_edited_copy`는 위 환경을 설정했을 때 노출된다. 도구는 저장된 파일을 사용한다. 사본 출력에는 같은 폴더의 임시 파일을 하드 링크로 공개할 수 있는 파일 시스템이 필요하다. Claude 연속 호출에는 공식 Messages의 `tool_use`와 `tool_result`를 사용한다. [MCP stdio](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) · [Claude 도구 정의](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)

## 재현과 검증

고정 rhwp 0.8.7에 추적 패치 217개를 적용한 엔진 `bb037edaac3e0507`을 사용했다. 추가 패치는 본문 점 메모 수정과 중첩 표의 한 행 병합·분할에 해당한다. Windows에서 별도 포트로 실행했고, 빌드·타입·모듈 경계 검사와 편집기 2,012건, 실행기 56건, 작업표 12건이 통과했다. 조건부 편집기 검사 한 건을 건너뛰었다. Chrome과 로컬 모의 서버에서 검토 보고서, 메모 저장·재열기와 되돌리기, 모델 도구 왕복, 선택 자료 변경·삭제, 4쪽 모아찍기 PDF, 한국어·영어 OCR 및 양식 사본 흐름을 확인했다. 브라우저 사용 흐름에서 외부 HTTP 요청은 관측되지 않았다. HWP와 HWPX 양쪽의 구조·저장 검증은 편집기와 실행기 검사에 포함했다. [검증 매니페스트](evidence/ieum-followup-2026-11-21/manifest.json)

기존 검색과 한국어 BM25를 같은 파일 21개와 질문 22개로 다시 평가했다. 첫 결과 재현율은 27.8%에서 66.7%로, 평균 역순위는 0.567에서 0.807로 개선됐다. 상위 8개 재현율 100%를 유지했고, 무답 질문의 오탐은 4개 중 3개에서 1개로 줄었다. 평가기 계약 검사 69건이 통과했다.

한글 단축키 원본에서 본문, 표, 검색 및 기호 입력 경로를 대조했다. Jueony의 셀 선택과 F5, 한글 조합, 복사 실패 시 문서 보존은 기존 회귀로 확인했다. 업무·채팅 간 검색 범위, 색인 재시작·손상, 암호 문서 복구, 디스크 검증과 저장 충돌도 기존 회귀에 포함했다.

```powershell
$env:Path = (Resolve-Path .tools/node-v24.22.3-win-x64).Path + ';' + $env:Path
$env:JUEONY_ENGINE_PACKAGE = (Resolve-Path build/rhwp-engine/source-bb037edaac3e0507/pkg).Path
$env:JUEONY_TEST_BROWSER = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node apps/editor/scripts/build.mjs
node apps/editor/node_modules/typescript/bin/tsc --project apps/editor/.build/studio/tsconfig.json --pretty false
node scripts/check-module-boundaries.mjs
node apps/editor/scripts/run-editor-tests.mjs --test-concurrency=4
node --test apps/launcher/tests/*.test.mjs
node apps/editor/scripts/verify-ieum-first-slice.mjs
$env:JUEONY_RAG_OUTPUT = 'build/ieum-reuse/iu02/comparison-followup'
node --experimental-strip-types scripts/verify-rag-corpus.mjs --compare-bm25 --compare-new-engine
```

## 기관 서버 정책과 검증 환경

실행기에 `JUEONY_ALLOWED_MODEL_ORIGINS`를 JSON 배열로 지정하면 기존 등록 모델 호출, 새 연결, 합성 테스트, 로컬 모델 목록 조회에서 프로토콜·호스트·포트가 일치할 때만 요청을 보낸다. 빈 배열은 모델 호출을 차단한다. 정책을 지정하지 않은 개인 실행은 기존 연결 방식을 사용한다. 허용 외 주소 거절과 기존 키 제거를 합성 실행기로 검증했다.

검증은 Windows와 Chrome, 복원한 로컬 rhwp 엔진, 합성 파일과 모의 모델을 사용했다. 독립 한글 2024 열기·저장·출력, 실제 운영 모델 계정, 기관 공식 양식, 기관망 허용 주소와 프린터 드라이버는 해당 자료와 환경에서 확인해야 한다. 브라우저·구독 로그인은 공급자가 승인한 연결 방식과 기관 정책 결정이 필요하다. rhwp 0.9 업그레이드, 범위·표 메모 편집과 여러 행에 걸친 중첩 표 변경은 현재 엔진의 적용 범위 밖이다.

기관용 오프라인 번들 검사에서 현재 브라우저 빌드의 `runtime/webview2/LICENSE.txt` 누락을 확인했다. 서명된 기관 설치 패키지와 고정 버전 WebView2 런타임·고지, 승인된 서버 목록이 있어야 설치와 실제 통신을 검증할 수 있다.
