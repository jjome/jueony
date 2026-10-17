"""Run the existing file-preservation regressions against an explicit engine/build.

These are 27 direct-WASM and 17 real-browser groups, not 44 Hancom parity cases.
Browser groups use local provider/IPC fixtures; native Windows dialogs are separate.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "apps/editor"
NATIVE = [
    ("table-split", "split-native"), ("table-merge", "merge-native"),
    ("row-heights", "native"), ("table-multi-header", "table-multi-header-native"),
    ("agent-table-header", "agent-table-header-native"),
    ("agent-table-pagination", "agent-table-pagination-native"),
    ("table-protection", "table-protection-native"),
    ("table-conversion", "table-conversion-native"), ("style", "styles-native"),
    ("style-stories", "style-stories-native"),
    ("agent-style-next", "agent-style-next-native"), ("cell-padding", "agent-native"),
    ("memo-tail", "memo-native"), ("following-table", "following-native"),
    ("table-outer-margin", "outer-native"), ("column-width", "width-native"),
    ("equal-columns", "equal-native"), ("paragraph-page-owner", "owner-native"),
    ("cell-padding-hwp", "host-native"), ("table-default-padding", "default-native"),
    ("table-structure", "structure-native"), ("cell-paragraph", "cell-paragraph-native"),
    ("table-subdivision", "subdivision-native"), ("session-textbox", "textbox-native"),
    ("textbox-alignment", "textbox-storage-native"),
    ("format-conversion", "format-conversion-native"),
    ("overlap-table-tail", "overlap-native"),
]
BROWSER = [
    ("table-split", "split-browser"), ("table-merge", "merge-browser"),
    ("row-heights", "browser"), ("table-multi-header", "table-multi-header-browser"),
    ("agent-table-header", "agent-table-header-browser"),
    ("agent-table-pagination", "agent-table-pagination-browser"),
    ("table-protection", "table-protection-browser"),
    ("table-conversion", "table-conversion-browser"),
    ("selected-object-properties", "selected-object-browser"),
    ("agent-style-next", "agent-style-next-browser"), ("cell-padding", "agent-browser"),
    ("column-width", "width-browser"), ("equal-columns", "equal-browser"),
    ("table-structure", "structure-browser"), ("cell-paragraph", "cell-paragraph-browser"),
    ("table-subdivision", "subdivision-browser"), ("session-textbox", "textbox-browser"),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", type=Path, required=True)
    parser.add_argument("--dist", type=Path, help="Required for browser groups")
    parser.add_argument("--output", type=Path, required=True, help="New directory; never overwrite a prior run")
    parser.add_argument("--kind", choices=("native", "browser", "all"), default="all")
    parser.add_argument("--node", default=shutil.which("node"))
    parser.add_argument("--workers", type=int, choices=(1, 2), default=2)
    args = parser.parse_args()
    if not args.node:
        parser.error("Node.js was not found; pass --node explicitly")
    engine, output = args.engine.resolve(), args.output.resolve()
    metadata = json.loads((engine / "jueony-engine-build.json").read_text(encoding="utf-8"))
    if hashlib.sha256((engine / "rhwp_bg.wasm").read_bytes()).hexdigest() != metadata["wasmSha256"]:
        parser.error("Engine WASM does not match its build manifest")
    dist = args.dist.resolve() if args.dist else None
    if args.kind != "native":
        if dist is None:
            parser.error("--dist is required for browser groups")
        build = json.loads((dist / "build-evidence.json").read_text(encoding="utf-8"))
        if build["engineWasmSha256"] != metadata["wasmSha256"]:
            parser.error("Frontend and engine WASM fingerprints differ")
    tasks = [(s, c, "native") for s, c in NATIVE] if args.kind != "browser" else []
    if args.kind != "native":
        tasks += [(s, c, "browser") for s, c in BROWSER]
    env = os.environ.copy()
    env.update(JUEONY_ENGINE_PACKAGE=str(engine), JUEONY_REQUIRE_BORDER_REGION="1")
    if dist:
        env["JUEONY_TEST_DIST"] = str(dist)
    output.mkdir(parents=True, exist_ok=False)
    (output / "logs").mkdir()

    def run(task: tuple[str, str, str]) -> dict:
        name, category, kind = task
        suffix = "-engine" if kind == "native" else ""
        script = APP / "scripts" / f"verify-{name}{suffix}.mjs"
        if not script.exists():
            script = APP / "scripts" / f"verify-{name}.mjs"
        child_env = env.copy()
        child_env["JUEONY_TEST_OUTPUT"] = str(output / category)
        if name in ("column-width", "equal-columns") and kind == "browser":
            child_env["JUEONY_TEST_HIDDEN_OWNER"] = "1"
        if name == "cell-padding" and kind == "browser":
            child_env["JUEONY_TEST_TABLE_DEFAULTS"] = "1"
        result = {"category": category, "kind": kind, "script": str(script.relative_to(ROOT))}
        try:
            result["verifierSha256"] = hashlib.sha256(script.read_bytes()).hexdigest()
            with (output / "logs" / f"{category}.log").open("w", encoding="utf-8") as log:
                process = subprocess.run(
                    [args.node, "--experimental-strip-types", str(script)],
                    cwd=ROOT if name in ("session-textbox", "textbox-alignment") else APP,
                    env=child_env, stdout=log, stderr=subprocess.STDOUT,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0), check=False,
                )
            result["exitCode"] = process.returncode
        except OSError as error:
            result.update(exitCode=-1, error=str(error))
        print(category, result["exitCode"], flush=True)
        return result

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(run, tasks))
    failed = [r for r in results if r["exitCode"] != 0]
    report = {"engine": metadata, "frontend": str(dist) if dist else None,
              "runnerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "results": results, "failures": failed,
              "scope": "Existing direct-WASM/browser regression groups; not Hancom parity or real Windows dialog certification."}
    (output / "result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
