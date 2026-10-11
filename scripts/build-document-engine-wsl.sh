#!/usr/bin/env bash
set -euo pipefail
project_root="$(wslpath -u "$1")"
export RUSTUP_HOME="$project_root/.tools/linux-rustup"
export CARGO_HOME="$project_root/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
# Linux storage supports Cargo's shared hard-link cache; Windows bind mounts may not.
export CARGO_TARGET_DIR="/tmp/jueony-rhwp-engine/target/pr-review"
bindgen="$project_root/.tools/downloads/wasm-bindgen-0.2.127-x86_64-unknown-linux-musl/wasm-bindgen"
test -x "$bindgen"
cargo metadata --locked --format-version 1 --no-deps > cargo-metadata.json
cargo build --locked --target wasm32-unknown-unknown --release --lib -p rhwp -j 2
"$bindgen" --target web --out-dir pkg --out-name rhwp "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/rhwp.wasm"
