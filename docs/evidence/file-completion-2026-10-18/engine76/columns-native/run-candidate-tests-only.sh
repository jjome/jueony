set -euo pipefail
root=/mnt/c/Users/jjome/Documents/work/jueony
export RUSTUP_HOME="$root/.tools/linux-rustup"
export CARGO_HOME="$root/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/columns74-candidate
export JUEONY_REPO="$root"
cd "$root/build/file-closure69-public/column2-candidate74/source"
# Force the matching private source into this shared dependency cache; never
# rely on copied timestamps when alternating two workspace-identical packages.
# Existing lib was built from verified immutable source; only integration tests changed.
export JUEONY_COLUMN_MODE=candidate
export JUEONY_FLOW_SHA=$(sha256sum src/renderer/typeset/controls/flow_table.rs | cut -d ' ' -f1)
"$RUSTUP_HOME/toolchains/1.93.1-x86_64-unknown-linux-gnu/bin/rustfmt" --edition 2021 src/renderer/generated_column_stack.rs tests/jueony_generated_columns.rs
export JUEONY_HELPER_SHA=$(sha256sum src/renderer/generated_column_stack.rs | cut -d ' ' -f1)
cargo test --offline --locked --test jueony_generated_columns -p rhwp -- --nocapture
