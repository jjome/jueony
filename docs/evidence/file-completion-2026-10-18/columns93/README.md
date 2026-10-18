# 비례 단 너비 변환과 최종 자동 검증93

공식101패치 엔진 source-448ba81d29c9095a / 프런트 dist-file-preservation93. 이전99의 원본행·metadata 보존에 단 공통계산과 render-only lazy gate를 추가했다. 새4파일 after SHA와 render1파일 SHA를 확인했다. gate의 LF 후보와 실제 CRLF 빌드 소스는 원시/정규화 SHA를 따로 기록했고 코드/기하를 정규화하여 결과를 맞추지 않았다.

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| 같은 프런트 파일·복구16군 | 195/195 | 격리 UI/OPFS/Native IPC + 직접 WASM |
| Node22 단위 | 970/970 · skip0 | 고정 새 엔진 |
| native-row 직접 | 이전18/19 → 새19/19 | 같은 verifier SHA; 독립ZIP의 colSz 실제 단위 검사 |
| native-row UI | 13/13 | 실제artifact/report·OPFSreadback·live 전체배치·원본불변 |
| 기존 단·표 고정 근거/왕복 | 24/24 | 새 한글 GUI 조작 아님 |
| 실제 Windows Rust 저장 | 10/10 · ignore0 | 자체 문서·읽기전용·잠금·외부변경 보호 |
| 실행 묶음 | 7/7 | 별도 서버/CSP/인증/WASM/wire 계약 |
| TypeScript·모듈 경계 | 통과 | 별도 로그/JSON |
| private Rust 후속/소유권 | 6/6 + 7/7 | 필터 검사, 전체Rust 테스트 주장 아님 |

Prefix 안전 검사는 실제 긴 텍스트 증가를 확인하고, 불일치 HWPX를 쓰기 전에 거절해도 PASS다. 그 변환이 구현된 뜻이 아니다. private110 artifact는90개 checked(의미·전체배치0), 기존방향8·prefix12는blocked, history48은동일했다. 공식195와 합산해 제품 검증률로 표시하지 않는다.

본문42520HU의 native비례값[12000,20768]+1000을 XML단위[15110,26150]+gap[1259,0]으로 쓴다. 공개getter와 원본캐시만으로 놓치는 실제필드를 독립ZIP/CRC로 확인했다. frame불명·malformed배열·32767상한 초과는 ContentLoss를 보고해 저장을 거절한다. wrapping/clamping·원본 재봉인은 없다.

load/export봉인은 유지한다. Rendering에서만 originHWPX일때 지문을 lazy계산하고 nativeHWP·pureXML은None을설정한다. originHWPX의O(P*N) 비용은 남으며 임의revision캐시는 추가하지 않았다.

한글직접UI·OSpicker·화면/인쇄/최초조판 동등성은 미검수다. 소유파일/프로필/서버만사용하고 사용자문서·키·폰트·EXE·WASM은 포함하지 않는다. 합본재현은 scripts/verify_file_workflows.py, 단독은 apps/editor/scripts/verify-native-row-{preservation,engine}.mjs다. candidate/는동결proof·진단·runner를gzip으로보관하며 당시private/build경로 기록이다. verify.py로 바이트지문을 확인한다.
