# 109. 한글 실측 후 파일 보존 결함과 후속 검수

2026-10-17 **진행 중 초안**. [108번 기록](108-file-preservation-completion.md) 이후 실제 한글 2024와 Windows 실행본을 검사하면서 발견한 결함, 수정 범위와 남은 검수를 추적한다. 파일·저장 기능 전체의 완료 선언이 아니며, 이 문서 작성으로 CSV·기능별 집계·완료율을 변경하지 않는다.

정식 엔진 `5921bb9f9dcd86fa`에서 겹침 표 흐름 관련 Native 72개와 실제 Edge 14개는 통과했다. 한글이 다시 저장한 여러 줄 본문의 줄 나눔·자폭과 선언 높이 차이는 남아 있다. 실제 Windows 실행본은 초기 종료 실패를 수정한 뒤 최신 `JueonyNativePickerReview.exe`에서 HWPX 열기·Ctrl+S·종료 취소·승인 후 실제 창 소멸·재실행 복구·명시적 다른 이름 저장과 원본 보존까지 통과했다. native HWP 직접 검수와 한글 지면 동등성은 별도이며, 이 결과들을 섞어 완료율로 계산하지 않는다.

아래 `build/` 링크는 로컬 진단·검수 근거다. 최종 마감 시 보존할 결과와 사본을 정리하고 링크를 확정한다. 기존 실패 결과와 immutable 엔진·실행본은 덮어쓰지 않는다.

## 108번 이후 확인한 사실

| 단계 | 실제 확인한 범위 | 결과와 판정 경계 | 근거 |
| --- | --- | --- | --- |
| c370 기본 파일 직접 비교 | 한글에서 저장한 기본 본문 HWP/HWPX의 본문·조회 속성·용지·1쪽 및 Jueony 반복 왕복 | 4개 통과. 복잡 표·글상자·탭·인쇄 동등성의 근거가 아님 | [기본 파일 결과](../build/hancom-file-preservation-20261017/engine-roundtrip/result.json) |
| c370 겹침 파일 직접 비교 | multiline / caption-multiline / positive-caption-gap 원본과 실제 한글 재저장본 | **3 PASS / 6 FAIL**. PASS 3개는 한글 저장본을 Jueony에서 다시 저장한 자체 왕복이다. 원본 대 한글의 의미·전체 지면 비교 6개는 실패 | [실패 결과](../build/hancom-file-preservation-20261017/overlap-roundtrip/result.json), [독립 CFB 기록](../build/hancom-file-preservation-20261017/overlap-roundtrip/raw-records.json) |
| 정식 5921 수정 검수 | 현재 문서·직접 소유·허용 원시 변화·전체 배치·undo·실제 저장 재열기 | **Native 72/72, Edge 14/14 PASS**. 시나리오 수이며 고유 기능 수나 한글 전체 호환률이 아님 | [통합 요약](../build/n001-formal-5921/summary.json) |
| 수정 후보의 기존 한글 자료 재분석 | 실제 한글 재저장본과 수정 엔진의 공개 배치 비교 | positive-caption 전체 배치 차이 0. multiline / caption은 표·본문 Y 차이가 해소됐지만 줄 partition·폭·charX 차이는 유지. 선언 높이 차이도 삭제하지 않음 | [후보 비교](../build/n001-completion-final/hancom-existing/result.json), [정식과 후보 동등성](../build/n001-formal-5921/formal-provenance.json) |
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

여러 줄 본문에는 별도의 줄 나눔 차이가 남는다. 기록된 예에서 본문 offset 106의 줄은 기존 54자에서 한글 52자로 바뀌고 다음 줄 시작은 160에서 158로 달라졌다. 수정 후보의 기존 한글 자료 비교에서는 multiline 492개, caption-multiline 186개의 공개 배치 필드 차이가 남았고 positive-caption은 0개였다. 이 수치는 서로 다른 배치 필드의 차이 수이며 실패 기능 수가 아니다.

