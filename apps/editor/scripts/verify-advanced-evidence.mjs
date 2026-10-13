import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'),imageProfile=process.argv.includes('--profile=page-image'),regionProfile=imageProfile||process.argv.includes('--profile=page-region'),pageProfile=regionProfile||process.argv.includes('--profile=page-inclusion'),profile=imageProfile?'page-image':regionProfile?'page-region':pageProfile?'page-inclusion':'advanced-editor',directory = resolve(repo, 'docs/evidence/'+profile+'-'+(imageProfile?'2026-10-14':'2026-10-13')), dist = resolve(repo, 'apps/editor/evidence/dist-'+profile);
const json = async path => JSON.parse(await readFile(path, 'utf8')), hash = bytes => createHash('sha256').update(bytes).digest('hex'), build = await json(resolve(dist, 'build-evidence.json'));
const source = [];
async function collect(path, prefix = '') { for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const name = prefix + entry.name; if (entry.isDirectory()) await collect(resolve(path, entry.name), name + '/'); else source.push(name, await readFile(resolve(path, entry.name), 'utf8')); } }
await collect(resolve(repo, 'apps/editor/src')); assert.equal(build.customSourceSha256, hash(source.join('\n')), 'source changed after build');
assert.equal(build.buildScriptSha256, hash(await readFile(resolve(repo, 'apps/editor/scripts/build.mjs'))));
assert.equal(build.tableConversionPatchSha256, hash(await readFile(resolve(repo, 'apps/editor/scripts/integration/table-conversion-patches.mjs'))));
assert.equal(build.pageBorderPatchSha256, hash(await readFile(resolve(repo, 'apps/editor/scripts/integration/page-border-patches.mjs'))));
for (const patch of build.engineBuild.patches) assert.equal(patch.sha256, hash(await readFile(resolve(repo, 'engine/patches', patch.name))));
assert.ok(build.engineBuild.patches.some(p => p.name === 'merged-table-transpose.patch'));
if(pageProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='page-border-inclusion.patch'));
if(regionProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='page-border-region.patch'));
if(imageProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='page-border-z-image.patch'));
assert.deepEqual((await readdir(resolve(repo, 'engine/patches'))).filter(f => f.endsWith('.patch')).sort(), build.engineBuild.patches.map(p => p.name).sort());
const unitPath = resolve(directory, 'unit.txt'), unit = (await readFile(unitPath, 'utf8')).replace(/[ \t]+$/gmu, ''); await writeFile(unitPath, unit);
const count = label => Number(unit.match(new RegExp('^# ' + label + ' (\\d+)$', 'm'))?.[1]); assert.ok(count('tests') >= (imageProfile?395:regionProfile?386:pageProfile?385:384)); assert.equal(count('pass'), count('tests')); for (const key of ['fail', 'skipped', 'cancelled', 'todo']) assert.equal(count(key), 0);
const boundaries = await json(resolve(directory, 'boundaries.json')); assert.equal(boundaries.ok, true); assert.deepEqual(boundaries.diagnostics, []);
const suites = [['browser/result.json', regionProfile?24:pageProfile?20:18], ['regression-parity/result.json', 66], ['regression-session/result.json', 9], ['basic-text/basic-text-browser.json', 28], ['regression-agent/result.json', 9]];
if(pageProfile)suites.push(['regression-table/result.json',18]);
if(imageProfile)suites.push(['image-browser/result.json',26]);
if (process.argv.includes('--include-bundle')) suites.push(['bundle-compatibility/result.json', 4]);
const reports = [];
for (const [file, minimum] of suites) {
  const report = await json(resolve(directory, file)); assert.ok(report.results.length >= minimum, file + ': incomplete suite');
  for (const key of ['failures', 'errors', 'pageErrors', 'consoleErrors', 'externalRequests', 'external']) if (report[key] !== undefined) assert.deepEqual(report[key], [], file + ': ' + key);
  for (const key of ['customSourceSha256', 'buildScriptSha256', 'engineWasmSha256', 'tableConversionPatchSha256','pageBorderPatchSha256']) assert.equal(report.build[key], build[key], file + ': stale ' + key);
  reports.push({ file, passed: report.results.length, sha256: hash(await readFile(resolve(directory, file))) });
}
const native = await json(resolve(directory, 'native/result.json')); assert.ok(native.results.length >= (regionProfile?55:pageProfile?38:17)); assert.deepEqual(native.failures, []); assert.equal(native.engine.wasmSha256, build.engineWasmSha256);
let nativePassed=native.results.length;
if(imageProfile){const images=await json(resolve(directory,'image-native/result.json'));assert.ok(images.results.length>=35);assert.deepEqual(images.failures,[]);assert.equal(images.engine.wasmSha256,build.engineWasmSha256);nativePassed+=images.results.length;}
const summary = { status: 'PASS_SCOPED_AUTOMATED_CHECKS', verifiedAt: new Date().toISOString(), unitPassed: count('pass'), browserPassed: reports.reduce((n, r) => n + r.passed, 0), nativePassed, moduleCount: boundaries.moduleCount, moduleFiles: boundaries.scannedFiles,
  customSourceSha256: build.customSourceSha256, buildScriptSha256: build.buildScriptSha256, wasmSha256: build.engineWasmSha256, engineSourceId: build.engineBuild.sourceId, buildApplicationCommit: build.applicationSourceCommit, buildApplicationDirty: build.applicationSourceDirty, reports,
  limitations: ['Actual Hancom GUI/layout comparison is deferred.', 'No paid LLM request: Agent tests use a deterministic local adapter.', 'Full Hangul feature parity remains incomplete; no percentage of completion is inferred from these scoped tests.', 'Unsupported source properties may be blocked by the stricter cell preservation guard.'] };
await writeFile(resolve(directory, 'verification-summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
