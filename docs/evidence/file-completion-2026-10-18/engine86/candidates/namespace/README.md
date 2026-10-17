# 원시 XML 리소스의 네임스페이스 소유 보존

정식83에서 유효한 ns0 alias 번호 리소스를 저장하면 선언이 사라져 malformed XML이 생성되던 결함이다. 실제 엔진8검수, 자체 두 문서의 두 차례 저장과 독립 Python XML 검사를 통과했다. 원시 fragment는 바이트 그대로, 소유 namespace context를 함께 저장한다. 확인되지 않은 binding은 추측하지 않고 저장을 거절한다. generated XML은 artifact 승인 전 namespace/root/entity 검사를 통과해야 한다.

Native 검수는 baseline83의 private source에 이 patch만 적용한 후보이며, 다른 후보 및 최종 합본 WASM 검수와 구별한다. 초기 upstream lib시험 fixture 부재와 준비 환경 변수 누락 실패는 별도 로그에 유지했다.

재현: 고정83 source에 patch를 strict apply한 private source의 tests/에 jueony_raw_namespace.rs를 배치한다. 두 자체 fixture는 repository build/line-fit-threshold80/에 복사한다. JUEONY_REPO를 WSL repository 절대 경로로 두고 해당 Native test target을 실행한다. 출력은 build/raw-namespace-closure83/에만 기록한다. 공개 문서, 폰트 프로그램, WASM, EXE는 포함하지 않는다. 독립 표준 ElementTree 검증은 source-and-independent-proof.json에 원래 출력 SHA와 entry 목록으로 연결된다.
