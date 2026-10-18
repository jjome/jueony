# 저장 합본101의 고정 검증 근거

공식110패치 엔진 `source-3f07621d4728accf`와 프런트 `file-storage101`을 함께 검사했다. [집계](workflows/result.json) · [새 문단 저장 검사18개](workflows/authored-floating-gap-layout/result.json) · [소스 지문](source-proof.json).

| 검사 | 결과 | 실제 범위 |
| --- | --- | --- |
| 같은 빌드의 파일·복구27군 | 346/346 | 격리 Edge·실제 WASM·저장 명령·이력·복구; 원본 셀13과 새 간격18 포함 |
| 새 간격·저장 | 18/18 | 독립 재저장 XML의 두 문단×앞/뒤×입력 유지/삽입 후 삭제; 실제 저장35회, 원래 인스턴스 undo/redo |
| 단위 | 1008/1008 · skip0 | 위346과 별도 |
| 기존 단·표 저장 | 24/24 | 새 엔진으로 다시 실행; 엄격 저장 비교 유지 |
| 실제 Windows Rust 저장 | 10/10 · ignore0 | 자체 HWP/HWPX, 잠금·외부 변경·안전 교체 |
| 실행 묶음 | 7/7 | 임시 서버·정확 WASM·CSP·인증 거절; 키 저장소는 memory |
| TypeScript·모듈 경계·작업표 | 통과 | 작업표12개; 잘못된 최초 Python 실행 로그도 별도 보관 |

원본 MCST HWP의 **편집하지 않은** 양형식 저장도 검사했다. 해당 원본 HWP의 **편집 후** 저장은 별도 미해결이며 이18개로 완료 처리하지 않는다. 기존107/109의 실제 실패5232개를 [잔여 원형](remaining/native-mcst-edited-storage.json)에 보존했다. 최초 원본15쪽/한글 재저장 XML16쪽, Python 복합 표, 명시 글 방향, 일반 HWT/XSL도 전체 완료를 주장하지 않는다. 한글 직접 비교·OS 선택창 조작은 이번에 실행하지 않았다.

모든 행의 끝점 범위/오버플로를 빠뜨렸던 후보와 수정 후의 독립 검토 로그는 `negative-review`에 있다. 선택된 실제 Rust 검사4개와 자원 지문 검사1개는 `private-v4`에 있으며 전체 Rust3994개를 통과했다는 뜻이 아니다. 초기 검사기가 다른 인스턴스에 snapshot ID를 적용했던 오류도 `before`에 실패 상태 그대로 보관했다. 최종18개는 원래 인스턴스를 유지하고 전체 의미·공개 지면·저장 보호를 엄격 검사한다.

`patches/*.gz`는 적용한 세 패치의 원본 바이트다. 패치 문맥의 의도적 공백을 변경하지 않도록 압축했다. 문서 원본·한글 설치 자산·폰트·브라우저 프로필·API 키·컴파일 실행 파일은 포함하지 않는다. 실제 저장 파일은 로컬 `build/file-storage101-workflows/authored-floating-gap-layout`에 남겼다.

재검증: `python docs/evidence/file-completion-2026-10-18/storage101/verify.py`. `SHA256-MANIFEST.json`은 자기 자신을 제외한 모든 파일의 바이트 길이와 SHA256을 고정한다. 테스트 수를 합쳐 한글 전체 검증률로 표시하지 않는다.
