#!/usr/bin/env bash
set -euo pipefail
repo="/mnt/c/Users/jjome/Documents/work/jueony"
export RUSTUP_HOME="$repo/.tools/linux-rustup"
export CARGO_HOME="$repo/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR="/tmp/jueony-unknown-control-loss-target"
export CARGO_NET_OFFLINE=true
export JUEONY_TEST_OUTPUT="$repo/build/unknown-control-loss-candidate/$1"
cd "$repo/build/unknown-control-loss-candidate/source"
cargo test --offline --locked -p rhwp --test jueony_unknown_control_loss -j 2 -- --test-threads=1 --nocapture
