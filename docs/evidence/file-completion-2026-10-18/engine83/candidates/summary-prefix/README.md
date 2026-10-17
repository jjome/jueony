# 새 XML 문서의 문서요약 owner 이름 수정 후보

공식82 source-65b8886bcdae0760의 신규 XML fallback 생성 한 경로가 OLE property-set 제어문자 U+0005를 빠뜨렸습니다. 엔진 자체 summary reader는 두 이름을 모두 수용해서 손실 검수도 통과했지만 실제한글은 표준 owner 이름만 읽었습니다.

실제한글 통제 실험은 자체 작성한 동일 5필드 문서의 CFB directory 이름만 바꾸고 모든 논리 stream payload를 정확하게 유지했습니다. prefix0→한글 HWPX는 5개 필드 모두 원문과 달랐고, prefix5→동일한 SaveAs는 5개 모두 원문/SHA가 같았습니다. LPWSTR 및 CodePage는 두 사본에서 완전히 같고 실제한글 원본도 같은 표현을 사용하므로 수정하지 않습니다. author 값/공개본문은 근거에 출력하지 않습니다.

후보는 parser/hwpx/contract_streams.rs의 신규 fallback 이름만 표준화합니다. 기존 native HWP의 ASCII 이름/원문은 이 변경으로 재작성하지 않습니다. 독립69의 exact6 소유조건은 ASCII/prefix5 표기 중 정확히1개를 같은 논리소유로 인정하고 normalized unique6을 유지합니다. 두 별칭 동시존재·원래 표준경로 빠짐·opaque/case 차이는 여전히 기존 차단경로입니다.

Private Native 기준은3/5 PASS+2 FAIL이며, 동일5개 후보 검수는5/5 PASS(ignored0)입니다. Strict 적용 결과와 실제컴파일 source SHA가 정확히 같습니다. 정식 WASM/통합 회귀는 별도입니다. 엔진 저장/문서 전체/실제한글 조판 호환성 완료를 의미하지 않으며, 기존 legacy ASCII-owner HWP를 자동수리하는 권한은 추가하지 않습니다. 공개·사용자 파일 또는 정식 엔진은 변경하지 않았습니다.
