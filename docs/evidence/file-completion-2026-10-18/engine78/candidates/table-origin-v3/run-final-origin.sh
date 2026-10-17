set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
export JUEONY_ORIGIN_PHASE=candidate
cd "$JUEONY_REPO/build/table-origin-closure77/source-candidate77"
cargo test --offline --test jueony_table_origin -- --nocapture --test-threads=1 > ../native-final-origin77.log 2>&1
