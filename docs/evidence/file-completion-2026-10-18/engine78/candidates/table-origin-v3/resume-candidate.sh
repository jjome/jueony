set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
export JUEONY_ORIGIN_PHASE=candidate
cd "$JUEONY_REPO/build/table-origin-closure77/source-candidate77"
touch src/lib.rs
cargo test --offline --test jueony_table_origin -- --nocapture --test-threads=1 > ../native-candidate77.log 2>&1
cargo test --offline --test jueony_actual11 actual_ -- --nocapture --test-threads=1 > ../native-actual11.log 2>&1
cargo test --offline --test jueony_mcst_hwpx -- --nocapture --test-threads=1 > ../native-mcst-v5.log 2>&1