글꼴 이름이 같거나 Canvas 측정 결과가 있다는 것만으로 한글 조판을 입증하지 않는다. [글꼴·줄 나눔 조사](../build/hancom-font-metrics-20261017/conclusion.json)와 독립 한글 텍스트 golden을 기준으로 추적한다. HCR advance 반올림으로 158 경계를 재현하는 후속 후보를 검토 중이지만, HWPX run 폭 회귀가 남아 정식 5921 완료 결과에 합산하지 않는다. 최종 합본의 전체 글줄·폭·자폭·쪽 수·HWP/HWPX 저장을 다시 검사해야 한다.

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
| G105 여러 줄·캡션 | 실제 한글 실패 확인 후 5921 표/본문 Y 보강. 기존 전체 비교의 줄 나눔 차이는 남음 | 새 multiline·캡션 방향 사본을 한글에서 재저장. 표·캡션·모든 본문 글줄 시작·폭·charX·쪽 수·인쇄를 대조. 기존 6 FAIL과 선언 높이 차이를 해결한 근거 없이 완료로 올리지 않음 |
| G106 양수 원점 | bare cache를 의미 간격으로 가정한 검사를 정정하고, 원시 vpos 무변경·234 실측·명시 offset/여백 보존 검증 | bare LINE_SEG 양수값, 실제 개체 offset, 문단 여백을 별도 사본으로 비교. 새 엔진 출력의 한글 재저장·캡션·쪽/인쇄를 확인. 캐시 값 보존과 사용자가 지정한 물리 간격 보존을 구분하여 최종 계약을 정정 |

감사 시 참조한 일부 옛 문서 경로는 파일이 없었다. G069의 옛 파일명을 그대로 성공 근거로 복사하지 말고 [이번 탭 원본](../build/hancom-file-preservation-20261017/tabs-20-40-60.hwpx)과 [설정 기대값](../build/hancom-file-preservation-20261017/tabs-expected.json)을 사용한다. 모든 직접 검수는 원본을 보존하고 별도 사본에 수행한다.

## 다음 마감 순서와 판정

1. native HWPX 종료 결함 수정과 실제 Open·수정·Ctrl+S·Esc·승인 후 창 소멸·재실행 복구·Save As·원본 보존, native HWP Open·Ctrl+S·실제 한글 2024 재열기를 최신 PickerReview에서 확인했다. 최종 엔진/프런트엔드가 변경되면 같은 실제 경로를 다시 검수한다. IPC를 대체한 Edge 경계 검사 통과만으로 실제 창 종료를 판정하지 않는다.
2. 독립 한글 텍스트 golden으로 줄 나눔·advance 수정 후보와 HWPX run 폭 회귀를 해결한다. 후보의 158 경계 한 곳만 맞춘 것을 문서 전체 적합성으로 표시하지 않는다.
3. 새 정식 엔진·프런트엔드·native 실행본의 지문을 고정한 뒤 Native/Edge/Windows 회귀를 같은 합본에서 수행한다. private·이전 엔진·실패 실행의 수치를 섞지 않는다.
4. 위 10개 작업별로 한글 화면·속성·재저장 파일 SHA·독립 원시/XML·인쇄 근거를 남긴다. 자체 왕복, 실제 한글 외부 재저장 변화, 원시 바이트 변화 범위와 OS 파일 계약을 각각 판정한다.
5. 남은 실패·미실행 범위를 명시한 뒤에만 108번의 현재 안내, 기능 문서와 CSV를 갱신한다. 보호 검사·실패 원본·기존 복구본을 유지한다.

일반 XML 서식/스키마 UI, 전체 파일 메뉴, 새 창/새 탭 구분, 개인 정보·이력 편집, 모든 ACL·전원/디스크 장애와 전체 한글 조판 동일성은 이 후속 결함 수정만으로 완료되지 않는다.
