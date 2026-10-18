# HWPX 원문 보존과 메타데이터 읽기·쓰기 검증91

고정 엔진 `source-f339aba305da3aa9`(98패치)을 새로 컴파일했다. 같은 프런트엔드 빌드에서 파일/복구14군 **163/163**, 단위 **970/970(skip0)**, TypeScript 검사를 통과했다.

독립 ZIP 검사14사례는 기존86에서0/14, writer만 수정한 중간96 엔진에서6/12, 읽기·쓰기까지 연결한 최종98 엔진에서14/14다. 중간12와 최종14는 사례 수·verifier가 다르므로 같은 시험의 일대일 비교로 합산하지 않는다. before/after14는 같은 verifier SHA다.

실제 WASM에서 본문을 바꾸고 2회 내보내기/재열기를 수행한 뒤, 5개 문서 속성을 바꾸고 다시 저장/재열기한다. 매번 production 의미·전체 지면 보호를 통과해야 한다. ZIP은 별도 Node ZIP/CRC 리더로 풀어 원래 확장 XML·속성·package 식별자·Scripts bytes와 원래 spine 참조를 확인한다. 스크립트는 실행하지 않는다.

Rust21/13은 실제 production writer/namespace validator 및 Xml parser/writer를 추출한 격리 harness 검사이며 전체 Rust 라이브러리 검사와 구별한다. 소스98은 WASM 전체 release 컴파일도 통과했다. 원문 namespace 증폭의32MiB/4MiB 예산 검사, 잘못된 namespace·중복 script ID·중첩 가짜 manifest 거절을 포함한다.

직접 Windows/한글 비교, 원MCST의 최초15→16쪽 차이, 명시 글 방향의 HWP5 매핑 및 전체 파일 메뉴 동등성은 완료하지 않았다. 음수 표 배치 후속 수정은 이 근거에 포함하지 않는다. 사용자 창/문서/키/프로필/폰트/공개문서 전체나 바이너리 산출물을 저장소에 포함하지 않는다.
