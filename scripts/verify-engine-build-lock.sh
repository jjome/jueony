#!/usr/bin/env bash
set -euo pipefail
# WSL-only: bash verify-engine-build-lock.sh /absolute/path/to/build-document-engine-wsl.sh
# Substitute only the cache root; never write mock artifacts into the real cache.
[[ $# == 1 && -f "$1" ]] || { echo 'Pass the WSL build script path' >&2; exit 2; }
check_root=$(mktemp -d /tmp/jueony-lock-check.XXXXXX)
trap 'rm -rf -- "$check_root"' EXIT
project="$check_root/project"
mkdir -p "$project/.tools/linux-cargo/bin" "$project/.tools/downloads/wasm-bindgen-0.2.127-x86_64-unknown-linux-musl"
grep -Fx 'cache_root="/tmp/jueony-rhwp-engine"' "$1" >/dev/null
sed "s|cache_root=\"/tmp/jueony-rhwp-engine\"|cache_root=\"$check_root/cache\"|" "$1" > "$check_root/build.sh"
if grep -F '/tmp/jueony-rhwp-engine' "$check_root/build.sh" >/dev/null; then
  echo 'Refusing to run mocks without an isolated cache' >&2; exit 2
fi
cat > "$project/.tools/linux-cargo/bin/cargo" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == metadata ]]; then echo '{}'; exit 0; fi
mkdir -p "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release"
printf '%s' "${PWD##*/}" > "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/rhwp.wasm"
SH
bindgen="$project/.tools/downloads/wasm-bindgen-0.2.127-x86_64-unknown-linux-musl/wasm-bindgen"
cat > "$bindgen" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
touch bindgen-started
sleep .3
test "$(cat "${!#}")" = "${PWD##*/}"
mkdir -p pkg
cp "${!#}" pkg/verified-source
SH
chmod +x "$project/.tools/linux-cargo/bin/cargo" "$bindgen"
project_arg=$(wslpath -w "$project")
first="$check_root/source-0000000000000001"
second="$check_root/source-0000000000000002"
mkdir -p "$first" "$second"
(cd "$first"; bash "$check_root/build.sh" "$project_arg") & one=$!
for ((i=0;i<100;i++)); do [[ -f "$first/bindgen-started" ]] && break; sleep .01; done
test -f "$first/bindgen-started"
(cd "$second"; bash "$check_root/build.sh" "$project_arg") & two=$!
wait "$one"
wait "$two"
test "$(cat "$first/pkg/verified-source")" = source-0000000000000001
test "$(cat "$second/pkg/verified-source")" = source-0000000000000002
echo 'PASS two overlapping builds retain the correct source artifact through bindgen'
