# 제3자 소프트웨어 고지

Jueony의 자체 부분에는 [개인·비업무용 이용허락](LICENSE.txt)이 적용된다. 제3자 구성요소에는 아래의 원래 라이선스가 적용되며, Jueony 약관은 그 권리를 제한하지 않는다. 코드·글꼴·자산의 기존 저작권 및 허가 고지를 보존한다.

이 문서는 현재 소스 저장소와 개발판의 고지 안내다. 완성된 배포본 전체를 감사한 SBOM이나 모든 구성요소의 법적 검토 완료를 의미하지 않는다.

| 구성요소 | 확인한 조건 | 원문 위치 |
| --- | --- | --- |
| rhwp 0.8.7 엔진·Studio 및 재사용 코드 | MIT, Copyright (c) 2025–2026 Edward Kim | 저장소의 `apps/editor/LICENSE.rhwp.txt`; 빌드의 `dist/LICENSE.rhwp.txt` |
| 공식 `@rhwp/core@0.8.7` WASM 패키지 | MIT | 빌드의 `dist/licenses/@rhwp-core.txt` |
| `@noble/hashes` | MIT, Copyright (c) 2022 Paul Miller | 빌드의 `dist/licenses/@noble-hashes.txt` |
| `canvaskit-wasm` 및 Skia 구성요소 | 패키지의 BSD 계열 고지 및 포함된 별도 조건 | 빌드의 `dist/licenses/canvaskit-wasm.txt` 및 rhwp 부속 고지 |
| 포함 글꼴 및 기타 rhwp 구성요소 | OFL 등 자산별 라이선스 | 빌드의 `dist/THIRD_PARTY_LICENSES.rhwp.md`, `dist/fonts/FONTS.md`, 글꼴별 고지 |
| Node.js 22 실행환경과 내장 구성요소 | Node.js MIT 및 배포본에 포함된 개별 고지 | 실행 묶음의 `runtime/LICENSE.Node.txt`; 실제 버전은 빌드 기록으로 확인 |
| Rust 표준 라이브러리 | Rust 배포본에 포함된 구성요소별 조건 | 실행 묶음의 `Rust-COPYRIGHT-library.html` |

rhwp 소스 기준은 [커밋 1a76570](https://github.com/edwardkim/rhwp/tree/1a76570e833917d15817415a53c09ad61ab3203f)이다. 빌드 스크립트가 Studio 소스를 복사하고 Jueony의 화면·탭·저장 보호 연결을 추가한다. 이 수정은 rhwp 원본의 MIT 고지를 대체하지 않는다.

[gongmuwon](https://github.com/Kminer2053/gongmuwon/tree/ef84271059eb178a08e4a358d761dab10ada7a78)은 현재 분석용 참조 저장소다. 원본 소스는 MIT(Copyright (c) 2026 gongmuwon)이며, 모델·런타임·공문 템플릿 등의 별도 고지를 구분해야 한다. 현재 편집기 실행 묶음에는 gongmuwon 앱·Python 사이드카·모델을 포함하지 않는다. 이를 나중에 편입하면 실제 포함 파일의 원문 고지를 추가한다.

`upstream/`, `node_modules/`, 로컬 도구와 생성 빌드 폴더는 Git 업로드 대상이 아니다. 참조 저장소를 내려받는 것과 그 소스의 이용허락을 Jueony 약관으로 바꾸는 것은 다르다. 개발 의존성은 각 설치 패키지의 라이선스를 따르며, 실행 묶음에 추가로 포함하면 해당 고지도 함께 제공해야 한다.

최종 배포 전에는 [배포 구성별 확인 절차](docs/06-license-inventory.md)에 따라 폰트·런타임·전이 의존성 및 고지 전문을 대조한다. 기존 제3자 라이선스의 권리와 의무는 이 안내에 누락되어 있더라도 그대로 적용된다.
