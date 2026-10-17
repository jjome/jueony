set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
cd /mnt/c/Users/jjome/Documents/work/jueony/build/raw-namespace-closure83/source
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
cargo test -p rhwp --offline --locked --test jueony_raw_namespace raw_namespace83 -- --nocapture > ../native-namespace.log 2>&1
