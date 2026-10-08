# 라이선스와 배포 구성 관리

두 저장소의 루트 LICENSE를 고정 커밋에서 직접 읽어 MIT임을 확인했다. MIT 본문은 사용·수정·재배포·판매·재라이선스를 허용하며, 사본이나 상당 부분에 저작권·허가 고지를 포함하도록 요구한다. 이 소스 자체는 상용·비공개 제품 개발에 활용할 수 있다. **제품 전체 배포 조건은 실제 포함한 라이브러리·폰트·런타임·문서 자산별로 확정해야 한다.**

## 직접 확인한 고지

| 대상 | 확인 결과 | 유지할 내용 |
| --- | --- | --- |
| gongmuwon 루트 | MIT, Copyright 2026 gongmuwon | 저작권·허가·면책 본문; 번들 구성요소는 별도 조건이라는 안내 |
| rhwp 루트 | MIT, Copyright 2025–2026 Edward Kim | 저작권·허가·면책 본문 |
| gongmuwon 공문 템플릿 | `LICENSE.public-doc-to-hwpx`, MIT, Copyright 2026 public-doc-to-hwpx contributors | 템플릿을 포함·수정해 배포할 때 해당 고지 |
| rhwp 외부 구성요소 목록 | `THIRD_PARTY_LICENSES.md` 존재 | 실제 포함되는 항목의 원문 라이선스·NOTICE와 대조 |

