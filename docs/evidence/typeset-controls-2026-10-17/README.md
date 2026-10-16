# 자체 생성 한글 글자폭·탭 통제 자료

공개·사용자 문서를 복사한 자료가 아니라 Jueony가 만든11개 단순 본문 통제 문단입니다. control8개와 quantum3개를 각각 자체 HWP로 생성한 뒤, 부모 작업자가 실제 한글2024 UI에서 열고 별도의 Hancom 이름으로 저장했습니다. 원본과 재저장본4파일을 보존합니다.

CFB directory 이름·크기와 SHA는 manifest.json에 있습니다. BinData/font 스트림이 없으며 글꼴 프로그램을 추출·설치·재배포하지 않았습니다. 글꼴 이름은 문서 속성일 뿐입니다. 실제 Hancom PDF는 측정 근거로 로컬에만 두고 내장 글꼴 재배포를 피하기 위해 포함하지 않습니다.

formal-summary.json은 정식53패치 엔진9418a6df42a4ba6f의 좁은 typography/tab 검수와, 별도로 발견한 HWP→HWPX 변환 실패를 모두 기록합니다. 해당 변환 결함을 삭제하거나 이 자료를 전체 한글 호환률로 해석하지 않습니다.

재현은 apps/editor에서 JUEONY_ENGINE_PACKAGE와 JUEONY_TEST_OUTPUT을 절대 경로로 지정하고, JUEONY_TYPESET_CONTROL_INPUT을 이 폴더/control, JUEONY_TYPESET_QUANTUM_INPUT을 이 폴더/quantum의 절대 경로로 지정한 뒤 scripts/verify-typeset-controls-engine.mjs를 실행합니다. 실제 Edge Canvas는 같은 입력으로 scripts/verify-typeset-canvas.mjs를 사용하며 전용 로컬 포트4442를 사용합니다.

Node22에서는 `node --experimental-strip-types scripts/verify-typeset-controls-engine.mjs`로 실행합니다. Canvas는 `node scripts/verify-typeset-canvas.mjs`로 실행합니다. 두 검수기 모두 실제 사용할 엔진 pkg와 출력 폴더의 절대 경로를 요구합니다. 기존 결과 폴더를 재사용하지 말고 새 폴더를 지정합니다.
