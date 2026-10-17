# 109. 한글 실측 후 파일 보존 결함과 후속 검수

2026-10-17 **진행 중**. [108번 기록](108-file-preservation-completion.md) 이후 실제 한글 2024와 Windows 실행본을 검사하면서 발견한 결함, 수정 범위와 남은 검수를 추적한다. 검수한 세부 항목만 CSV·기능별 집계에 반영하며, 파일·저장 기능 전체의 완료 선언은 하지 않는다.

현재 편집·저장 엔진 통합 기준은 **`cda65172283c6657`(68패치)**이며 단위868·기존44회귀를 통과했다. 문서 정보 API9·실제 Edge10과 표 바깥 여백 실제4경로·보호/원시 보존31검수를 완료했다. 닫기·종료 후속은 실제 Edge+합성 Native IPC10을 통과했고 최신 전체 타입 검사도 통과했다. 새 흐름의 실제 Windows GUI·한글 대조·Agent 연결은 미검수/미연결이다. 65와 거절된66의 원본 결과는 아래에 보존한다. 아래의 51·53·56 기록과 실패는 당시 결과로 보존한다. 53의 HWP→HWPX 변환 지면 손상 6경로와 새 HWP 글상자 손상, HWP/HWPX 미정 탭 저장 결함은 후속 수정·검수했다. 다만 표 높이의 실제 한글 계약과 복잡 공개 문서의 배치 차이는 남아 있다. 실제 Windows 51패치 실행본에서 확인한 종료·재실행 복구를 새 65패치 실행본 검수로 확대하지 않는다.

아래 `build/` 링크는 로컬 진단·검수 근거다. 최종 마감 시 보존할 결과와 사본을 정리하고 링크를 확정한다. 기존 실패 결과와 immutable 엔진·실행본은 덮어쓰지 않는다.

## 2026-10-17 실제 한글 11사본과 Windows 복구 후속

한글의 문서 정보 창을 사용자가 닫은 뒤 창을 새로 선택했다. 이후 실제 불러오기와 다른 이름 저장으로 자체 원본 11개의 별도 사본을 확보했다. 접근성 번호 캐시가 맞지 않는 파일 선택창은 새 화면을 확인한 좌표·키 입력으로 조작했다. 사용자 문서와 기존 실패 사본을 덮어쓰지 않았다.

| 검수 | 정식68 결과 | 판정 |
| --- | --- | --- |
| 두 표·세 표, 일반/Unicode/위 첨자 후속 본문 | 실제 한글 사본 5쌍 전체 의미·지면 차이 0, 양형식 엄격 재저장 통과 | G096 직접 비교 완료. 원점 tail 기본 경로 확인 |
| 현재 재조판·안전 높이 명령을 거친 긴 본문·캡션·양수 캐시 사례 | 실제 한글 사본 3쌍 전체 의미·지면 차이 0, 양형식 엄격 재저장 통과 | G105의 현재 편집·저장 경로 완료. 임의 원본 캐시 폐기 권한을 뜻하지 않음 |
| 실제 양수 offset, 음수 offset, 두 단 원본 | 3쌍 지면 실패. 원문·요약 정보 차이는 0 | N001·G106 미완료 유지. 좌표 예상값을 후보에 맞추지 않음 |
| Windows 정식68 실제 실행본 | OS 선택창 HWP 열기 → 본문 ` GUI68` 입력 → Ctrl+S → 파일 독립 CFB 읽기 성공 | 저장 파일 SHA `2a513516ed04436e7b914cc867aaba450b4b8a73b4862cd7e56f71a64c06b410` |
| 같은 실행본 복구 수명 | 미저장 ` RECOVERY68` 입력 → 종료 취소 → 복구본 보관 종료 → 실제 창 소멸 → 재실행 복원 → 다른 이름 저장 | 디스크 원본 SHA 유지, 화면에서 최신 내용과 수정 상태 복원. 별도 사본 독립 읽기는 후속 기록 |

세부 검증 완료는 **18/24에서20/24**로 갱신했다. 상위10개의 전체 형식·옵션·Agent 계약을 이 결과로 완료 처리하지 않는다. [실제11쌍과 실패 전체](evidence/file-completion-2026-10-17/hancom-current68/actual11-formal68.json), [48개 보존 파일 지문](evidence/file-completion-2026-10-17/hancom-current68/SHA256-MANIFEST.json), [범위와 재현 설명](evidence/file-completion-2026-10-17/hancom-current68/README.md).

옛 multiline/caption의160/158 저장 줄 경계와 선언 높이 실패도 같은 증거 묶음의 history에 그대로 남겼다. 현재 편집으로 재조판한 출력의 성공을 무편집 옛 원본의 성공으로 바꾸지 않는다. 최신 후보의 양수 위치·음수 위치·다단 수정은 아직 생산 승격 전이며 별도 검수한다.

## 2026-10-17 후속 구현: 정식68과 종료 원자성 보강

사용자가 요청한 파트 전체 마감과 세부 저장 결함 마감을 혼동하지 않는다. `013df6a`의 정식65 저장·Undo·속성 거래 수정과 최근 문서 재연결은 커밋·푸시했다. 현재 상위10개 전체 완료는 여전히0이며, 이를 검사 묶음 수로 대신하지 않는다.

- 66 후보의 전체44 회귀에서 **42통과·2실패**를 확인했다. 바깥 여백 명령의 HWP fresh/loaded·HWPX fresh 세 경로에서 live/reopen 위치가 달랐고, 실제 HWP 속성창의 저장 보호가 그 차이를 차단했다. 실패를 완료로 올리지 않는다.
- 후속은 생성기의 알려진 비봉인 raw6 상태와 Native 편집 세션의 정확한 재계산 host 소유만 보완한다. 보호·여백 사본 불일치·알 수 없는 비트·실제 산술 관계의 음성 대조를 유지한다. Native13과 정식68 합본의 기존44회귀(실제 Edge17 포함)는 통과했다. 기존31범위는 신규 메타데이터 차이를 독립 읽기로 분리한 뒤 통과했다. 실제 한글 HWPX는 빈 제목을 `앞 본문`으로 채워 title1차이가 남으며, 이를 의미0으로 표시하지 않는다. 네 HWPX 음성 원본의 HWP 변환은 예전 writer가 작성자를 `edward`로 바꾸던 결함을 원본 `rhwp`로 보존하도록 수정했다. 다른9개 CFB stream·unknown9개 PID·전체 summary 재구성 bytes는 정확히 검수했다.
- 문서 정보는 제목·주제·작성자·키워드·설명5필드의 원자 편집, snapshot Undo/Redo와 두 형식 보존을 추가했다. Native15·독립 CFB/OPF 읽기·정식68 API9·실제 Edge10을 통과했다. 실제 메뉴 편집→Undo/Redo→양형식 저장·재열기와 고의 손상 거절까지 검수했다. 날짜·이력·한글 통계 동일성이나 Agent 연결까지 완료했다고 주장하지 않는다.
- 실제 한글2024에서 자체 HWP의5필드가 표시됨을 확인했다. `build/document-metadata-candidate/hancom-review/hwp-summary.png`와 접근성 텍스트를 보존했다. 취소 입력은 `failed to activate captured window`로 실패했고 창 재선택 후에도 같은 오류여서 직접 입력을 중단했다. 따라서 이 검사는 **화면 읽기 확인**이며 실제 한글 재저장 확인이 아니다.
- 파일 메뉴의 문서 닫기·끝을 기존 안전 coordinator로 연결하고, 미저장 종료의 파일 저장/저장 안 함/복구본 보관/취소와 실패 시 복구 보존을 구현·검수했다. clean/다른 업무 checkpoint가 실패한 종료에서 바뀌던 실제 결함을 단일 commit과 전체 값 CAS 보상으로 수정했다. 실제 Edge10 통과, Native picker/destroy는 합성 IPC이며 실제 OS GUI 성공으로 세지 않는다.

## 상위10개를 완료로 올리지 못한 구체 항목

