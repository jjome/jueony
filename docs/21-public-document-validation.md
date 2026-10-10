# 인터넷 공개 문서 호환성 검사

2026-10-11. 사용자가 요청한 외부 표본을 내려받아 **공개 HWP 1개 + HWPX 4개**를 검사했다. 원본을 수정하지 않고 별도 결과 파일을 만들었다. 이 자료들은 실제 LLM에 전송하지 않았다.

## 표본과 결과

| 로컬 원본 | 출처/내용 | rhwp 쪽/표 수 | 동일 엔진 HWP·HWPX 재열기 | 판정 |
|---|---|---:|---|---|
| `mcst-bid-2026.hwp` | [문체부 2026년 공공누리 홍보마케팅 입찰 첨부](https://www.mcst.go.kr/site/s_notice/notice/bidView.jsp?pSeq=18649) | 15 / 11 | 본문·표 내용 일치 | PASS_CONTENT |
| `formatting.hwpx` | [FormattingShowcase](https://github.com/airmang/python-hwpx/blob/839562b87f54923c1a0317c22b1f2d4863f3c658/examples/FormattingShowcase.hwpx) | 1 / 1 | 본문·표 내용 일치 | PASS_CONTENT |
| `notes.hwpx` | [note_example: 실제 내용은 가입 신청 서식](https://github.com/airmang/python-hwpx/blob/839562b87f54923c1a0317c22b1f2d4863f3c658/examples/note_example.hwpx) | 1 / 1 | HWPX 일치; HWP 끝 빈 문단 증가 | REVIEW_REQUIRED |
| `equation.hwpx` | [수식 표본](https://github.com/airmang/python-hwpx/blob/839562b87f54923c1a0317c22b1f2d4863f3c658/tests/fixtures/equation_preview/equation_p0.hwpx) | 1 / 0 | 추출 텍스트 일치 | PASS_CONTENT |
| `form.hwpx` | [A_form 시험 서식](https://github.com/airmang/python-hwpx/blob/839562b87f54923c1a0317c22b1f2d4863f3c658/tests/fixtures/exam/A_form.hwpx) | 3 / 10 | 본문·표 내용 일치 | PASS_CONTENT |

5개 모두 실제 편집 화면에서 열렸고 외부 HTTP 요청은 차단한 상태였다. 지원되는 단순 셀이 있는 4개는 기존 셀 수정과 요청 undo도 통과했다. 수식 표본은 읽기/렌더/저장 검사이며 수식 편집 성공을 뜻하지 않는다.

HWP/HWPX 총 10개 재저장 파일이 다시 열렸다. 엔진 content-loss 보고는 모두 0이었지만 이 값만으로 통과시키지 않았다. `notes.hwpx → HWP`는 본문 문단 수가 2에서 3으로 늘고 추출문 끝에 CRLF 하나가 붙었다. 표 내용은 동일했다. 글자 손실로 단정하지 않으며, 원래 구조와 달라 REVIEW_REQUIRED로 유지한다. 현재 배포 엔진 0.8.7의 변환 동작을 확인한 것이고 이번에 엔진 직렬화 코드를 고친 것은 아니다.

추가 후보 중 국민권익위원회 링크는 실제 bytes가 PDF여서 HWPX로 잘못 검사하지 않고 제외했다. 법무부 링크는 다운로드에 실패했다. 7개 시도/5개 확보이며 실패 내역도 manifest에 기록했다.

## 무엇을 검사했는가

- 원본 SHA-256, 실제 파일 signature와 크기.
- 엔진에서 열기, 쪽/구역/문단/표 조회, 첫 쪽 SVG 렌더.
- 무수정 HWP/HWPX export, 재열기, 전체 추출문·본문 문단·표의 셀 내용/범위 hash 비교.
- 실제 production validator와 executor를 통한 단순 셀 수정, 두 형식의 편집 결과 저장, snapshot 복원.
- 별도 Edge 프로필의 Jueony UI에서 열기·셀 수정·요청 undo. 브라우저 오류/외부 요청 0.

표 개수는 앱이 조회하는 최상위 표 기준이다. 중첩 표 전체의 구조 완전성을 뜻하지 않는다. 글꼴·이미지 픽셀·OLE·필드·수식 조판·머리말·각주·페이지별 시각 동일성을 자동 판정하지 않았다. 동일 엔진으로 읽고 쓰는 검사는 같은 오류를 서로 가릴 수 있으므로 **실제 한글의 독립 검수는 대기**다. 이 5개가 모든 공문을 대표하지도 않는다.

## 파일 위치와 한글 검수 방법

현재 PC의 검수 루트:

`C:\Users\jjome\Documents\work\jueony\.tools\public-documents`

원본은 이 폴더 바로 아래, 저장 결과는 `results`, 편집 화면 캡처는 `browser`에 있다. 결과 파일명은 다음과 같다.

```text
results/mcst-bid-2026-roundtrip.hwp
results/mcst-bid-2026-roundtrip.hwpx
results/mcst-bid-2026-edited.hwp
results/mcst-bid-2026-edited.hwpx
results/python-hwpx-0-*     # formatting.hwpx
results/python-hwpx-1-*     # notes.hwpx, 빈 문단 차이 집중 검수
results/python-hwpx-2-*     # equation.hwpx, edited 없음
results/python-hwpx-3-*     # form.hwpx
```

한글 2024에서 원본과 `roundtrip`을 각각 열고 복구 경고, 쪽 수, 줄바꿈·글꼴·쪽 여백, 표 병합/쪽 넘김, 개체·수식·머리말/각주, 인쇄 미리보기를 비교한다. `edited` 파일은 첫 지원 셀에 **호환성 검사 셀**만 바뀌었는지 확인한다. 표본별 한글 제품/빌드와 결과 캡처를 기록한다. 원본 위에 저장하지 않는다. 차이가 보이면 해당 원본 hash와 변경 파일을 재현 자료로 사용한다.

## 다시 실행

Node.js 22와 빌드된 editor/node_modules가 필요하다. 프로젝트 루트에서:

```powershell
node apps/editor/scripts/download-public-corpus.mjs
node --experimental-strip-types apps/editor/scripts/verify-public-corpus.mjs
Set-Location apps/editor
node scripts/verify-public-browser.mjs
```

다운로드는 인터넷을 사용하지만 후속 문서 검사에는 LLM이나 외부 모델이 필요 없다. 엔진 검사는 `results/report.json`, UI 검사는 `browser/report.json`에 기록한다. 재다운로드 시 출처의 파일이 바뀔 수 있으므로 manifest hash를 함께 보관한다. Python-hwpx 표본은 커밋 `839562b87f54923c1a0317c22b1f2d4863f3c658`에 고정했다.

원본과 변환본은 `.tools` 아래에 두고 Git/실행 묶음에 넣지 않는다. 공개 접근 가능하다는 사실로 모든 첨부의 재배포 권리를 가정하지 않는다. 저장소에는 출처 URL·해시·검사 스크립트·요약만 포함한다. [원본/판정 증거](evidence/native-agent-2026-10-11/README.md).