근거: [gongmuwon LICENSE](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/LICENSE), [rhwp LICENSE](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/LICENSE), [템플릿 고지](https://github.com/Kminer2053/gongmuwon/blob/ef84271059eb178a08e4a358d761dab10ada7a78/services/sidecar/src/gongmu_sidecar/public_doc_templates/LICENSE.public-doc-to-hwpx)

## 배포 후보 목록

이 표는 설계 단계의 조사 목록이다. 실제 설치본을 검사한 최종 SBOM 또는 완성된 THIRD_PARTY_NOTICES가 아니다. 루트 MIT 외의 조건은 각 배포 파일의 라이선스 전문으로 다시 검증한다.

| 구성요소 | 확인한 버전 또는 상태 | 현재 근거 | 포함 시 추가 확인 |
| --- | --- | --- | --- |
| gongmuwon 재사용 코드 | 0.1.14 commit 고정 | 루트 MIT 직접 확인 | 복사 파일·수정 이력·고지 유지 |
| rhwp engine·Studio·editor | 0.8.7 소스 | 루트·package MIT 직접 확인 | 실제 WASM 빌드와 wrapper의 버전·해시 |
| 기존 gongmuwon `@rhwp/core` | lock 0.7.17 | package-lock | 새 Studio와 병행 포함할 필요 여부; 불필요한 중복 엔진 제외 |
| `@noble/hashes` | Studio lock 2.4.0 | lock와 rhwp 고지 MIT 표기 | 배포 package의 전문 |
| `canvaskit-wasm` | Studio lock 0.42.0 | lock와 rhwp 고지 BSD-3-Clause 표기 | 실제 포함 여부와 Skia 등 번들 내부 고지 |
| Rust crates·vendored 코드 | Cargo.lock 기준 | rhwp 고지의 MIT·Apache·BSD 등 목록 | 사용 feature별 전이 의존성, 원문 NOTICE; `vendor/svg2pdf` 등 포함 여부 |
| 코드 포팅 부분 | rhwp의 Volexity hwp-extract 안내 | rhwp 고지에 BSD-3-Clause 본문 | 해당 코드 포함 빌드의 고지 보존 |
| React·Tauri 및 프런트엔드 | manifest·lock 기준 | 직접·전이 라이브러리별 조건 | 번들에 남는 구성요소와 개발 도구 구분 |
| kordoc와 Node runtime | 선언 `kordoc ^3.11.0`; 실제 배포 시 고정 | gongmuwon manifest·고지 | npm 해석 버전, runner와 Node binary의 전문·재배포 조건 |
| python-hwpx | 2.9.1 고정 | sidecar pyproject, upstream Apache-2.0 표기 | wheel의 LICENSE·NOTICE와 변경 표시 의무 |
| Python·FastAPI·lxml·pypdf 등 | 일부 버전 범위, 일부 고정 | sidecar manifest | 실제 설치 패키지와 전이 라이브러리별 전문; Python PSF·기타 고지 |
| WebView2 Runtime | 최종 설치본 미정 | Tauri offlineInstaller 설정 | Microsoft 배포 약관, Runtime 방식·버전·보안 업데이트 절차 |
| OFL 계열 글꼴 | 파일별 선택 예정 | `assets/fonts/FONTS.md`·rhwp 고지 | 저작권·OFL 전문, 수정·subset·이름 조건, 실제 글꼴 해시 |
| Latin Modern Math | 수식용 후보 | rhwp 고지 GUST Font License 표기 | 수식 기능 필요 여부와 GUST 조건 |
| Cafe24·행복고딕 등 | 포함 여부 미정 | rhwp 고지의 별도 무료 배포 표기 | 무료라는 설명을 MIT로 해석하지 않고 개별 조건 확인 |
| 한컴·Microsoft 글꼴 | rhwp는 Git 미포함으로 안내 | `assets/fonts/FONTS.md` | PC 설치·앱 번들·폰트 변환·문서 임베딩 권한을 각각 확인 |
| AI 모델·Ollama | 첫 검증과 기관 API 기본안에서 제외 | 모델 가중치를 배포하지 않는 설계 | 나중에 포함하면 별도 모델·런타임 조건 조사 |
| 문서 샘플·이미지·직인 | 검수용 입력 | 소스코드와 권리가 다를 수 있음 | 이용·보관·재배포 허용 범위, 기관 정보 포함 여부 |

## 기존 고지 목록에서 주의할 점

rhwp `THIRD_PARTY_LICENSES.md`의 npm 배포 패키지 표는 `@rhwp/editor`와 `@rhwp/core`를 0.8.6으로 적고 있다. 직접 읽은 `npm/editor/package.json`은 0.8.7이다. 고지 파일의 숫자를 최종 배포 목록으로 그대로 복사하지 않는다. `@rhwp/core`의 npm registry 최신 배포 버전은 이번에 별도 확인하지 않았다.

gongmuwon의 라이선스·README·패키징 스크립트에는 모델·런타임 고지가 있으나 해당 모델의 원문 이용 조건까지 이번에 검증한 것은 아니다. 첫 mock 검증에는 모델을 포함하지 않으므로 기존 AI 팩을 통째로 제품 번들로 채택하지 않는다.

rhwp 웹폰트 선언에는 외부 CDN 경로가 있다. 오프라인 제품에서는 허용된 로컬 파일만 포함하고 외부 로드를 끈다. 폴백으로 표시할 수 있다는 사실과 원래 문서의 조판을 보존한다는 사실은 다르므로 글꼴 목록을 호환성 검수 환경에도 기록한다. [rhwp 고지 목록](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/THIRD_PARTY_LICENSES.md), [폰트 목록](https://github.com/edwardkim/rhwp/blob/1a76570e833917d15817415a53c09ad61ab3203f/assets/fonts/FONTS.md)

WebView2의 오프라인 Standalone Installer와 Fixed Version은 서로 다른 배포·업데이트 선택지다. 제품에 실제 포함할 방식과 약관을 확정하고 관리 주체를 정한다. Microsoft는 오프라인 배포 절차를 공식 문서로 제공한다. [Microsoft WebView2 배포 안내](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)

## 최종 고지 작성 절차

1. 설치본과 실행 폴더에 포함될 EXE·DLL·WASM·JS·Python package·Node·폰트·템플릿·이미지 목록을 추출한다. 개발 전용 dependency를 배포된 것으로 표시하지 않는다.
2. 각 항목에 버전, 원본 URL·commit, package identifier, SHA-256, 라이선스 표현식, 실제 LICENSE·NOTICE 경로, 수정 여부, 사용 feature를 기록한다.
3. package metadata만 믿지 않고 실제 배포 archive와 wheel·crate·vendored 디렉터리의 전문을 확인한다. 복수 라이선스는 적용한 선택을 기록한다.
4. 소스·템플릿의 기존 고지를 보존하고 앱의 로컬 라이선스 보기 및 `licenses/`에 포함한다. 요구되는 Apache NOTICE·BSD 고지·폰트 전문을 빠뜨리지 않는다.
5. `THIRD_PARTY_NOTICES.md`와 SBOM을 해당 빌드의 실제 파일 목록에서 생성·검토한다. 누락 또는 조건 미확정 자산이 있으면 그 자산을 제외하거나 조건을 확정한 뒤 배포한다.

고지의 포함 방식 예시는 다음과 같다. 현재는 파일 구조의 계획이며 최종 배포 고지가 아니다.

```text
THIRD_PARTY_NOTICES.md
sbom.json
licenses/
  gongmuwon/LICENSE
  rhwp/LICENSE
  public-doc-to-hwpx/LICENSE
  <실제 배포 패키지와 글꼴별 LICENSE 및 NOTICE>
```

루트 LICENSE와 lockfile 해시는 [분석 기준 JSON](evidence/source-audit-2026-10-09.json)에 보존한다. 실제 배포 구성 확정은 [구현 계획](05-implementation-plan.md)의 파일럿 준비 단계에서 다시 수행한다.