| ID | 기능 | 현재 구현한 부분 | 전체 완료까지 남은 부분 |
| --- | --- | --- | --- |
| B001 | 새 문서 | 기본값을 적용한 독립 문서 탭, Agent 본문 생성 | 새 창/새 탭의 분리된 수명·명령, 실제 한글 대조와 전체 Agent 계약 |
| B002 | 새 탭 | 독립 문서·이력·복구 탭 | 독립 명령/활성 탭 관리·새 창과의 구분, 전체 수명 검수와 Agent 연결 |
| B005 | 불러오기 | HWP/HWPX 실제 열기와 안전한 파일 연결 | 한글 상위 불러오기 형식·옵션 전체, 기관/암호·복잡 원본의 검수, Agent 파일 권한 계약 |
| B006 | 최근 문서 | native 업무별 등록·fresh token 재연결·변경 동의·원본 보존 | 새 Windows 실행본에서 실제 재시작/선택창 검수, 한글 동작 대조와 Agent 연결 |
| B009 | XML 문서 | 일부 엔진 읽기만 존재 | XML 탭·서식·스키마/문서 입출력 UI와 명령·저장·검수·Agent 연결 |
| B010 | 저장 | readback·충돌·보존/지면 검사·안전한 원자 쓰기·현재 dirty/Undo 보호 | 복잡 원본 N001/N002의 미해결 조판, 상위 형식/옵션 전체, Agent 파일 수명과 최종 실제 앱 검수 |
| B011 | 다른 이름 저장 | 형식 유지·최종 승인·취소·원본 수명과 재저장 | 상위 형식/옵션 전체·복잡 원본 및 최종 Windows 검수·Agent 연결 |
| B014 | 문서 정보 | 통계 조회와5요약 항목 원자 편집·Undo/Redo·양형식 보존 | 날짜·저장자/이력·사용자 정의 정보, 한글 통계 동일성, 실제 한글 재저장·Agent 연결 |
| B021 | 문서 닫기 | 탭 저장/폐기/취소, 통합 메뉴 연결 | 상위 전체 수명과 한글 대조·Agent 연결, 최신 Windows 직접 검수 |
| B022 | 끝 | OS X 및 파일 메뉴의 같은 보호 coordinator, 네 가지 종료 선택 | 다문서·다른 업무 원자 commit/실패 보상 UI검수10 통과. 최신 실제 Windows GUI·한글 대조와 Agent 연결은 남음 |

이 표는 남은 범위를 축소하거나 기존 부분 항목을 완료로 바꾸기 위한 표가 아니다. 코드 수정·검수 증거가 생긴 부분만 기능별 문서에 갱신한다.

## 이전 마감 묶음: 정식65 후속

이 파트는 아직 전체 완료가 아니다. 상위 10개는 한글 파일 메뉴의 전체 수명과 Agent 연결을 포함하고, 아래 24개 저장 결함의 합계로 대체할 수 없다. 최근 재검사는 처음 **44묶음 중41묶음 통과**였으며, 나머지를 검사 완료로 숨기지 않는다.

| 항목 | 확인한 결과 | 상태 |
| --- | --- | --- |
| 저장용 높이 동기화와 AI 되돌리기 | 같은 전체 snapshot 편집에 파생 높이를 귀속. 요청 ID·원본 revision·현재 history 객체가 모두 일치할 때만 저장 후 Undo 허용. 이후 실제 편집이 있으면 거절 | 수정·실제 Edge 검사 통과 |
| 표/셀 속성 편집과 저장의 높이 | 내용이 이미 점유한 비보호 프레임만 속성 편집의 같은 거래 안에서 갱신. 실제 셀 최소 높이·보호·별도 큰 프레임은 유지 | HWP/HWPX 여백 편집·저장·재열기의 전체 지면 일치, Undo/Redo 통과 |
| 저장·다른 이름 저장 보호 | 실제 명령·앱 저장창·OPFS 쓰기, 취소·조회/배치/적용 오류·원복·원본 불변 | 최신 화면14/14 통과. 실제 OS 선택창/전원 손실 검수로 확대하지 않음 |
| G071 비겹침 후속 표 | 실제 한글이 별도 저장한 양형식 사본의 3개 표. 겹침 금지·본문 통째 표 조건을 실제 조회하여 확인 | 정식65 의미0·전체 공개 배치0·읽기 오류0·1쪽 유지, 반복 저장2회. 제한된 항목 마감 |
| 현재 통합 단위 검사 | 정식65 엔진과 현재 코드852/852, 건너뜀0 | 통과. 한글 전체 호환률이 아님 |
| 전체44 회귀 | 중간 실행43/44의 바깥 여백 파생 높이 차이를 속성 거래에서 수정. 최종44/44 통과(Native27·실제 Edge17) | 기록된 회귀 통과. 파트 전체 완료와 구분 |
| G073 표 바깥 여백 | 실제 한글 사본의20개 Y 차이 원인 분리. 제한된 렌더 수정 후보와 변환 후 소유 문제 검수 | 미완료. 후보를 생산 성공으로 표시하지 않음 |
| B006 최근 문서 | native app-data에서 업무별 경로 소유, 프런트에는 opaque ID. 재시작 재연결·변경 동의·삭제/권한/취소 보호 | TS30·실제 Windows Rust18·실제 Edge+합성 native IPC9 통과. 실제 Windows GUI 재시작·한글 대조·Agent 명령은 미완료 |
| B014 문서 정보 | 통계 외 제목·작성자 등5필드 편집과 양형식 보존을 별도 구현 | 미완료. 아직 생산 기능으로 노출하지 않음 |
| 나머지 상위 범위·복잡 원본 | 창/탭 구분, XML 기능, 닫기/종료 전체 수명, Agent 파일 명령, N001/N002 등의 독립 지면 | 미완료. 체크만 바꿔 마감하지 않음 |

[정식65 근거 묶음](evidence/file-completion-2026-10-17/engine65/)에는 실제 한글 양형식 사본·스크린샷, 독립 정수 높이 대조, 처음 실패와 수정 후 결과를 보존한다. 이전63 결과는 아래에 그대로 둔다. 새65 Windows 실행본은 앱 승인 시간 초과로 직접 GUI 검사하지 못했으므로 과거51 실행본의 검수를65 검사로 바꾸지 않는다.

## 정식 63 통합 결과

| 검수 | 결과 | 판정 범위 |
| --- | --- | --- |
| 새 합본·프런트엔드 | 빌드 성공, WASM `e1cff3403dc66cf4e0e46507a27431e863f95931c465d0d84e5acd9fddf72cb8` | 기존 실행본·증거를 덮어쓰지 않은 새 산출물 |
| 실제 엔진 지정 단위 검사 | 839/839, 건너뜀 0 | 모델·어댑터·저장 계약 단위 검사 |
| 저장·표·상태 회귀 | 44/44 묶음, Native 27·실제 Edge 17 | 표 편집·저장 재열기·undo·Agent 연결의 기록된 범위 |
| 재조판·변환·원점 | Native 72/72·실제 Canvas 8/8 | 긴 혼합 본문 변환·표 원점·탭·독립 통제 문서. 머리말/꼬리말 음성 대조 포함 |
| HWP/HWPX 탭 | HWP 8회·HWPX 12회. 생산 HWP의 20/40/60pt 구역을 실제 한글에서 확인·재저장 | 실제 사본 의미 차이 0·전체 배치 차이 0·3쪽 유지. 기본값·바이너리 탭 폭·캐시 개수 독립 검산 |
| 글상자·개요 파서 | 기존 정렬 14·신규 저장 6·heading 12 통과 | 공식 생성 HWP 세 정렬은 실제 한글에서 열고 재저장한 사본의 원본과 바이트 동일. 세 실제 비교 모두 의미·배치 차이 0 |
| 꺼진 그림자 속성 | 17사례×2회 저장=34회 통과 | 생산 HWPX 실제 한글 재저장도 `NONE/#000000/0/0/0` 유지, 의미·배치 차이 0 |
| 너비만 변경 시 높이 | 12/12 통과 | 자동·작은 보호·큰 높이의 원시 값 보존, 명시 높이 변경·undo 대조 |
| 저장 보호·복구 | Native guard 18·실제 Edge guard 3·형식 변환 다운로드/강제 종료 복구 3 통과 | 변조 출력은 파일창·쓰기 0회로 차단. 테스트가 만든 브라우저만 종료·재실행. 원본 불변 |
| 공개 문서 실제 한글 비교 | 기존 8비교 중 2 PASS·6 FAIL 유지 | python1 좌표 차이 142개 해소, 원시 자원 ID 재인덱싱 40개 유지. python3·MCST의 줄/복잡 지면·쪽 수 차이는 미완료 |

