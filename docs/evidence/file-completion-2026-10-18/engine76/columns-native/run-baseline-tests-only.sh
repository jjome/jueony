set -euo pipefail
root=/mnt/c/Users/jjome/Documents/work/jueony
export RUSTUP_HOME="$root/.tools/linux-rustup"
export CARGO_HOME="$root/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/columns74-baseline
export JUEONY_REPO="$root"
cd "$root/build/file-closure69-public/column2-candidate74/baseline-source"
# Force the matching private source into this shared dependency cache; never
# rely on copied timestamps when alternating two workspace-identical packages.
# Existing lib was built from verified immutable source; only integration tests changed.
export JUEONY_COLUMN_MODE=baseline
export JUEONY_FLOW_SHA=$(sha256sum src/renderer/typeset/controls/flow_table.rs | cut -d ' ' -f1)
export JUEONY_WRITE_BASELINE=1
cargo test --offline --locked --test jueony_generated_columns -p rhwp -- --nocapture --skip actual_column2_full_geometry --skip both_sources_both_formats_twice --skip first_model_contract_probe --skip original_api_history --skip hancom_api_history --skip existing_actual_nine_pairs_remain_exact --skip actual_negative_pair_remains_exact
