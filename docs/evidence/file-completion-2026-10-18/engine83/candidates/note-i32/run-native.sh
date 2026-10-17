set -euo pipefail
root=/mnt/c/Users/jjome/Documents/work/jueony
export RUSTUP_HOME="$root/.tools/linux-rustup"
export CARGO_HOME="$root/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/transpose-closure77
export JUEONY_REPO="$root"
cd "$root/build/note-shape-i32-candidate82/$1"
cargo test --offline --locked --test jueony_note_i32 -p rhwp -- --nocapture