[검수 묶음과 SHA 목록](evidence/file-completion-2026-10-17/engine63/manifest.json)에 통과·실패·해석 범위를 함께 보존한다. 고유 기능 수, 시나리오 수, 반복 저장 횟수와 묶음 수를 합산해 한글 호환률로 표현하지 않는다. 기본 탭 G069와 알려진 글상자 정렬 G092는 이 범위에서 마감하며, 파일 파트 전체 완료를 뜻하지 않는다.

현재 추가 작업은 한글 실측으로 확인한 표의 공통 높이 캐시와 셀별 최소 높이 계약이다. 공통 높이만 9000인 비보호 표는 한글이 5181로 재저장하지만, 실제 행 높이를 3000씩 지정한 표는 합계 9000을 유지한다. 보호 표 두 대조는 내용 대신 셀/안 여백 최저 합계 1981로 저장되고 글자가 잘린다. 이를 모두 같은 ‘명시 높이’라고 보았던 가설은 기각했다. 47·48 후속의 v4 후보는 원점·반복 저장 실패를 수정하고 실제 한글의 양형식 재저장 차이 0을 확인했으며, 정식65 합본과 앱 저장 거래 검수로 진행 중이다. 저장 보호를 완화하거나 검수값을 정규화해 통과시키지 않는다.

### 진행 중인 실제 한글 반례와 수정 후보

| 구분 | 재현·원인 분리 | 현재 상태 |
| --- | --- | --- |
| 표 높이 명시 동기화 | 실제 한글의 일반 표 5181HU·행 직접 지정 9000HU를 독립 정수 행 합계와 대조. 변경은 실문서 명령과 단일 snapshot undo로 연결 | 최초 후보의 세 표 HWP 재열기 +8/+16px를 v4에서 수정. Native14·엄격20·불변15·연속4/5표2·너비12 통과. 실제 한글로 두 형식 열기·재저장 후 의미/전체 배치 차이 모두 0. 정식 합본·저장 화면 검수 중 |
| Canvas와 저장 측정 환경 | 통제된 실제 WASM Canvas 측정에서 계획9981HU/portable5181HU 불일치를 재현. 화면 측정 상태가 저장 모델에 새지 않도록 계획·적용 전체를 같은 portable 문맥에서 수행 | Canvas 활성5대조 통과: 읽기 전용·원래 측정 상태 복원, 양형식 저장·전체 배치·undo, 예상 밖 조회 오류와 배치 오류의 finally 복원. 실제 브라우저 글꼴값이나 한글 실측값을 조작해 만든 정답으로 취급하지 않음 |
| 단일 표 바깥 여백 | HWP·HWPX 각각 실제 한글에서 열고 별도 저장. 의미 0·배치 20차이. 표 속성은 같고 뒤 문단 LINE_SEG의 Y만 3200→7997HU로 바뀜 | 원본의 그 필드만 바꾸면 실제 사본과 배치 0, 역변경하면 원래 배치로 복귀. 단순 캐시 제거는 해결되지 않음. live 원점 분기의 제한된 수정 후보 진행, G073 완료 보류 |
| 공개 python3 다단 | 모든 stream payload를 유지하고 출처 마커 이름 한 바이트만 바꾼 통제 실험에서 위치·크기 320차이가 재현됨 | 실제 한글 재저장이 마커를 제거하는 조건의 최소 합성 fixture와 수정 후보 진행. 실제 사본의 자원 ID·run 분할 차이 411개와 개요 글꼴명 차이는 별개로 유지 |
| 공개 MCST 복잡 문서 | 마커만 바꾸는 대조로는 전체 20,878차이를 설명하지 못함. 실제 한글이 본문 67문단·전체 71문단의 줄 캐시를 바꿈 | 최초 차이는 휴먼명조 13pt·혼합 자간의 줄 분할 46/88→44/86/128. 현재 재조판도 p60~62가 다르며 실제 16쪽/엔진 15쪽 문제와 함께 미완료. 글꼴 대체·허용치 확대·필드 제외로 처리하지 않음 |

[단일 표 양방향 A/B](../build/outer-native-diagnosis63/diagnosis-summary.json), [HWPX 실제 저장 비교](../build/hancom-owned-file-review-20261017/compare-outer-hwpx-final63/result.json), [공개 문서 원인 분리](../build/public-compat-readonly-20261017/diagnosis.json). 이 표의 후보는 정식63 결과나 완료 항목으로 합산하지 않는다. 원본·실패 사본·검수 당시 엔진을 그대로 보존한다.

## 후속 수정 검수: 글상자·탭·잠재 속성

아래는 정식56 이후 후보를 개발하던 당시의 원인·검수 기록이다. 이 표의 ‘남은 통합 검사’는 당시 작업이며, 현재 완료 여부는 맨 위 정식63 표를 기준으로 읽는다. 당시 사본·엔진의 결과를 새 실행본의 실제 UI 검수로 바꾸어 기록하지 않는다.

| 결함 | 원인과 수정 | 실제 확인 | 남은 통합 검사 |
| --- | --- | --- | --- |
| 새 HWP 글상자 열기 실패 | 새 글상자의 SHAPE_COMPONENT 플래그가 `0x00080000`으로 기록됨. 독립 한글 생성 HWP와 대조해 `0x01000000`으로 수정하는 42번 후속 패치 | 플래그만 바꾼 대조 파일의 실제 열기·재저장 성공. 수정 엔진이 새로 만든 Top·Center·Bottom HWP도 각각 실제 한글에서 열기·정렬 표시·별도 재저장 성공. 세 사본 모두 공개 의미 차이 0·전체 배치 차이 0·1쪽 유지 | 최종 합본에서 생성·저장 보호·브라우저 회귀 재검수. 기존 파일의 원시 플래그와 다른 도형은 유지 |
| 개요 7·8·9 읽기 실패 | 실제 한글 HWPX의 2016 namespace heading 분기를 파서가 무시함. 43번 후속 패치는 해당 분기를 읽되 기존 margin 분기와 구분 | 후보에서 heading 12/12 통과. 기존 생산 탭 HWPX 대 실제 한글 사본의 의미 차이 6→0·배치 0·3쪽 유지 | 최종 합본에서 같은 사본으로 재검수 |
| HWP의 미정 탭과 줄 캐시 | HWPX와 별개로 HWP 바이너리에도 미정 탭 폭과 LINE_SEG가 함께 남아 40pt 구역의 문자가 붙음. 44번 후속 패치는 정확한 미정 탭 문단의 모델 직렬화 캐시를 생략 | LINE_SEG만 제거한 독립 HWP 대조를 실제 한글에서 열어 40pt 정상 분리 확인. Rust의 HWP 4개·HWPX 4개 실제 실행 통과 | 최종 출력의 신규·편집·변환 세 경로와 실제 한글 재저장. 기존 무편집 raw BodyText는 원본대로 보존 |
| 꺼진 그림자의 잠재 색상 | 모든 값이 0이면 HWPX writer가 shadow를 생략해 한글이 기본 회색을 채움 | `NONE/#000000/0/0/0`만 명시한 독립 대조 문서를 실제 한글에서 열고 재저장하니 같은 값 유지. 명시 값 보존 필요성을 확인 | writer 수정과 비영 그림자·다른 도형 회귀 검사 진행 중 |
| 표의 너비만 바꿀 때 높이 손실 | 셀 너비 setter가 요청하지 않은 commonHeight도 덮는 별도 결함 발견 | 자동 높이 0·작은 보호 높이·큰 명시 높이·큰 보호 높이 모두 기존 엔진에서 손실 재현 | 너비만 변경할 때 높이와 raw 값을 보존하는 수정 검수 중. 한글의 실제 행 높이 재계산과 구분 |

