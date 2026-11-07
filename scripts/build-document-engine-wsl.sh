#!/usr/bin/env bash
set -euo pipefail
project_root="$(wslpath -u "$1")"
export RUSTUP_HOME="$project_root/.tools/linux-rustup"
export CARGO_HOME="$project_root/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
# Cargo releases its build lock before wasm-bindgen reads rhwp.wasm. Separate
# patched sources must never publish from the same target directory.
source_name="${PWD##*/}"
[[ "$source_name" =~ ^source-[0-9a-f]{16}$ ]]
export CARGO_TARGET_DIR="/tmp/jueony-rhwp-engine/target/$source_name"
bindgen="$project_root/.tools/downloads/wasm-bindgen-0.2.127-x86_64-unknown-linux-musl/wasm-bindgen"
test -x "$bindgen"
cargo metadata --locked --format-version 1 --no-deps > cargo-metadata.json
cargo build --locked --target wasm32-unknown-unknown --release --lib -p rhwp -j 2
"$bindgen" --target web --out-dir pkg --out-name rhwp "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/rhwp.wasm"
