#!/usr/bin/env bash
set -euo pipefail
repo=/mnt/c/Users/jjome/Documents/work/jueony
export RUSTUP_HOME="$repo/.tools/linux-rustup"
export CARGO_HOME="$repo/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/xml-format95
export JUEONY_HWT_INSTALLED='/mnt/c/Program Files (x86)/Hnc/Office 2024/HOffice130/Shared/HwpTemplate/XML/ko-KR'
export JUEONY_HWT_OUTPUT="$repo/build/xml-format95/native-artifacts-seventh"
cd "$repo/build/xml-format95/source"
cargo test --offline --locked -p rhwp --test xml_template95 -j 2 -- --nocapture --test-threads=1