글상자 후보 검수는 Rust 6개·WASM 32개를 실제 실행했다. 최초 잘못된 시험 fixture의 실패와 Cargo 공유 캐시의 0개 실행은 통과로 세지 않고 보존했다. [후보 검수 지문](../build/textbox-contract-candidate/summary.json), [Top 실제 재저장 비교](../build/textbox-contract-candidate/hancom-Top-comparison/result.json), [Center 비교](../build/textbox-contract-candidate/hancom-Center-comparison/result.json), [Bottom 비교](../build/textbox-contract-candidate/hancom-Bottom-comparison/result.json).

## 발견 당시의 결함 기록

**아래는 53·56 검수 당시의 발견·조치 기록이다. 현재 수정 결과는 위의 정식63 표를 기준으로 읽는다.** 자체 왕복 통과와 실제 한글 호환성은 별도 판정한다. 원본, 실패 사본과 이전 엔진은 보존한다.

| 항목 | 실제 확인 결과 | 현재 조치 |
| --- | --- | --- |
| HWP↔HWPX 표 흐름 | 53패치의 변환 실패 6경로를 새 37번 후속 패치로 수정. 순수 HWPX·제외 조건은 기존 바이트까지 대조 | 정식 56패치 `3a01e912b92dc8af` 빌드 완료. HWP/HWPX 출력에 같은 배치 보호를 적용한 Native 18개·실제 Edge 3개 통과. 변조 저장물은 파일창/쓰기 0회로 차단 |
| 기본 탭 20/40/60pt | 실제 한글에서 세 구역을 확인하니 40pt 구역만 `ABC`가 붙음. 기본 탭 값은 맞지만 폭 미정 탭과 기존 LINE_SEG가 함께 남음 | 정확한 미정 탭 문단의 HWPX 줄 캐시만 생략하는 40번 후속 패치. 정식 56의 12경로 및 Rust 4개 통과. 생산 HWPX 출력도 실제 한글에서 세 구역 정상 분리·재저장 확인, 전체 지면 차이 0. 별도 HWP 출력에는 같은 결함이 남아 바이너리 저장 경로 보강 중. 미사용 스타일 6개 파서 차이는 별도 실패로 보존 |
| 공개 문서 4개 | 모두 실제 한글에서 열고 별도 Save As 완료. python-hwpx-0만 원본/변환 대 한글의 공개 의미·배치 모두 동일 | [8개 비교 결과](../build/hancom-final-file-review-20261017/public-comparison-final53/batch-summary.json). python1은 표 전체 약 21.3px 이동, python3은 줄·자원 참조 차이, MCST는 복잡 지면 차이와 한글 16쪽/엔진 15쪽 관측을 별도 유지 |
| 새 HWP 글상자 | 53패치 Top HWPX의 위·가운데·아래 정렬은 실제 한글에서 표시·재저장됨. **같은 엔진이 새로 만든 Top HWP는 한글에서 ‘파일이 손상되었습니다’ 오류** | [실제 오류 화면](../build/hancom-owned-file-review-20261017/textbox-Top-hwp-corrupt.png). 정상 HWPX를 한글이 직접 HWP로 저장한 독립 기준 사본을 확보해 바이너리 구조 결함을 조사 중. 기존 엔진 반복 저장 통과를 외부 열기 성공으로 취급하지 않음 |
| 혼합 서식 변환 | 긴 본문의 14pt 굵은 글자 줄에서 HWP→HWPX 왕복 후 폭이 증가. 글자 자체 폭과 줄 끝 공백의 양쪽 정렬 분배를 분리 | 별도 최소 후보를 검증 중. 글꼴·공백 문자열·지면 허용치를 바꾸어 통과시키지 않음 |

공개 문서의 실제 한글 비교 8건은 같은 네 원본의 두 비교이므로 고유 문서 8개가 아니다. 한글의 자원 재인덱싱은 원시 ID 차이로 남기고, 참조 자원의 실제 서식과 위치 결함을 별도로 조사한다. 공개 문서 본문·파생 파일은 Git에 추가하지 않는다.

정식 56의 HWPX 미정 탭·형식별 저장 보호 검수는 [보존한 검수 묶음](evidence/file-completion-2026-10-17/engine56/manifest.json), [실제 Edge 보호](evidence/file-completion-2026-10-17/engine56/format-guard-edge.json), [한글 탭 독립 읽기](evidence/file-completion-2026-10-17/engine56/hancom-tab-readback.json)에 보존한다. 실제 엔진을 지정한 단위 검사 **839/839, 건너뜀 0**, 원본/한글 사본 변환 16/16을 확인했다. 새 글상자 손상·공개 문서의 외부 비교 실패를 이 통과 수로 상쇄하지 않는다. 53패치의 글자폭·탭 폭 수정과 독립 통제 자료는 `8771dd9`, 56패치 저장 보강은 `71a0ab3`에 커밋했다.

## 108번 이후 확인한 사실

