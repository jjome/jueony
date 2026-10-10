# LLM adapter 확장 검증 — 2026-10-11

검증 대상: GPT·Claude·Gemini·HyperCLOVA X 설계 문서와 HyperCLOVA X native 구현.
현재 상태: **로컬 검증 통과 / 실제 클라우드 호출 대기**.

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| 앱/엔진 단위 검사 | 19 통과 | 실제 rhwp WASM, 본문 batch·undo·두 형식 재파싱·workspace/충돌 |
| 로컬 API 및 provider 검사 | 16 통과 | 기존 7개 + native protocol 8개 + native registry/합성 probe 1개 |
| HyperCLOVA native UI 경로 | 19 통과 | 설정·probe·실제 편집·undo·저장·재실행·키 비저장 |
| 기존 OpenAI 호환 UI 경로 | 18 통과 | 기존 workspace와 문서 작업 회귀검사 |
| TypeScript 및 Vite 빌드 | 통과 | 새 설정과 모델 타입, 로컬 자산 빌드 |
| 실행 묶음 smoke 검사 | 통과 | 동봉 Node 실행·native 등록·provider 파일 해시·UI 검증 소스 해시 일치 |
| 실제 NAVER Cloud | 미실행 | 계정 키·모델 권한·schema 수용·출력 품질 미확인 |
| 실제 한글 2024 | 미실행 | 저장물은 검수용으로 제공, 독립 호환 판정 대기 |

native/호환 UI 검사는 각각 독립적인 임시 브라우저 프로필에서 실행했다.
4193 앱 서버와 4194 결정적 protocol fixture를 사용했다. 외부 서비스에 문서를 보낸 검사가 아니다.
현재 UI 스크린샷의 연결 성공은 **로컬 fixture 응답**이며 NAVER 인증 성공 증거가 아니다.

## 재현 명령

프로젝트 루트에서 (Node.js 22 이상):
```powershell
node --test apps/launcher/tests/*.test.mjs
```

apps/editor에서:
```powershell
node --experimental-strip-types --test tests/*.test.ts
node scripts/build.mjs
node node_modules/typescript/bin/tsc --project .build/studio/tsconfig.json --pretty false
```

별도 테스트용 터미널을 프로젝트 루트에서 열어 앱 서버를 실행한다. 사용자 서버와 다른 포트를 쓴다.
```powershell
$env:JUEONY_PORT = '4193'
$env:JUEONY_DIST = (Resolve-Path 'apps/editor/dist').Path
node apps/launcher/server.mjs
```

다른 터미널의 apps/editor에서:
```powershell
$env:JUEONY_TEST_ADAPTER = 'hyperclova'
node scripts/verify-mvp.mjs
Remove-Item Env:JUEONY_TEST_ADAPTER
node scripts/verify-mvp.mjs
```

사용자 계정의 실제 API 키는 테스트에 사용하지 않는다. 검사 종료 후 자신이 시작한 4193 테스트 서버를 종료한다.
구현 코드와 JSON 명령을 검증하는 테스트이며 실제 추론 결과의 일관성/정확성은 검사하지 않는다.

## 근거 파일

- `bundle-smoke.json`: 실행 묶음 검사. API 설정 등록만 수행했으며 외부 호출은 하지 않음.
- `server-tests.txt`: 서버/adapter 검사 결과.
- `hyperclova-ui.json`, `compatible-ui.json`: 통과 항목, 브라우저, 빌드 소스 해시, 페이지 오류/외부 요청.
- `connection-settings.png`: 새 API 방식 선택과 합성 연결 검사 화면, 테스트 키 제거 후 촬영.
- `01-created`, `02-applied`, `03-reverted`의 HWP/HWPX: native fixture 경로에서 작성/수정/되돌린 저장물.

원본→수정본→되돌림본은 같은 엔진에서 문단 내용을 재파싱했다. HWP는 실제 UI 다운로드, HWPX는 그 저장물을 같은 엔진에서 변환한 동반 파일이다. 폴더 검사는 OPFS 핸들로 실행했으며 Windows 기본 선택 대화상자 검사는 아니다. 페이지 요청 감시는 OS/브라우저 전체 통신 차단 검사가 아니다.

실제 계정 연결과 한글 검수의 다음 단계는 [사용 가이드](../../14-hyperclova-x-api-guide.md)를 따른다.
