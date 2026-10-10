# HyperCLOVA X 연결 가이드 — 일반 NAVER Cloud

기준: 2026-10-11. 일반 NAVER Cloud 서비스 키와 **HCX-005**로 실제 연결·문서 생성·수정·비교·되돌리기·저장을 검사했다. 기관망 승인이나 문서 품질 전반의 검증을 뜻하지 않는다. [실호출 증거와 제한](evidence/hyperclova-live-2026-10-11/README.md).

## 이 PC에서 시작하기

1. `C:\Users\jjome\Documents\work\jueony\Start-Jueony.cmd`를 실행한다.
2. 채팅 위 연결에서 **NAVER 서비스 · HCX-005**, 모델에서 **HCX-005**를 선택한다.
3. 합성 문서로 초안 작성이나 본문 수정을 요청한다. 현재 문서의 미저장 내용도 사용한다.
4. **변경 확인**, **요청 되돌리기**, 오른쪽 **저장**으로 검사한다.

사용자가 제공한 서비스 키는 이 PC의 `%LOCALAPPDATA%\Jueony\connections.dpapi`에 Windows DPAPI CurrentUser로 암호화해 등록했다. 소스, Git, 채팅 기록, IndexedDB에는 키를 넣지 않는다. 키 파일은 실행 묶음에 포함되지 않으므로 다른 PC에서는 연결을 다시 등록한다.

## 키·모델 변경

채팅에서 수정할 연결을 선택하고 **AI 연결 설정**을 연다.

| 항목 | 이 계정에서 확인한 값 |
| --- | --- |
| API 방식 | HyperCLOVA X · v3 |
| 연결 이름 | NAVER 서비스 · HCX-005 |
| Endpoint | `https://clovastudio.stream.ntruss.com/v3/chat-completions` |
| 모델 ID | `HCX-005` |
| 최대 출력 토큰 | `4096` (HCX-005 허용 범위 1024~4096) |
| API 키 | CLOVA Studio 서비스 키 원문. Bearer 접두어 제외 |

- **키 교체:** 새 키를 입력하고 **연결 저장**. 비우면 기존 키를 유지한다.
- **주소·모델·API 방식 변경:** 키를 명시적으로 다시 입력해야 한다. 이전 키를 다른 목적지로 자동 전송하지 않는다.
- **새 연결:** **＋ 새 연결**. 테스트/서비스 계정을 별도 이름으로 관리할 수 있다.
- **선택 연결 삭제:** 해당 연결과 저장 키를 삭제한다.
- **모든 키 삭제:** 서버와 암호화 파일의 모든 키를 삭제한다. 비밀이 아닌 기존 모델 설정은 화면에 남을 수 있다.
- **이 Windows 계정에 암호화 저장:** 선택하면 재실행 후 복원한다. 해제하면 서버 메모리에만 보관하고 이전에 저장한 해당 키도 디스크에서 제거한다.

키 입력창은 등록/검사 후 비워지고 원문은 화면에 반환하지 않는다. 연결 저장 자체는 API를 호출하지 않는다. **연결 테스트 (API 호출)**는 문서·대화·자료 없이 합성 요청 1회를 보내며 사용량이 발생한다. 새 키를 테스트한 경우 저장하려면 다시 입력한다. 이미 등록한 키의 테스트는 빈 입력으로 가능하다.

암호화 실패 시 평문으로 저장하지 않는다. 손상/다른 계정의 저장 파일은 자동 덮어쓰기하지 않는다. 키를 따로 확보한 뒤 명시적으로 **모든 키 삭제** 후 재등록할 수 있다. DPAPI는 같은 Windows 계정의 다른 프로세스까지 격리하는 보안 경계는 아니다. [Microsoft DPAPI 설명](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata?view=windowsdesktop-9.0).

## 계정·서비스 앱과 모델 확인

