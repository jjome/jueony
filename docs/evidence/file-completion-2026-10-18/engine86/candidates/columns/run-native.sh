set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
unset RHWP_VPOS_DEBUG
cd "$JUEONY_REPO/build/column3-closure83/candidate-source"
cargo test --offline --locked --no-fail-fast --test jueony_column3_storage --test jueony_mcst_actual11 -- --nocapture --test-threads=1 > ../native-candidate-first.log 2>&1
