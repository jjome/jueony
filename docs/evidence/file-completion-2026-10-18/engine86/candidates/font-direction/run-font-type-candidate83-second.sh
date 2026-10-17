set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
cd "$JUEONY_REPO/build/text-direction-closure83/source-font-type-candidate83"
touch src/lib.rs
cargo test --offline --locked --test jueony_font_type_origin -- --nocapture > ../native-font-type-candidate83-second.log 2>&1
