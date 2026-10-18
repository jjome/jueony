# 합본106: Native 앞 문단 저장

공식113 `fc150ef856868d03`, WASM `569268eb2fed77851e7449cf19e37dadbee629f68a12f642bb76b49de06369bc`. 정확한225개 소스의 resource와 실제 WASM이 만든 저장 descriptor.resource가 일치한다.

`python verify.py`로 파일 크기·SHA와 결과를 독립 검사한다. manifest는 자신을 제외한 모든 파일을 포함한다. 공용 문서 원본과 글꼴은 이 묶음에 복사하지 않았다.

- `workflows/`: 동일 엔진·프런트30군387개. 원래374개 통과, 참조 엔진 기대 오류가 난13개는 수정 후 재실행했다. 나머지29군은 현행 검사기/결과 SHA가 일치해야만 재사용했다.
- `before/`: 첫387개 합본의 실제 실패, 공식111·112의 앞 문단 실패, 참조 엔진 기대 오류를 유지한다.
- `workflows/native-prefix-storage/`: 실제 Native와 생성 HWPX의32경로, 총160번 성공적인 저장·재열기와 초기 seed1회. 지면·의미·원문과 원래/후속 인스턴스의 history를 모두 확인한다.
- `workflows/native-prefix-ui/`: 실제 isolated headless Edge·OPFS에서 p44·p48 편집 후 저장, undo/redo, 재열기·후속 저장. 사용자 창·한글·실제 API는 사용하지 않았다.
- `remaining/native-python-official113.json`: 원형 두 형식3회씩은 성공. 뒤 본문/셀 편집4경로는 지면265개 차이로 실패이며 의존 저장12회는 미실행이다. 이것을 성공에 포함하지 않는다.
- `native/`: 공식113의 선택18개 Rust 검사, 전용 Cargo target, 테스트 전용 원본 fixture의 provenance. 전체4027개를 실행한 것은 아니다.
- `checks/`, `columns/`, `windows/`, `bundle/`: 단위1008, TS·모듈 경계, 작업표12, 단·표24, 실제 Windows 저장10, 실행 묶음7.

보호 코드·원본·직렬화 캐시를 느슨하게 고쳐 성공시키지 않았다. 본 문서는 파일 파트 전체 완료나 한글 직접 비교 통과를 뜻하지 않는다.
