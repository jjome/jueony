#!/usr/bin/env bash
set -euo pipefail
repo="/mnt/c/Users/jjome/Documents/work/jueony"
export RUSTUP_HOME="$repo/.tools/linux-rustup"
export CARGO_HOME="$repo/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR="/tmp/jueony-unknown-control-loss-target"
export CARGO_NET_OFFLINE=true
cd "$repo/build/unknown-control-loss-candidate/regression74/source"
export JUEONY_COMPARABLE_BASELINE73=1
cargo test --offline --locked -p rhwp --test jueony_negative_guards --test jueony_fullwidth_guards -j 2 unknownctrl -- --test-threads=1 --nocapture
