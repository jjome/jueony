#!/usr/bin/env bash
set -euo pipefail
repo=/mnt/c/Users/jjome/Documents/work/jueony
export RUSTUP_HOME="$repo/.tools/linux-rustup"
export CARGO_HOME="$repo/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/hwt-leaf115-conversion
export JUEONY_HWT_WRITE_OUTPUT="$repo/build/hwt-leaf115/artifacts-native4-scalar-final"
cd "$repo/build/hwt-leaf115/native-v4"
touch ../source-v4/src/lib.rs
cargo test --offline --locked -j2 -- --nocapture --test-threads=1
