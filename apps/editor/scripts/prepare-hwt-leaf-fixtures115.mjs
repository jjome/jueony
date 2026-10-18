// Prepare an offline Native own-fixture/test harness against an explicit engine source.
import assert from'node:assert/strict';import fs from'node:fs/promises';import{resolve,isAbsolute,dirname}from'node:path';import{fileURLToPath}from'node:url';
for(const k of['JUEONY_ENGINE_SOURCE','JUEONY_TEST_OUTPUT'])assert.ok(isAbsolute(process.env[k]??''),k+' absolute required');
const source=resolve(process.env.JUEONY_ENGINE_SOURCE),out=resolve(process.env.JUEONY_TEST_OUTPUT),fixtures=resolve(dirname(fileURLToPath(import.meta.url)),'../tests/fixtures/hwt-leaf115-own');await fs.mkdir(out,{recursive:false});await fs.mkdir(out+'/src');
await fs.copyFile(fixtures+'/native-tests.rs',out+'/src/lib.rs');await fs.copyFile(fixtures+'/Cargo.lock',out+'/Cargo.lock');
await fs.writeFile(out+'/Cargo.toml',`[package]
name="hwt-leaf115-native"
version="0.1.0"
edition="2021"
[dependencies]
rhwp={path=${JSON.stringify(source)}}
cfb="0.15"
quick-xml="0.42"
serde_json={version="1",features=["float_roundtrip"]}
sha2="0.11"
flate2="1"
crc32fast="1"
[workspace]
[patch.crates-io]
svg2pdf={path=${JSON.stringify(source+'/vendor/svg2pdf')}}
`,{flag:'wx'});
console.log('Prepared Native harness only; run cargo test --offline --locked -- --nocapture --test-threads=1 with a unique CARGO_TARGET_DIR and fresh absolute JUEONY_HWT_WRITE_OUTPUT. No engine source modified.');
