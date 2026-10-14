# N004 병합 셀 개별 문단 편집 및 글상자 저장 검증

2026-10-15 검수 후보. 기존 49종 검수 증거와 패키지는 변경하지 않았다. 엔진은 `31c6854ba64af4b5`, WASM SHA256은 `6e7e8ca9971063ae08ba5336fdd7ef5f73a66a055a82e0600adf4c21a52ded3d`이다. 정확한 소유 코드·검사 결과 지문은 `provenance.json`, 실제 앱 빌드 구성은 `application-build.json`에 있다.

| 검사 | 통과 | 실패 | 범위 |
| --- | ---: | ---: | --- |
| TypeScript | 0 진단 | 0 | 최종 소스로 다시 만든 Studio profile |
| 단위 | 8 | 0 | 중립 명령 계약·순수 계획·기존 셀 명령 보호 |
| 실제 WASM | 31 | 0 | 병합 셀 개별 문단, 원본 서식 바인딩, 자원, 저장 재열기, 실패 rollback |
| Edge | 12 | 0 | 네 제공자 프로토콜, 실제 채팅, 비교, 요청 단위 undo/redo, 안전 저장·UI 재열기 |
| 글상자 저장 | 14 | 0 | Top/Center/Bottom, 반복 저장, raw3 예약값과 명시 setter, 다른 속성 보존 |
| 형식 변환 | 24 | 0 | 공개 5문서 10 exports 및 자체 반례, 변경을 감지하는 동일 보존 검사 |

## 실제 지원 범위

`replace_cell_paragraph`는 HWPX 한 쪽 평면 비보호 표의 병합 주 셀 안에 있는 단순 문단 하나를 정확한 원문·위치·revision으로 교체한다. 빈 문단으로 교체 및 재입력도 지원한다. 혼합 글자 서식·필드·개체·책갈피·중첩·셀 영역 서식·복합 배치·페이지 분할 결과는 지원하지 않는다. 원래 `set_table_cell`의 병합 셀 제한은 그대로다. N004 전체 병합 후 편집 범위를 완료한 것으로 표시하지 않는다.

모델에 보내는 조회 정보는 셀 좌표/span, 문단 index/text 및 fingerprint뿐이다. Native ID, raw runs, 자원 바이트는 앱 내부 검증에만 사용한다. 적용 전후 기존 charShape/paraShape/style 바인딩, 다른 문단·표·본문과 HWPX header/BinData 저장 자원을 함께 확인한다. 오래된 결과, 자원 추가, 다른 문서 내용 변경, Native 부분 실패와 실제 post-render 배치 오류는 기존 요청 snapshot으로 복구한다.

저장 파일은 portable metrics를 사용하므로 실제 저장 재열기의 기하는 동일 portable 환경에서 비교하고 화면의 Canvas metrics는 즉시 복원한다. 별도로 Edge에서 실제 Canvas 화면과 UI 재열기의 전체 control/text 기하도 기존 0.2px 기준으로 비교했다. 허용 오차나 보존 검사를 완화하지 않았다.

## 저장 결함과 반례

새 글상자의 의미가 Top인데 cached LIST_HEADER 비트가 Center인 저장 결함을 수정했다. 알려진 값은 serializer가 의미에 맞춰 정렬 비트만 기록한다. 예약 raw3는 일반 저장에서 유지하며 `tbVerticalAlignKnown=false`로 노출한다. 명시적인 Top/Center/Bottom setter만 해당 비트와 의미를 함께 갱신한다. raw3를 HWPX로 옮겨 의미가 불명확해지는 경우 동일 전후 검사가 손실을 거절한다.

형식 변환 음성 반례는 유효한 실제 serializer loss report를 사용한다. 거절 사유가 `changed`이고 `serializer-report` 오류가 없음을 검사하므로 잘못된 검사 입력 때문에 우연히 통과하지 않는다.

## 증거와 제한

`native`, `browser`, `textbox-storage`의 문서는 검사 코드가 만든 자체 예제다. `zip-safety`에는 공개 코퍼스 결과 JSON과 독립 XML 확인 JSON만 저장했다. 공개 원본·파생 문서 바이트는 무시되는 build 폴더에만 있으며 이 증거 묶음에 포함하지 않았다.

네 제공자는 합성 인증과 응답을 사용하는 실제 프로토콜 adapter 검사다. 유료 모델 호출과 한글 2024 직접 비교는 미실행이다. 같은 엔진의 의미·자원·기하 보존 통과를 한컴의 완전 호환으로 해석하지 않는다.
