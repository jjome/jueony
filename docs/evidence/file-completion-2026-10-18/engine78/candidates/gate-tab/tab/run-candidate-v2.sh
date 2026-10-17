set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
cd /mnt/c/Users/jjome/Documents/work/jueony/build/tab-spacing-closure77/source
touch src/lib.rs
cargo test --offline --locked --test jueony_tab_spacing -- --nocapture > ../native-v2.log 2>&1
