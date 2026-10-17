set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export RHWP_MCST_LOWER_DIAG=1
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
cd "$JUEONY_REPO/build/mcst-cross-closure77/source-import-v7-compact80"
cargo test --offline --locked --test jueony_mcst_cross -- --nocapture > ../native-import-v7compact80-strict-applied-readonly.log 2>&1
