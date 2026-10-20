# SignedPartial177 독립 Native 음성 검사

검사 cohort는 official172 + frozen4 runtime11파일 + cfg(test) 추가 + 제외된 검증 wrapper다. 공식177 전체 소스 동일성으로 주장하지 않는다. 신규 SignedPartial177 production body는 frozen4와 같다. 소스 지문, Rust1150파일 SHA, 실제 시험 리소스, wrapper 원문, Cargo.lock, 실행 스크립트와 원본 결과를 보존했다. cfg3개, 8입력×12조건의96거절, 매번 원복 후 정상 생성이 모두 통과했다. 공식177 전체 Native105검사의 증거는 ../general177에 있다. 별도 보충이며 중복 집계하지 않는다.

실행: `python verify.py`.
