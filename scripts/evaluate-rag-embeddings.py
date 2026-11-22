"""Offline inference for the synthetic RAG corpus. Input and output use JSON over stdio."""

import argparse
import ctypes
import hashlib
import json
from pathlib import Path
import sys
from time import perf_counter

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer, __version__ as tokenizer_version


ASSETS = {
    "model_qint8_avx512_vnni.onnx": "dd476dd0c2514e9b9be83aeb3853fac0763e0bdf4a71645407587d77c48a2d88",
    "tokenizer.json": "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
}


def verify_assets(directory):
    for name, expected in ASSETS.items():
        with (directory / name).open("rb") as file:
            actual = hashlib.file_digest(file, "sha256").hexdigest()
        if actual != expected:
            raise ValueError(f"Asset SHA-256 mismatch: {name}")


def encode(session, tokenizer, texts):
    tokens = tokenizer.encode_batch(texts)
    mask = np.array([item.attention_mask for item in tokens], dtype=np.int64)
    inputs = {
        "input_ids": np.array([item.ids for item in tokens], dtype=np.int64),
        "attention_mask": mask,
        "token_type_ids": np.array([item.type_ids for item in tokens], dtype=np.int64),
    }
    native = {item.name: inputs[item.name] for item in session.get_inputs()}
    (hidden,) = session.run(["last_hidden_state"], native)
    if hidden.shape != (*mask.shape, 384):
        raise ValueError("Unexpected e5-small output dimensions")
    weighted = mask[..., None].astype(np.float32)
    pooled = np.sum(hidden * weighted, axis=1) / np.sum(weighted, axis=1)
    norms = np.linalg.norm(pooled, axis=1, keepdims=True)
    if np.any(norms <= 0) or not np.isfinite(norms).all():
        raise ValueError("An embedding did not produce a finite nonzero vector")
    return pooled / norms


def peak_memory_bytes():
    if sys.platform != "win32":
        import resource

        amount = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return amount if sys.platform == "darwin" else amount * 1024

    from ctypes import wintypes

    class Counters(ctypes.Structure):
        _fields_ = [
            ("cb", wintypes.DWORD), ("faults", wintypes.DWORD),
            *[(name, ctypes.c_size_t) for name in (
                "peak", "working", "peak_paged", "paged", "peak_nonpaged", "nonpaged", "pagefile", "peak_pagefile"
            )],
        ]

    handle = ctypes.windll.kernel32.GetCurrentProcess
    handle.restype = wintypes.HANDLE
    read_memory = ctypes.windll.psapi.GetProcessMemoryInfo
    read_memory.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    usage = Counters()
    usage.cb = ctypes.sizeof(usage)
    return usage.peak if read_memory(handle(), ctypes.byref(usage), usage.cb) else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("asset_directory", type=Path)
    directory = parser.parse_args().asset_directory
    raw_input = sys.stdin.buffer.read(4_000_001)
    if len(raw_input) > 4_000_000:
        raise ValueError("Synthetic input exceeds 4 MB")
    data = json.loads(raw_input.decode("utf-8"))
    passages = data["passages"]
    queries = data["queries"]
    if not 1 <= len(passages) <= 600 or not 1 <= len(queries) <= 100:
        raise ValueError("Synthetic corpus exceeds the evaluation limit")

    start = perf_counter()
    verify_assets(directory)
    verify_ms = (perf_counter() - start) * 1000
    start = perf_counter()
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(directory / next(iter(ASSETS))), options, providers=["CPUExecutionProvider"])
    tokenizer = Tokenizer.from_file(str(directory / "tokenizer.json"))
    tokenizer.enable_truncation(max_length=512)
    tokenizer.enable_padding(pad_id=tokenizer.token_to_id("<pad>"), pad_token="<pad>")
    load_ms = (perf_counter() - start) * 1000

    start = perf_counter()
    passage_items = list(passages.items())
    indexed = {}
    for offset in range(0, len(passage_items), 8):
        batch = passage_items[offset:offset + 8]
        vectors = encode(session, tokenizer, ["passage: " + text for _, text in batch])
        indexed.update((key, vector) for (key, _), vector in zip(batch, vectors, strict=True))
    index_ms = (perf_counter() - start) * 1000

    evaluated = []
    for query in queries:
        start = perf_counter()
        (vector,) = encode(session, tokenizer, ["query: " + query["text"]])
        scores = [(key, float(indexed[key] @ vector)) for key in query["allowed"]]
        scores.sort(key=lambda entry: (-entry[1], entry[0]))
        evaluated.append({"id": query["id"], "ranked": [key for key, _ in scores], "milliseconds": (perf_counter() - start) * 1000})

    print(json.dumps({
        "model": "intfloat/multilingual-e5-small",
        "revision": "6a0d452a575215f80b8f66276dd4ee5d504942c6",
        "license": "MIT",
        "assets": {name: {"sha256": digest, "bytes": (directory / name).stat().st_size} for name, digest in ASSETS.items()},
        "runtime": {"onnxruntime": ort.__version__, "tokenizers": tokenizer_version, "numpy": np.__version__, "provider": session.get_providers()[0], "threads": 2},
        "dimensions": 384,
        "embeddedPassages": len(indexed),
        "assetVerificationMilliseconds": verify_ms,
        "loadMilliseconds": load_ms,
        "indexMilliseconds": index_ms,
        "peakWorkingSetBytes": peak_memory_bytes(),
        "queries": evaluated,
    }))


if __name__ == "__main__":
    main()