| 단계 | 실제 확인한 범위 | 결과와 판정 경계 | 근거 |
| --- | --- | --- | --- |
| c370 기본 파일 직접 비교 | 한글에서 저장한 기본 본문 HWP/HWPX의 본문·조회 속성·용지·1쪽 및 Jueony 반복 왕복 | 4개 통과. 복잡 표·글상자·탭·인쇄 동등성의 근거가 아님 | [기본 파일 결과](../build/hancom-file-preservation-20261017/engine-roundtrip/result.json) |
| c370 겹침 파일 직접 비교 | multiline / caption-multiline / positive-caption-gap 원본과 실제 한글 재저장본 | **3 PASS / 6 FAIL**. PASS 3개는 한글 저장본을 Jueony에서 다시 저장한 자체 왕복이다. 원본 대 한글의 의미·전체 지면 비교 6개는 실패 | [실패 결과](../build/hancom-file-preservation-20261017/overlap-roundtrip/result.json), [독립 CFB 기록](../build/hancom-file-preservation-20261017/overlap-roundtrip/raw-records.json) |
| 정식 5921 수정 검수 | 현재 문서·직접 소유·허용 원시 변화·전체 배치·undo·실제 저장 재열기 | **Native 72/72, Edge 14/14 PASS**. 시나리오 수이며 고유 기능 수나 한글 전체 호환률이 아님 | [통합 요약](../build/n001-formal-5921/summary.json) |
| 수정 후보의 기존 한글 자료 재분석 | 실제 한글 재저장본과 수정 엔진의 공개 배치 비교 | positive-caption 전체 배치 차이 0. multiline / caption은 표·본문 Y 차이가 해소됐지만 줄 partition·폭·charX 차이는 유지. 선언 높이 차이도 삭제하지 않음 | [후보 비교](../build/n001-completion-final/hancom-existing/result.json), [정식과 후보 동등성](../build/n001-formal-5921/formal-provenance.json) |
| 정식 53패치 typography·탭 | Native 재조판 12/12·탭 6/6·독립 Hancom 통제 11/11, 실제 Edge Canvas 탭 6/6·통제 11/11 | 현재 재조판 158 경계와 반복 저장·전체 지면·실제 paint 통과. 아래의 옛 원본 비교 및 별도 변환 실패를 삭제하지 않음 | [정식 53 요약·지문](evidence/typeset-controls-2026-10-17/formal-summary.json), [자체 통제 원본·golden](evidence/typeset-controls-2026-10-17/manifest.json) |
| 이전 Windows Final.exe | c370 독립 검수 실행본의 Open·Ctrl+S·저장 사본 한글 열기·dirty 종료 | 열기/저장/한글 열기와 Esc 취소 관찰. **승인 뒤 창 종료 실패**는 아래 최신 실행본에서 수정·재검수. 옛 실패 근거 유지 | [이전 실행본 지문](../build/native-file-gui-20261017/native-exit-final-result.json), [실제 GUI 근거](#native-gui) |
| 최신 Windows PickerReview.exe | 5921 실제 native HWPX 열기·Ctrl+S·종료 취소/승인·창 소멸·재실행 복구·명시적 Save As·원본 보존 | **검수한 HWPX 경로 PASS**. 실제 창 목록, 복구 화면 및 원본/복구 파일의 독립 ZIP·XML·SHA 검증. HWP·전체 ACL·한글 조판 동일성으로 확대하지 않음 | [실제 GUI 최종 보고서](../build/native-file-gui-20261017/actual-picker/actual-validation.json), [최신 실행본 지문](../build/native-file-gui-20261017/native-picker-result.json) |

수정 후보의 한글 자료 재분석은 이미 한글이 만들어 놓은 사본을 읽는 검사다. 정식 5921이 새로 저장한 문서를 한글 UI에서 다시 편집·저장·인쇄한 검사를 대신하지 않는다. 후보와 정식의 WASM/JS가 같다는 증거와 실제 한글 재실행 증거를 별도로 유지한다.

## 실제 한글에서 드러난 원점 계약 오류

| 관측값 | multiline | caption-multiline | positive-caption-gap |
| --- | ---: | ---: | ---: |
| c370의 뒤 표 Y → 한글 재저장본의 Y | 242 → 234px | 242 → 234px | 276 → 234px |
| 뒤 표 root LINE_SEG vpos | 7947 → 7347HU | 7947 → 7347HU | 10500 → 7347HU |
| 첫 표 선언 commonHeight | 3846 → 5181HU | 3846 → 5181HU | 3846 → 5181HU |

첫 표의 실제 표시 높이는 69.1px로 같았다. 본문 전체 문자열과 쪽 수가 같아도 글줄 분할, 글자 위치와 표 사이 간격은 달랐다. 따라서 “파일이 열린다”, “같은 엔진에서 다시 열어 같다”, “한글 저장본을 Jueony에서 왕복할 수 있다”를 한글 지면 동일성으로 판단하면 안 된다.

특히 LINE_SEG에만 더한 양수 vpos는 사용자가 지정한 문단 여백이나 개체 offset의 증거가 아니었다. 108번과 당시 G106의 “원본 양수 간격 유지” 설명은 이 재현 원본에서 잘못된 기대를 포함했다. 옛 실패·검수기·기대값은 [수정 전 자료](../build/n001-formal-5921/old-contract-scripts/manifest.json)와 `*-before/result.json`에 보존했다. canonical 문구·상태의 최종 정정은 후속 마감에서 수행한다.

5921은 다음의 좁은 소유 계약을 사용한다.

- Native HWP5의 원점이 확인된 단일 본문 열에서 실제로 배치한 인접 통째 표가 후속 흐름을 소유한다. 빈 앵커의 캐시 줄간격 600HU와 캐시 host advance 1600HU를 물리 표 프레임 뒤에 중복 가산하지 않는다.
- 문단의 실제 여백과 개체의 명시적 offset은 보존한다. 검수에서 `vertOffset=1500HU`는 표와 후속 본문을 정확히 20px 이동시켰다.
- 혼합 서식의 현재 재조판 줄, 책갈피와 확인한 필드 표시를 원시 저장 줄과 구분한다. 현재 줄이나 없는 원시 줄을 임의로 만들어 저장하지 않는다.
- 중복 주소·긴 필드 안내·여러 필드의 불명확한 원시 자료는 재작성하지 않는다. 원시 바이트가 기준 엔진과 같고 실제 전체 배치 검사가 통과하는지 별도로 확인한다. Agent의 필드 편집 지원을 확대했다는 뜻이 아니다.
- 다단, 음수/절대 배치, RowBreak, 글자처럼 취급되는 표, 비영 원점과 앞선 그림은 기존 경로를 보존한다. 이 반례들의 전체 배치·원시 바이트·의미는 기준 엔진과 대조했다. 복잡 배치 전체를 새로 지원했다고 해석하지 않는다.

기존 `assertOverlapSaveLayout`의 모든 공개 개체·셀·글줄 비교와 최대 0.2 기준은 그대로다. 새 검수는 고의로 명시 offset이 잘못된 저장물을 넣어 실제 쓰기 전 차단도 확인했다. Edge에서 이 경우 OPFS `createWritable` 호출 0회, 저장 실패·dirty 유지, 원본 파일·열린 내용·이력·Canvas 상태 불변을 확인했다.

## 선언 높이와 본문 조판은 별도 결함 축이다

`commonHeight`는 자동 크기 0, 명시 크기와 크기 보호를 포함하는 저장 선언이다. 측정 bbox 높이와 다르다는 이유로 전부 정규화하면 사용자의 크기 의도를 잃는다. [독립 조사](../build/n001-common-height-contract/conclusion.json)는 자동 0, 작은 보호 높이, 큰 명시 높이, 큰 보호 높이 네 대조와 commonHeight만 바꾼 여섯 실험을 보존한다. 이번 패치는 모든 표의 선언 높이를 실측값으로 덮어쓰지 않았다. 의미 보존 검사에서 `tableHeight`를 제거하지도 않았다.

c370이 만든 옛 합성 원본과 실제 한글 재저장본의 직접 비교는 정식 53에서도 **4 PASS / 5 FAIL**이다. 세 의미 비교에는 `commonHeight` 3846→5181HU 차이가 남고, multiline·caption의 전체 공개 배치 비교에는 각각 501·186개 필드 차이가 남는다. 이 숫자는 실패 기능 수가 아니다. 옛 원본의 저장 LINE_SEG는 160 경계를 보존하며 실제 한글 저장본은 158이므로, 원시 캐시를 강제로 버리지 않은 로드 결과와 현재 문단의 재조판 결과를 구분한다. [정식 53의 기존 원본 비교](../build/file-completion-final-typeset/hancom-existing-pairs/result.json)와 옛 c370의 3 PASS / 6 FAIL을 각각 보존했다.

### 정식 53의 현재 재조판·탭 검수

실제 한글 2024에서 따로 저장한 11개 통제 문단으로 regular HCR Batang의 Hangul advance를 확인했다. 9pt 873→872, 9.5pt 921→920, 10pt 970→972, 20pt 1940→1940HU의 nearest-4HU 범위를 적용하며, 일반 공백은 기존 500HU를 유지한다. 다른 글꼴·bold/italic·위/아래첨자·명시 장평/자간·HFT 특수 서식은 이 규칙으로 재해석하지 않는다. 글꼴 이름·원시 DocInfo·문단 폭·검사 허용치를 맞추기 위해 바꾸지 않았다. 이 실측 범위를 전체 타이포그래피 호환성으로 일반화하지 않는다.

첫 문단의 SectionDef/ColumnDef-only 구조에서는 편집과 import가 같은 물리 Frame을 사용하도록 좁혔다. 이어 HWP/HWPX의 저장 폭 미정 탭 자리표를 폭 0으로 읽던 정확 폭 생산 경로를 기존 모델 술어와 일치시켰다. 이전 52 엔진에서 혼합 서식의 실제 Canvas x가 최대 53.3334px, Hangul/tab은 최대 240.5867px 이동했던 반례도 새 저장물에서는 원래 위치가 유지된다. 조회 `run.w`를 덮어쓰거나 `charX`만 비교하는 방식으로 통과시키지 않았다.

| 정식 53 검사 | 결과 | 실제 판정 범위 |
| --- | --- | --- |
| 현재 재조판 Native | 12/12 PASS | 기존 실제 한글 multiline/caption의 전체 문단 158 partition·가역 편집·엄격 HWP 저장, ASCII·숫자·하이픈·탭·한글 단어/글자·Unicode HWP/HWPX 회귀 |
| 탭 저장 Native | 6/6 PASS | 기본 ASCII/Hangul·사용자 Left stop·들여쓰기·실제 혼합 bold run·끝 탭, 두 형식 각 2회 저장 재열기·전체 의미/자원·live 불변 |
| 독립 Hancom 통제 Native | 11/11 PASS | 2개 실제 한글 저장본의 11문단, 전체 partition과 HWP/HWPX 전체 배치·보존 |
| 실제 Edge Canvas | 탭 6/6·통제 11/11 PASS | 전체 공개 지면과 실제 fillText의 text/font/좌표, 저장 재열기 후 기존 최대 0.2 유지. page/console/external 오류 각각 0 |

정식 WASM SHA-256은 `dadd0e384765cb8d7b8d623111447c4c4b275977ff131c83a47318cb567364e4`, JS는 `fa507cbfdf856f83e55c7556e8dc024969db41da5102524159ab9bf9f70b02a8`다. [검수기·결과·53패치 지문](evidence/typeset-controls-2026-10-17/formal-summary.json)에 private 후보와 구분해 기록했다. 이전 51/52 엔진과 실패 결과는 그대로다.

[통제 자료](evidence/typeset-controls-2026-10-17/README.md)는 자체 생성 원본과 실제 한글 Save As 4개 HWP(84,480bytes)이며 공개·사용자 문서의 복사본이 아니다. CFB 스트림 명세로 BinData/font 스트림이 없음을 확인했고 글꼴 프로그램 추출·설치·재배포를 하지 않았다. 내장 글꼴 subset 가능성이 있는 측정용 PDF는 Git 자료에 포함하지 않는다.

### 추가로 드러난 HWP→HWPX 변환 결함

원본/한글 사본 × 저장 캐시/가역 편집 후 재조판 × HWP/HWPX를 각각 분리한 16경로 검사에서는 정식 **51·52·53이 모두 10 PASS / 6 FAIL**이다. 같은 형식 HWP 8경로는 통과했지만, 원본의 HWPX 변환 4경로는 뒤 표가 234→242px로 8px 이동하고, 편집한 한글 사본의 HWPX 변환 2경로는 본문이 한 줄 약 21.3px 밀린다. 줄 partition과 의미가 같다는 이유로 이 지면 손상을 허용하지 않는다. 35z/36z가 새로 만든 회귀와 기존 미완료 변환 경로를 구분한다.

현재 `verifyPreservedExport`의 의미 검사는 이 6경로를 통과하며, 별도 겹침 배치 가드가 HWP 출력에만 적용되어 HWPX 손상을 놓친다. [정식 53 상세 결과](../build/file-completion-final-typeset/conversion-formal53/result.json), [51 기준](../build/file-completion-final-typeset/conversion-baseline51/result.json), [52 기준](../build/file-completion-final-typeset/conversion-baseline52/result.json)에 모두 실패로 남겼다. Engine 흐름·변환 및 필요 가드 보강은 후속 수정 대상이다. `commonHeight`를 실측값으로 정규화하거나 전체 배치 비교를 느슨하게 하여 닫지 않는다.

## 정식 실행본을 확인한 방법

정식 엔진은 `build/rhwp-engine/source-5921bb9f9dcd86fa/pkg`, 실제 Edge는 `apps/editor/evidence/dist-file-completion`이다.

| 확인 항목 | 결과 |
| --- | --- |
| 정식 WASM SHA-256 | `ddebc39f88c774996f25fba2457b00c9770e3a4f951bade9bcbe8c948d763e11` |
| 정식 JS SHA-256 | `fa507cbfdf856f83e55c7556e8dc024969db41da5102524159ab9bf9f70b02a8` |
| 기록한 엔진 패치 | 51개 파일의 실제 SHA와 metadata 일치 |
| 후보 대비 바뀐 Rust 6파일 | private LF / 정식 CRLF 차이를 명시하고 양쪽 raw SHA 보존. 개행 정규화 후 바이트 동일 |
| 실제 실행 자산 | private 1355와 정식 WASM·JS는 바이트 동일. private 결과를 정식 재검수로 대체하지 않고 별도로 재실행 |
| Native 72개 | 신규 흐름 22 + 본문 16 + 양수 캐시/비겹침 11 + 저장 보호 9 + 가시 tail 14 |
| 실제 Edge 14개 | 속성 UI·undo/redo·dirty·실제 저장 promise·OPFS 바이트·Canvas 재열기·변조 저장물 차단 포함 |

[지문 대조](../build/n001-formal-5921/formal-provenance.json)와 [검수기 SHA·개별 결과](../build/n001-formal-5921/summary.json)를 함께 읽는다. 변경한 패치 두 개는 새 파일로 추가했으며 기존 c370과 이전 패키지를 수정하지 않았다. 이전 검사 수와 새 검사 수를 합쳐 새로운 기능 완료율로 계산하지 않는다.

<a id="native-gui"></a>

## 실제 Windows 창의 열기·저장·종료

최신 실제 검수본은 **`JueonyNativePickerReview.exe`**다. 정식 5921 엔진 51개 패치와 별도 native 식별자 `local.jueony.nativepicker20261017`를 사용한다. 실행 파일 SHA-256은 `1df4138d53d3458bac2b8292fe61c30a036ef663465b500d004a464c8187beab`, 프런트엔드는 `dist-native-picker-final`이다. [실행본·소스 지문](../build/native-file-gui-20261017/native-picker-result.json)과 [실제 UI 최종 보고서](../build/native-file-gui-20261017/actual-picker/actual-validation.json)를 연결한다.

이번에는 부모 에이전트가 허용된 Windows Computer Use로 실제 앱을 조작했다. 아래 HWPX 8단계와 추가 HWP·외부 재열기 검수는 고유 기능 수나 제품 완료율을 뜻하지 않는다. 문서 작성자는 보존한 실제 파일을 다시 읽어 ZIP CRC·XML 파싱·SHA·표식과 원본 바이트를 독립 확인했다.

| 실제 native HWPX 단계 | 결과 | 근거 |
| --- | --- | --- |
| 소유 창이 지정된 열기 | 부모가 비활성화되고 native 열기 대화상자가 부모 상태에 노출됨을 직접 관측. 시험 HWPX 열기 성공 | [열린 화면](../build/native-file-gui-20261017/actual-picker/opened.png), [관측 출처를 구분한 보고서](../build/native-file-gui-20261017/actual-picker/actual-validation.json) |
| 입력 → Ctrl+S | `PICKER-SAVED-20261017` 표식이 실제 원본 HWPX에 저장됨. 뒤의 미저장 복구 표식은 원본에 없음 | [저장 화면](../build/native-file-gui-20261017/actual-picker/saved.png), [호스트 readback](../build/native-file-gui-20261017/actual-picker/saved-readback.json), [저장 사본](../build/native-file-gui-20261017/actual-picker/saved.hwpx) |
| dirty 종료 → Esc | 복구본 보관 확인창이 열리고 Esc 후 문서와 창 유지 | [확인창](../build/native-file-gui-20261017/actual-picker/exit-confirm.png), [취소 후 화면](../build/native-file-gui-20261017/actual-picker/exit-cancel.png) |
| dirty 종료 → 보관 승인 | 확인창에서 승인한 뒤 대상 앱의 실제 창 목록이 빈 배열로 바뀜 | [실제 창 소멸 기록](../build/native-file-gui-20261017/actual-picker/after-exit-windows.json). IPC promise 성공만으로 판정하지 않음 |
| 동일 exe 재실행 | 새 창 `987052`에서 dirty 문서와 `PICKER-RECOVERY-UNSAVED` 내용 복원 | [복원 화면](../build/native-file-gui-20261017/actual-picker/restarted-recovered.png), [접근성 기록](../build/native-file-gui-20261017/actual-picker/restarted-accessibility.txt). 접근성은 `수정됨`·문서 이름·`http://tauri.localhost/`를 보강하며 Canvas 본문 표식은 부모의 실제 관측·화면으로 확인 |
| 복원 후 저장 | 자동으로 옛 native token을 채택하지 않고, 저장 버튼에서 명시적 native Save As를 거쳐 새 복구 파일에 저장 | [복구본 저장 화면](../build/native-file-gui-20261017/actual-picker/recovery-saved.png), [복구 파일](../build/native-file-gui-20261017/actual-picker/recovered.hwpx) |
| 복구 파일 독립 확인 | 새 HWPX의 ZIP CRC와 XML 유효, 최신 미저장 표식 확인. 파일 SHA와 section XML이 부모의 실제 호스트 readback과 동일 | [복구 readback](../build/native-file-gui-20261017/actual-picker/recovered-readback.json), [독립 검사](../build/native-file-gui-20261017/actual-picker/actual-validation.json) |
| 원본 보존 | 복구·종료·재시작·Save As 이후 작업 원본은 앞서 Ctrl+S한 `saved.hwpx`와 바이트 동일. 복구 파일은 별도이며 미저장 편집을 포함 | [원본·복구 바이트 대조](../build/native-file-gui-20261017/actual-picker/actual-validation.json) |

같은 실행 파일로 **native HWP 열기·편집·Ctrl+S와 실제 한글 2024 재열기**도 추가 확인했다.

| 추가 검수 | 결과 | 근거 |
| --- | --- | --- |
| Native HWP 소유 대화상자 열기 → 편집 → Ctrl+S | `native-picker-working.hwp`를 실제 native Open으로 열고 `PICKER-HWP-SAVED` 입력·저장 후 dirty 해제 확인 | [실제 저장 화면](../build/native-file-gui-20261017/actual-picker/hwp-saved.png), [동일 바이트 HWP 사본](../build/native-file-gui-20261017/actual-picker/saved.hwp) |
| 실제 저장 파일 독립 엔진 재열기 | native HWP 저장본·HWPX 원본 저장본·HWPX 복구 저장본 **3/3 PASS**. 정식 5921 엔진에서 각 표식과 1쪽 확인, 현재 파일 SHA를 기록과 다시 대조 | [엔진 readback](../build/native-file-gui-20261017/actual-picker/engine-readback.json), [검수기](../build/verify-native-picker-disk.mjs), [통합 보고서](../build/native-file-gui-20261017/actual-picker/actual-validation.json) |
| 저장 HWP를 실제 한글 2024로 재열기 | 창 `1249204`에서 `PICKER-HWP-SAVED` 본문과 **3줄·80글자·1쪽·함초롬바탕 10pt** 확인 | [한글 화면](../build/native-file-gui-20261017/actual-picker/hancom-hwp-saved.png), [한글 접근성](../build/native-file-gui-20261017/actual-picker/hancom-hwp-accessibility.txt) |

native 저장 HWP의 SHA-256은 `49449ef6297b7907b94d9c9c05de43d88f5472fd02602f881f0db2f3d4736267`이며 보존 사본은 실제 작업 파일과 바이트 동일하다. HWP의 기본 저장·외부 재열기 성공과 HWPX에서 직접 검사한 종료·복구·Save As 전체 경로를 구분한다. 이 회차에서 HWP로 종료·복구 전 과정을 별도로 반복하거나 한글 재저장·복잡 문서·인쇄 동등성을 검사했다고 보고하지 않는다.

저장 사본 SHA는 `a1fe7f1ca3a8947fb3c42391046ef573a5de0c9a68fcb68120b94f0a6fb19f04`, 별도 복구 파일 SHA는 `5a63ab1da6e0f6d78c0297f01fc3c2174c8d95bc418738d4f549b32a95b895e0`다. 두 파일은 최신 미저장 편집 포함 여부가 달라 바이트가 다르며, **바이트 동일 판정은 원본 working 대 저장 사본, 복구 destination 대 복구 사본 각각**에 해당한다.

native picker 중복 호출은 부모·동일 출처 iframe이 공유하는 한 번의 선택만 허용하고 추가 요청을 `InvalidStateError`로 거절한다. Rust 두 picker는 main WebviewWindow를 부모로 설정했다. 단위 17개와 실제 Edge/WASM/IDB 경계 11개, 기존 브라우저 닫기 회귀 4개가 통과했다. Edge에서는 OS IPC와 창 파괴만 대체했으며, 실제 Windows 완료 근거는 위 UI·파일 관측으로 따로 보존한다. 직접 native 중복 대화상자 스트레스 검사, 모든 업무/대량 탭·ACL·디스크 장애 및 한글 인쇄 동일성을 이 기본 문서 경로의 성공에 포함하지 않는다.

### 이전 c370 실행본의 실패 기록 보존

실제 검수용 `JueonyNativeExitReviewFinal.exe`는 별도 식별자와 독립 파일을 사용한다. [해당 실행본 지문](../build/native-file-gui-20261017/native-exit-final-result.json)의 내장 엔진은 c370이다. 5921 Edge 합본, native IPC/window 경계를 대체한 브라우저 검사와 실제 Windows 실행을 혼동하지 않는다.

| 실제 GUI 단계 | 관측 결과 | 정확한 근거와 남은 범위 |
| --- | --- | --- |
| 프로그램 열기·Open | 실제 편집 화면에서 자체 시험 파일 열기 관찰 | [열림 화면](../build/native-file-gui-20261017/actual-final/opened.png). 모든 picker·취소·권한 조합 완료가 아님 |
| Ctrl+S 및 저장 사본 확인 | 부모 직접 검수에서 저장 표식 확인 | [저장 화면](../build/native-file-gui-20261017/actual-final/saved.png), [접근성](../build/native-file-gui-20261017/actual-final/saved-accessibility.txt), [검수 사본](../build/native-file-gui-20261017/actual-final/saved-before-recovery.hwpx), [실제 호스트 readback](../build/native-file-gui-20261017/actual-final/disk-readback.json) |
| 저장 파일을 실제 한글로 열기 | 부모 직접 관측: 3문단·89글자, `NATIVE-GUI-SAVED` 표식 표시. 미저장 `UNSAVEDRECOVERY`는 원본에 포함되지 않았고 원본 해시 유지 확인 | [한글 화면](../build/native-file-gui-20261017/actual-final/hancom-open-saved.png), [한글 접근성](../build/native-file-gui-20261017/actual-final/hancom-open-saved-accessibility.txt). [부모의 실제 호스트 readback](../build/native-file-gui-20261017/actual-final/disk-readback.json)에 working/검수 사본 SHA `b4d5cd7334a753c8ffb5048796647ce031d787ba20d12e9a753af99250b1905a`, `markerSaved=true`, `markerUnsaved=false`를 기록. 이 문서 작성자의 sandbox 파일 보기와 구분하며 실제 호스트 관측을 인용함 |
| dirty 종료 → Esc | 확인창 취소 후 작업 유지 관찰 | [확인창](../build/native-file-gui-20261017/actual-final/exit-confirm.png). 취소 성공을 승인 후 종료 성공으로 확대하지 않음 |
| dirty 종료 → 승인 | 창이 닫히지 않고 전체가 비활성 상태로 남는 실제 결함 | [실패 화면](../build/native-file-gui-20261017/actual-final/exit-failed-inert.png), [실패 접근성](../build/native-file-gui-20261017/actual-final/exit-failed-inert-accessibility.txt). `appWindow.close()` promise 처리만으로 실제 창 소멸을 판정하면 안 됨 |

위 옛 실패는 Tauri `onCloseRequested` 바깥 wrapper가 파괴를 호출하는데 필요한 `allow-destroy` 권한이 없고, 승인 후 UI가 비활성 상태로 남는 경로였다. 최신 실행본은 모든 종료 이벤트를 먼저 거절하고, 복구 commit·읽기 확인·문서 버전 검증 뒤 보호된 `try/catch` 안에서 명시적 `destroy()`를 호출한다. 권한은 local main 창에만 추가했다. IPC 거절 시 승인과 UI 잠금을 해제하는 경계 검사도 통과했다. 최신 HWPX 실제 창 소멸·재시작 복구 성공은 앞 표에 기록했으며 옛 실패 파일은 덮어쓰지 않았다. 복구 보관과 원본 저장, 복구 문서와 과거 native token 권한은 계속 구분한다.

## 검증 부분 10개: 실제 한글에서 남은 검사

기준은 [파일 기능 문서](features/05-files-storage-recovery.md)의 실행 작업 23개 중 검증 `PARTIAL` 10개와 [근거 감사](../build/file-completion-verification-audit.md)다. 감사의 최초 “9개 자동 완료·한글 대기, N001 구현/검증 부분” 분류 이후 실제 한글 실패를 발견했다. 특히 G105/G106은 이제 단순 대기가 아니라 수정 후 재검수 대상이다. 아래 표는 진행을 설명하며 CSV 상태를 변경하지 않는다.

| ID | 확보한 자동·기존 직접 근거 | 실제 한글에서 끝내야 할 검사 |
| --- | --- | --- |
| G069 기본 탭 | [36번의 이전 한글 20pt 실측](36-native-section-comparison.md), [이번 첫 구역 20.0pt 표시](../build/hancom-file-preservation-20261017/tabs-section1-settings-accessibility.json) | `tabs-20-40-60.hwpx`의 각 구역 20/40/60pt를 각각 확인. 실제 탭 뒤 커서 위치·구역 경계·쪽 수를 확인하고 HWP/HWPX 사본 재저장·재열기 및 `secPr tabStop/tabStopVal`을 대조. `default-native`의 표 안 여백 검사를 기본 탭 검사로 세지 않음 |
| G071 겹침 금지 후속 표 | 두/세/긴 표의 두 형식 Native 소유·반복 왕복. 이번 비겹침 의미 흐름 대조 추가 | [following-native 사본](../build/file-preservation-regression-output/following-native/)을 한글에서 열고 각 표·후속 본문의 좌표·쪽/행/열·인쇄 겹침/소실 확인. 새 이름 저장본의 Jueony 배치와 다시 대조 |
| G073 표 바깥 여백 | 네 방향 semantic/common/raw cache·취소·undo·두 형식 왕복 | [outer-native 사본](../build/file-preservation-regression-output/outer-native/)의 한글 표 속성 표시와 실제 간격을 확인. 속성창은 취소하고 별도 재저장본·인쇄 미리 보기를 대조 |
| G090 단순 겹침 tail | 통째 표와 빈 끝 본문, 전체 공개 배치·반복 저장·snapshot 근거 | [overlap-native 사본](../build/jueony-file-preservation-20261017/review-documents/file-preservation/overlap-native/)의 두/세/긴 표·명시 offset을 검사. 끝 커서·빈 줄·추가 쪽·마지막 표 위치를 기록하고 새 엔진 사본의 한글 재저장까지 확인 |
| N001 복잡 겹침 저장 | 5921의 혼합 서식·알려진 표식·단일단 소유 검증, 기존 다단/절대/음수/불명확 원점 보호 | 최종 합본으로 실제 지원 사례를 다시 저장하여 한글에서 비교. 단순 원본과 복합/분할/불명확 원본을 분리하고 후자는 명확한 소유·기대 지면부터 확정. 현재 72/14 PASS로 전체 구현을 완료 처리하지 않음 |
| N002 공개 형식 변환 4차이 | 기록된 공개 5문서 10변환, 필드·메모·common 배치·잠금 의미 보존 | 감사에 기록된 `mcst-bid→HWPX`, `python-hwpx-0/1/3→HWP` 사본에서 표 안 메모·필드 내용과 수·개체·쪽/인쇄를 확인. 한글 재저장본을 엔진으로 읽어 의미를 대조. 공개 파생 파일은 Git/배포에 임의 추가하지 않음 |
| G092 글상자 세로 정렬 | Top/Center/Bottom 저장·raw 예약3 보존, 명시 setter와 변환 거절 | [글상자 사본](../build/jueony-file-preservation-20261017/review-documents/file-preservation/textbox-storage-native/)의 HWP/HWPX 6개에서 한글 정렬 표시와 실제 글 위치·서식·이모지를 확인. 재저장 후 `known`/값을 비교. 예약 raw3를 알려진 정렬 성공으로 취급하지 않음 |
| G096 단일 가시 본문 | Unicode·위첨자·동일 문단번호의 셀 소유 분리와 실제 UI 왕복 | [가시 본문 사본](../build/jueony-file-preservation-20261017/review-documents/file-preservation/overlap-visible-native/)의 plain/Unicode/superscript를 한글에서 열고 표 뒤 원문·위첨자·셀/본문 소유·지면·인쇄를 확인. 새 저장본의 한글 재저장과 Jueony 왕복을 대조 |
| G105 여러 줄·캡션 | 정식 53에서 현재 재조판 158·Native 12/12·독립 통제/Canvas 통과. 옛 원본 캐시/의미 직접 비교 및 HWPX 변환은 별도 실패 유지 | 새 multiline·캡션 사본의 한글 재저장·인쇄 검수와 HWP→HWPX 변환 6경로를 마감. 선언 높이·원시 캐시 차이와 현재 재조판 성공을 구분하고, 전체 지면 실패가 남은 상태에서 완료로 올리지 않음 |
| G106 양수 원점 | bare cache를 의미 간격으로 가정한 검사를 정정하고, 원시 vpos 무변경·234 실측·명시 offset/여백 보존 검증 | bare LINE_SEG 양수값, 실제 개체 offset, 문단 여백을 별도 사본으로 비교. 새 엔진 출력의 한글 재저장·캡션·쪽/인쇄를 확인. 캐시 값 보존과 사용자가 지정한 물리 간격 보존을 구분하여 최종 계약을 정정 |

감사 시 참조한 일부 옛 문서 경로는 파일이 없었다. G069의 옛 파일명을 그대로 성공 근거로 복사하지 말고 [이번 탭 원본](../build/hancom-file-preservation-20261017/tabs-20-40-60.hwpx)과 [설정 기대값](../build/hancom-file-preservation-20261017/tabs-expected.json)을 사용한다. 모든 직접 검수는 원본을 보존하고 별도 사본에 수행한다.

## 다음 마감 순서와 판정

1. native HWPX 종료 결함 수정과 실제 Open·수정·Ctrl+S·Esc·승인 후 창 소멸·재실행 복구·Save As·원본 보존, native HWP Open·Ctrl+S·실제 한글 2024 재열기를 최신 PickerReview에서 확인했다. 최종 엔진/프런트엔드가 변경되면 같은 실제 경로를 다시 검수한다. IPC를 대체한 Edge 경계 검사 통과만으로 실제 창 종료를 판정하지 않는다.
2. 독립 한글 통제 자료로 정식 53의 현재 줄 나눔·advance·탭 폭 저장 결함은 위 범위에서 검수했다. 다음은 새로 분리한 HWP→HWPX 지면 손상 6경로와 선언 높이·옛 저장 캐시의 외부 한글 비교를 각각 해결·검수한다. 158 경계 한 곳이나 본문 문자열 일치만으로 문서 전체 적합성을 표시하지 않는다.
3. 새 정식 엔진·프런트엔드·native 실행본의 지문을 고정한 뒤 Native/Edge/Windows 회귀를 같은 합본에서 수행한다. private·이전 엔진·실패 실행의 수치를 섞지 않는다.
4. 위 10개 작업별로 한글 화면·속성·재저장 파일 SHA·독립 원시/XML·인쇄 근거를 남긴다. 자체 왕복, 실제 한글 외부 재저장 변화, 원시 바이트 변화 범위와 OS 파일 계약을 각각 판정한다.
5. 남은 실패·미실행 범위를 명시한 뒤에만 108번의 현재 안내, 기능 문서와 CSV를 갱신한다. 보호 검사·실패 원본·기존 복구본을 유지한다.

일반 XML 서식/스키마 UI, 전체 파일 메뉴, 새 창/새 탭 구분, 개인 정보·이력 편집, 모든 ACL·전원/디스크 장애와 전체 한글 조판 동일성은 이 후속 결함 수정만으로 완료되지 않는다.
