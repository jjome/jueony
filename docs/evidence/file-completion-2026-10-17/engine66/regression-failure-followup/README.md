# 공식66 실패와 후속 Native 검수 — 추가 보존 기록

| 구분 | 기록된 결과 | 판정 |
|---|---:|---|
| 공식66 전체 회귀 그룹 | 42/44 통과, 2그룹 실패 | **완료 아님·채택 불가** |
| outer-native live/저장 재열기 | 1/4 통과, 3실패 | HWP fresh·loaded, HWPX fresh의 Y168.7→153.6 불일치 |
| width-browser 실제 UI 저장 | HWP outer 대화상자 적용 후 저장 차단 | 기존 전체 배치 보존 검사가 실제 실패를 차단했고 UI 대기는 timeout으로 끝남 |
| 후속 최소 후보 Native | 기존10+신규3 = 13/13 통과 | private Native 증거이며 공식68 WASM 결과가 아님 |

상위 engine66의 기존 SHA256-MANIFEST.json과 모든 기존 payload는 바이트 그대로 유지했습니다. 상위 폴더의 이전 private31/한글 oracle 기록은 역사적 증거입니다. 이 추가 기록은 그 결과만으로 공식66 전체를 완료 처리하지 않도록 실제 실패 두 그룹을 원본 그대로 보존합니다. 최종 합본68 결과는 별도 engine68 묶음에서 관리합니다.

original66에는 원래 44그룹 exit-code JSON/로그, outer 실패3건의 원래 result/로그, width-browser 원래 result/로그와 실패 화면을 보존했습니다. 원본 JSON/로그를 수정하거나 기대값·0.2px 허용 범위를 바꾸지 않았습니다. browser 원본의 pageErrors에는 ‘표 높이 적용 후 저장 재열기의 표·본문 배치가 달라졌습니다.’라는 실제 보호 거절이 남아 있습니다. timeout만 제거해 성공으로 처리하지 않았습니다.

native-followup에는 실제4경로 실패를 재현한 Native trace, 후속13 PASS 로그, 후보 patch 원본과 compact 검수 결과를 포함합니다. 새3개 Native 중 실제4경로 검사는 모든 공개 control/text 배치 필드를 재열기와 비교합니다. 나머지는 생성기의 비봉인 raw6와 동일한 여백 복사, native 편집 세션의 재계산 host 및 정확한 anchor/top/occupied-bottom 관계를 확인하고 반례를 거절합니다. 보호/필드/잠금/noAdjust 및 기존10 검사는 유지했습니다.

source-proof에는 공식66 Rust1132개 baseline SHA 원본을 보존했습니다. 후속 후보는 renderer와 immutable HWP export 호출 인자 false 한 곳만 변경했습니다. root는 엄격 whitespace 빌드가 마지막 추가 빈 줄을 거절하자 원본 후보 patch를 유지하고 생산 patch에서 마지막 추가 빈 줄 한 개와 해당 hunk count만 수정했습니다. 양쪽 patch SHA와 source68 renderer가 마지막 개행 개수 외에 후보와 동일함을 독립적으로 확인한 기록을 포함합니다. 이는 소스 EOF 감사이며 문서 배치 비교를 정규화한 것이 아닙니다.

검증은 이 폴더에서 `python verify.py`로 실행합니다. 자체 추가 manifest, 상위 원래 manifest 및 기존39파일 SHA, 원래42/44 실패 분류, 실제 outer3 실패·browser 보존 거절, Native13, source/patch SHA를 확인합니다. 대용량 unit 로그, 전체 document/layout snapshot, 공개 문서, 글꼴 프로그램, WASM/EXE는 새로 복사하지 않았습니다. 상위 기존 파일은 삭제하거나 갱신하지 않았습니다.
