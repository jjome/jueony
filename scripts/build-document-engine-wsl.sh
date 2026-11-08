#!/usr/bin/env bash
set -euo pipefail
project_root="$(wslpath -u "$1")"
export RUSTUP_HOME="$project_root/.tools/linux-rustup"
export CARGO_HOME="$project_root/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
source_name="${PWD##*/}"
[[ "$source_name" =~ ^source-[0-9a-f]{16}$ ]]
# Reuse dependency artifacts across patched sources. Cargo's own lock ends
# before wasm-bindgen reads rhwp.wasm, so hold this lock through publication.
# Each source still receives its own pkg and verified build manifest.
cache_root="/tmp/jueony-rhwp-engine"
mkdir -p "$cache_root/target"
exec 9>"$cache_root/engine-wasm-build.lock"
flock 9
export CARGO_TARGET_DIR="$cache_root/target/shared-wasm"
bindgen="$project_root/.tools/downloads/wasm-bindgen-0.2.127-x86_64-unknown-linux-musl/wasm-bindgen"
test -x "$bindgen"
cargo metadata --locked --format-version 1 --no-deps > cargo-metadata.json
cargo build --locked --target wasm32-unknown-unknown --release --lib -p rhwp -j 2
"$bindgen" --target web --out-dir pkg --out-name rhwp "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/rhwp.wasm"
