set -euo pipefail
root=/mnt/c/Users/jjome/Documents/work/jueony
export RUSTUP_HOME="$root/.tools/linux-rustup"
export CARGO_HOME="$root/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/transpose-closure77
export JUEONY_REPO="$root"
export JUEONY_TRANSPOSE_MODE="${1:-baseline}"
cd "$root/build/transpose-closure77/source"
export JUEONY_TABLE_OPS_SHA=$(sha256sum src/document_core/commands/table_ops.rs | cut -d ' ' -f1)
cargo test --offline --locked --test jueony_transpose_layout -p rhwp -- --nocapture
