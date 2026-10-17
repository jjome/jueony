#!/usr/bin/env bash
set -euo pipefail
repo="$(wslpath -u "$1")"
source="$(wslpath -u "$2")"
filter="$3"
expected="$4"
export RUSTUP_HOME="$repo/.tools/linux-rustup"
export CARGO_HOME="$repo/.tools/linux-cargo"
export PATH="$CARGO_HOME/bin:$PATH"
export CARGO_TARGET_DIR=/tmp/jueony-rhwp-engine/target/pr-review
export JUEONY_OUTER_FIXTURES="$repo/build/hancom-owned-file-review-20261017"
cd "$source"
listing="$(cargo test --offline --locked -p rhwp --lib "$filter" --no-default-features -j 2 -- --list)"
count=0
while IFS= read -r line; do
  if [[ "$line" == *"::$filter"*": test" ]]; then count=$((count+1)); fi
done <<< "$listing"
printf '%s\n' "$listing"
if [[ "$count" -ne "$expected" ]]; then printf 'Expected %s tests, found %s; refusing empty/stale success\n' "$expected" "$count" >&2; exit 2; fi
cargo test --offline --locked -p rhwp --lib "$filter" --no-default-features -j 2
