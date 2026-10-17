set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
cd "$JUEONY_REPO/build/session-font-provenance-closure84/source-candidate"
cargo test --offline --locked --test jueony_session_font_origin -- --nocapture > ../native-session-font-origin84-v2-raw-oracle.log 2>&1
