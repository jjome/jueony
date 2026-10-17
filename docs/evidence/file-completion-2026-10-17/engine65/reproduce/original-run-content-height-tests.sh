#!/usr/bin/env bash
set -euo pipefail
project_root="$(wslpath -u "$1")"
export RUSTUP_HOME="$project_root/.tools/linux-rustup"
export CARGO_HOME="$project_root/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR="/tmp/jueony-rhwp-engine/target/pr-review"
export JUEONY_TABLE_HEIGHT_CONTROLS="$project_root/build/table-height-contract-20261017"
export JUEONY_TEXTBOX_REVIEW="$project_root/build/hancom-owned-file-review-20261017"
cargo test --locked -p rhwp --test jueony_table_content_height -j 2 -- --nocapture