새 계정은 [NAVER Cloud 콘솔](https://console.ncloud.com/)에서 CLOVA Studio를 신청하고 [API 키 안내](https://guide.ncloud-docs.com/docs/clovastudio-apikey)에 따라 테스트/서비스 키를 발급한다. 서비스 키는 [서비스 앱 신청](https://guide.ncloud-docs.com/docs/clovastudio-app-publish)의 승인된 모델과 맞춰야 한다. 테스트 키라고 무료로 가정하지 않는다.

이번 계정의 코드 보기 화면은 `POST https://clovastudio.stream.ntruss.com/v3/chat-completions/HCX-005`를 제시했다. HCX-007 호출의 `No Service App` 오류는 승인된 모델이 HCX-005였음을 확인한 뒤 해결했다. Endpoint 칸에는 모델명을 제외하고 넣는다. 키 종류/모델/endpoint를 자동으로 바꿔 재시도하지 않는다.

## 모델별 구현

| 모델 | 요청·응답 방식 | 변경 검증 |
| --- | --- | --- |
| HCX-005 | maxTokens, tools, 지정 toolChoice; submit_document_edits 호출 1개만 허용 | 모델이 반환한 원문 전체와 snapshot을 정확히 대조한 뒤 앱이 Unicode 범위를 계산 |
| HCX-007 | maxCompletionTokens, thinking.effort:none, responseFormat schema | 기존 범위 명령과 출처·문서 버전 검사 |

HCX-005 자유문 JSON의 구문 오류와 글자 수 오산을 실호출에서 확인하여 최종 구현에 함수 호출을 사용했다. HCX-007 전용 Structured Outputs 옵션을 HCX-005에 보내지 않는다. [HCX-005 v3](https://api.ncloud-docs.com/docs/clovastudio-chatcompletionsv3), [Function calling](https://api.ncloud-docs.com/docs/clovastudio-chatcompletionsv3-fc), [HCX-007 Structured Outputs](https://api.ncloud-docs.com/docs/clovastudio-chatcompletionsv3-so).

함수 이름/개수/원문이 틀리거나 응답이 잘렸으면 적용하지 않는다. 자율 loop는 없다. 모델 1회 호출 → 내부 명령 변환 → 기존 앱 검증 → 열린 문서 적용 순서다. 자동 재시도·자동 저장은 하지 않는다.

## 확인된 범위와 검수

- 지원: 새 문서, 본문 삽입·교체·삭제, 여러 위치 변경, 요청별 비교·되돌리기, 사용자 저장.
- AI 미지원: 표·서식·개체·쪽 설정·문단 이동. 표 내부/혼합 서식/컨트롤 문단 등은 편집 가능 판정에 따라 제한한다.
- 실호출 검사: 합성 문서 1건, 미저장 제목의 일부 제거와 마지막 문단 삽입, 비교·undo, HWP 다운로드, HWP/HWPX 엔진 재열기.
- 품질 제한: 최종 초안은 제목과 항목명만 반환했다. 지시한 한 문장 분량까지 충족한 것은 아니다. 초안 완성도·사실성·자료 출처 정확도는 후속 평가가 필요하다.
- 한글 2024 독립 검사: [검수 파일](evidence/hyperclova-live-2026-10-11/)의 01-created, 02-applied, 03-reverted를 열어 내용·문단 경계·서식·재저장을 확인한다. HWPX는 UI 저장 HWP를 같은 엔진으로 변환했다. 실제 한글 검사는 아직 하지 않았다.

실호출 재현은 apps/editor에서 `node scripts/verify-hyperclova-live.mjs`로 실행한다. 숨김 키 입력 후 최대 3회의 유료 API 요청을 사용한다. 합성 문서만 전송하며 실제 업무 데이터와 키 저장소는 사용하지 않는다. 결과는 apps/editor/evidence/hyperclova-live/에 기록한다.

## 오류와 기관망

인증 오류는 키뿐 아니라 **승인된 서비스 모델 ID**를 확인한다. 429는 한도 확인 후 직접 재요청한다. 잘못된 도구/원문/응답 종료는 문서를 바꾸지 않는다. TLS 검증을 끄거나 다른 제공자로 자동 우회하지 않는다.

구버전 서버가 실행 중이면 열린 문서를 먼저 저장하고 해당 Jueony 서버만 종료한 뒤 다시 실행한다. 새 시작 스크립트는 암호화 저장 API가 없는 서버를 재사용하지 않는다. 모든 Node/브라우저 프로세스를 일괄 종료하지 않는다.

일반 클라우드 AI에는 인터넷 연결이 필요하다. 공공용/기관망은 별도 endpoint·키·모델·허용 정책을 확인해야 하며 이번 일반 계정 성공으로 기관 배포가 검증된 것은 아니다. [공공용 안내](https://api-gov.ncloud-docs.com/docs/clovastudio-overview). GPT·Claude·Gemini 전용 adapter는 [구현 명세](13-llm-provider-adapters.md) 단계다.
