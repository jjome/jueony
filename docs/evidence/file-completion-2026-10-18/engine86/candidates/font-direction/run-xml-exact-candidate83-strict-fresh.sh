set -euo pipefail
export RUSTUP_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-rustup
export CARGO_HOME=/mnt/c/Users/jjome/Documents/work/jueony/.tools/linux-cargo
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/negative-closure70
export PATH="$CARGO_HOME/bin:$PATH"
export JUEONY_REPO=/mnt/c/Users/jjome/Documents/work/jueony
cd "$JUEONY_REPO/build/text-direction-closure83/source-xml-exact-candidate83"
touch src/lib.rs
cargo test --offline --locked --test jueony_xml_text_direction -- --nocapture > ../native-xml-exact-candidate83-strict-fresh.log 2>&1
