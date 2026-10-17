set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export RHWP_MCST_LOWER_DIAG=1
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
cd "$JUEONY_REPO/build/metadata-author-closure82/source-prefix-baseline82"
touch src/lib.rs
cargo test --offline --locked --test jueony_summary_prefix -- --nocapture > ../native-prefix-baseline82.log 2>&1
