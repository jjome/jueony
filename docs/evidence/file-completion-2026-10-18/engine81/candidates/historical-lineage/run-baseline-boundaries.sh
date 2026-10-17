set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
export JUEONY_PHASE=baseline80
export JUEONY_BASELINE=1
cd "$JUEONY_REPO/build/mcst-historical-closure80/source-baseline80"
touch src/lib.rs
cargo test --offline --test jueony_historical_origin provenance_boundaries -- --nocapture --test-threads=1 > ../native-baseline-boundaries.log 2>&1
