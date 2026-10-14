# Agent 기존 머리말·꼬리말 문단 정렬·줄 간격

2026-10-14. 기존 텍스트/기본 글자 서식 다음으로 문단 정렬과 백분율 줄 간격을 연결한다. 고정 rhwp 0.8.7과 기존 패치 WASM은 재사용한다.

28번째 공통 명령 `format_header_footer_paragraph {section,story,pageKind,originalText,properties}`는 현재 구역에 저장된 양쪽/홀짝 머리말·꼬리말 정의 한 문단에 적용한다. properties는 alignment(left/right/center/justify/distribute)와 정수 lineSpacingPercent(50~500)다. 정렬만 요청하면 기존 줄 간격 방식/값을 유지하며, 백분율을 명시하면 Percent 방식으로 바꾼다. 빈 기존 정의도 문단 서식은 바꿀 수 있지만 새 정의는 만들지 않는다.

문맥에 실제 정렬·줄 간격 방식/값을 조회하고 비교에 한글로 표시한다. Domain은 현재 원문·조회된 문단·편집 가능성·인자·단독 실행을 검사한다. Adapter는 원본을 재조회하고 기존 동일 텍스트 Native setter로 private token/IR을 검증한 뒤 applyParaFormatInHf를 호출한다. 보호 조건은 완화하지 않는다. 원문·글자 모양·다른 정의/구역·본문·감추기와 요청하지 않은 조회 가능 문단 속성을 대조한다.

공통 사본 preflight/저장 보호·요청 undo/redo·버전 충돌 거절·부분 변경 후 실패 복원·안전한 저장·업무 재실행을 사용한다. 자동 저장·정의 생성/삭제·상속 덮어쓰기·필드/개체·혼합/여러 문단·긴 원본·여백/들여쓰기/탭/테두리/번호/줄 나눔 옵션 변경·반복 기록은 지원하지 않는다. Native 조회가 없는 속성과 혼합 run 전체의 보존 검수 한계는 유지한다.

단위·실제 엔진·격리된 Edge의 네 제공자 합성 응답으로 검사한다. 실제 한글 직접 비교와 유료 모델 품질 검수는 마지막 별도 단계이며 전체 기능 완성으로 표시하지 않는다. 확정 수치와 실행본은 아래와 같다.

## 확정 검사와 실행

70번 최종 검사: 단위 517·provider/server 52·브라우저 404·실제 엔진 391 통과. 구현 `12cbb88`와 4264 검수본의 실제 소스/WASM/공통 계약 해시를 대조했다. 정렬·줄 간격 변경, 미요청 서식 보존, 요청 undo/redo, 실문서 실패 복원, 문단 서식만 바뀐 동시 편집 거절, 저장·업무 재실행을 확인했다. 한글 비교용 전용 HWP/HWPX 39개를 준비했다. 한글 직접 비교·유료 모델 품질·전체 한글 동등성은 완료하지 않았다.

전용 추가 검사는 단위 10개·실제 엔진 17개·격리된 Edge 14개다. 네 제공자(GPT Responses/Claude/Gemini/OpenAI 호환)는 실제 adapter에 로컬 합성 응답을 연결했다. API 키나 유료 모델 호출은 사용하지 않았다. 누적 검사는 동일 앱 소스/엔진으로 모두 실행했다. TypeScript와 9개 모듈·244개 소스 경계 검사도 통과했다. 패키지 호환 4개는 업무/채팅 격리·손상된 임시 문서와 중단된 실행 복구·알 수 없는 상태 필드와 폴더 핸들 보존·오프라인 파일 저장 재열기/되돌리기를 포함한다. 오류·skip·외부 자산 요청은 0이다.

실행: `build/jueony-agent-header-paragraph-20261014/Start-Review.cmd` 또는 같은 폴더의 `Start-Jueony.ps1 -Port 4264`. 검수 서버는 http://127.0.0.1:4264/ 이며 다른 실행 창과 사용자 문서는 유지했다.

앱 소스 SHA256: `961997ee8e89fe6507f42a91ff8b3d5adb77ea4a734d7f20a9e43d58b6ad9832`. 엔진 ID: `b975635f0614152d`, WASM SHA256: `eb1a657c9ea42f72c31b0dfb99c827ead31c9a6e5d2c1d4307720eb8c2354516`. 빌드 Git 기준은 `2c85e29` 작업 트리였고 이후 구현을 `12cbb88`에 확정했다. 실제 소스/바이너리 해시를 별도로 대조했다. 기존 MIT 참조 소스는 변경하지 않았고 새 의존성/자산/폰트는 추가하지 않았다.

증거는 `docs/evidence/agent-header-paragraph-2026-10-14/`의 `verification-summary.json`, `launch-check.json`, `paragraph-documents.json`, `agent-header-paragraph-native/result.json`, `agent-header-paragraph-browser/result.json`, `bundle-compatibility/result.json`이다. 매니페스트는 전용 기능 결과만 포함하며 누적 회귀 파일은 별도로 남긴다.

## 마지막 한글 2024 일괄 검수

1. Native 폴더의 `before-{header|footer}-{both|odd|even}.{hwp|hwpx}`와 `paragraph-*`를 열어 정렬과 180% 줄 간격을 비교한다. 양쪽 정의가 홀짝 정의에 가려질 수 있으므로 저장 정의 자체도 확인한다.
2. `modes-hwp.hwp`/`modes-hwpx.hwpx`에서 마지막 배분 정렬과 500% 줄 간격을, `empty-followup.hwpx`에서 빈 기존 정의의 문단 서식과 후속 기관명 입력을 확인한다. 큰 줄 간격 검수 파일은 의도적으로 설정 범위를 시험한다.
3. `retained-paragraph-*`에서 기존 여백·내어쓰기·문단 앞뒤 간격·글자 효과·첫 쪽 감추기를 확인하고, 브라우저 폴더의 `fixed-then-percent.hwpx`에서 고정 방식 유지 뒤 명시적 50% 전환을 확인한다.
4. `rendered-paragraph.hwpx`를 통해 지면의 가운데 정렬을 확인한다. 실제 엔진 SVG가 바뀌었음은 자동 검사했으나 실제 한글 지면/기능 동등성을 확인한 것으로 간주하지 않는다.

전체 문서화된 구현 범위는 미완료이며 자동 계속 작업은 유지한다. 다음 검수에서도 원본 보호를 완화해 지원 범위를 부풀리지 않는다.
