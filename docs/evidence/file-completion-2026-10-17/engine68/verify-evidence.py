from pathlib import Path
import hashlib
import json
import re

root = Path(__file__).resolve().parent
load = lambda path: json.loads(path.read_text(encoding="utf-8-sig"))
manifest = load(root / "SHA256-MANIFEST.json")
expected = set()
for item in manifest["files"]:
    path = (root / item["path"]).resolve()
    assert path.is_relative_to(root), item["path"]
    raw = path.read_bytes()
    assert len(raw) == item["bytes"], item["path"]
    assert hashlib.sha256(raw).hexdigest() == item["sha256"], item["path"]
    expected.add(item["path"])
actual = {p.relative_to(root).as_posix() for p in root.rglob("*")
          if p.is_file() and "__pycache__" not in p.parts and p != root / "SHA256-MANIFEST.json"}
assert actual == expected, (sorted(actual - expected), sorted(expected - actual))
engine = load(root / "engine-build.json")
assert engine["sourceId"] == "cda65172283c6657" and len(engine["patches"]) == 68
assert engine["wasmSha256"] == "4a9acaf931b91b967f93b777cf5b987c7e73d23cff0f0a9a9c719b5e244938e9"
bundles = load(root / "regressions44.json")
assert len(bundles) == 44 and all(x["exitCode"] == 0 for x in bundles)
for case in bundles:
    result = load(root / "regressions" / case["category"] / "result.json")
    if "failures" in result:
        assert result["failures"] == [], case["category"]
for name, count in [("save14", 14), ("agent16", 16), ("width18", 18)]:
    result = load(root / "lifecycle" / name / "result.json")
    assert len(result["results"]) == count and result["failures"] == []
    assert result["build"]["engineWasmSha256"] == engine["wasmSha256"]
lifecycle = load(root / "lifecycle/edge10.json")
assert len(lifecycle["results"]) == 10 and lifecycle["failures"] == []
for key in ["pageErrors", "consoleErrors", "externalRequests"]:
    assert lifecycle[key] == [], key
final_build = load(root / "lifecycle/frontend-final68.json")
assert final_build["engineWasmSha256"] == engine["wasmSha256"]
unit = (root / "lifecycle/final-unit870.log").read_text(encoding="utf-8")
for pattern in [r"(?m)^# tests 870$", r"(?m)^# pass 870$", r"(?m)^# fail 0$", r"(?m)^# skipped 0$"]:
    assert re.search(pattern, unit), pattern
assert (root / "lifecycle/typecheck-pass.log").read_bytes() == b""
outer = load(root / "outer/contract31-bom-preserving.json")
assert len(outer["results"]) == 31 and outer["failures"] == []
pair = next(x for x in outer["observations"] if x["name"] == "actual-pair" and x["format"] == "hwpx")
assert pair["semantic"] == 1 and pair["geometry"] == 0
assert pair["comparison"]["semantic"]["differences"] == [{"path": '$["summary-metadata"]["title"]', "before": "", "after": "앞 본문", "kind": "value"}]
for nested in [root / "metadata/SHA256-MANIFEST.json"]:
    child = load(nested)
    for item in child["files"]:
        raw = (nested.parent / item["path"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == item["sha256"]
native = load(root / "native-preparation/build-result.json")
assert native["status"] == "BUILT_NOT_GUI_TESTED" and native["actualNativeValidation"] == "NOT_RUN"
print(f"PASS {len(expected)} payload hashes, formal68 and distinct final-profile results; Hancom title1 and native NOT_RUN retained")
