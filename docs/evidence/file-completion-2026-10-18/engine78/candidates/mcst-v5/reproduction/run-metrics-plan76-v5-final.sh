set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
cd "$JUEONY_REPO/build/file-closure75-public-readonly/metrics-plan-candidate76-v5"
touch src/lib.rs
cargo test --offline --test jueony_mcst_boundary --test jueony_mcst_exclusions --test jueony_mcst_readonly --test jueony_actual11 --test jueony_mcst_hwpx -- --nocapture > ../metrics-plan76-v5-final.log 2>&1
