자체 생성된 1쪽 HWT: title/note 두 ClickHere 일반 필드, 단순 xs:string sequence, XMLTemplate 3개와 자체 Opaque/Untouched 스트림. 상용·공개 문서 본문이나 폰트 프로그램 없음. Native114 기반 HWT115 fixture 생성기로 재현. 일반 HWT 전체 지원 근거가 아닙니다.

`duplicate-page-def.hwt`는 같은 자체 생성기의 Section0 끝에 기존 PAGE_DEF 레코드 1개를 동일 tag/level/payload로 중복한 음성 사본이다. 115는 편집 저장 때 2개를 1개로 줄였고, 116은 저장 전 HWT_EXACT_BODY_STRUCTURE로 거절해야 한다. 상용 원문 없음. Native 생성 시 선택 환경변수 JUEONY_HWT_DUPLICATE_OUTPUT에 새 경로를 주면 해당 사본을 create_new로 쓴다. source()의 ID 생성 시점에 따라 재생성 바이트는 달라질 수 있으며 보관본은 위 SHA로 고정한다.
