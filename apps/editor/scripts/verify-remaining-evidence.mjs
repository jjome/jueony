import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), directory = resolve(repo, 'docs/evidence/remaining-editor-2026-10-13'), dist = resolve(repo, 'apps/editor/evidence/dist-remaining-editor');
const json = async path => JSON.parse(await readFile(path, 'utf8')), digest = bytes => createHash('sha256').update(bytes).digest('hex'), build = await json(resolve(dist, 'build-evidence.json'));
const source = [];
async function collect(path, prefix = '') { for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const name = prefix + entry.name; if (entry.isDirectory()) await collect(resolve(path, entry.name), name + '/'); else source.push(name, await readFile(resolve(path, entry.name), 'utf8')); } }
await collect(resolve(repo, 'apps/editor/src')); assert.equal(build.customSourceSha256, digest(source.join('\n')), 'current source differs from tested build'); assert.equal(build.buildScriptSha256, digest(await readFile(resolve(repo, 'apps/editor/scripts/build.mjs'))));
for (const [name, key] of [['keyboard-context-patches.mjs', 'keyboardContextPatchSha256'], ['document-swap-state-patches.mjs', 'documentSwapStatePatchSha256']]) assert.equal(build[key], digest(await readFile(resolve(repo, 'apps/editor/scripts/integration', name))));
for (const patch of build.engineBuild.patches) assert.equal(patch.sha256, digest(await readFile(resolve(repo, 'engine/patches', patch.name))));
// Keep raw TAP in build/; normalize only trailing whitespace in the committed copy.
await writeFile(resolve(directory, 'editor-unit.txt'), (await readFile(resolve(repo, 'build/remaining-editor-unit.log'), 'utf8')).replace(/[ \t]+$/gmu, '')); await copyFile(resolve(repo, 'build/remaining-editor-boundaries.json'), resolve(directory, 'module-boundaries.json'));
const unit = await readFile(resolve(directory, 'editor-unit.txt'), 'utf8'), count = label => Number(unit.match(new RegExp('^# ' + label + ' (\\d+)$', 'm'))?.[1]); assert.ok(count('tests') >= 373); assert.equal(count('pass'), count('tests')); for (const field of ['fail', 'skipped', 'cancelled', 'todo']) assert.equal(count(field), 0);
const boundaries = await json(resolve(directory, 'module-boundaries.json')); assert.equal(boundaries.ok, true); assert.deepEqual(boundaries.diagnostics, []);
const suites = [['basic-text-browser.json', 28], ['regression-parity/result.json', 66], ['regression-session/result.json', 9], ['regression-table/result.json', 6], ['regression-agent/result.json', 9]];
if (process.argv.includes('--include-bundle')) suites.push(['bundle-compatibility/result.json', 4]);
const results = [];
for (const [file, minimum] of suites) {
  const report = await json(resolve(directory, file)); assert.ok(Array.isArray(report.results) && report.results.length >= minimum, 'incomplete suite: ' + file);
  for (const key of ['failures', 'errors', 'pageErrors', 'consoleErrors', 'externalRequests', 'external']) if (report[key] !== undefined) assert.deepEqual(report[key], [], file + ': ' + key);
  assert.equal(report.build.customSourceSha256, build.customSourceSha256, file + ': stale source'); assert.equal(report.build.buildScriptSha256, build.buildScriptSha256, file + ': stale integration'); assert.equal(report.build.engineWasmSha256, build.engineWasmSha256, file + ': stale engine');
  results.push({ report: file, passed: report.results.length, sha256: digest(await readFile(resolve(directory, file))) });
}
const summary = { status: 'PASS_SCOPED_AUTOMATED_CHECKS', verifiedAt: new Date().toISOString(), unitPassed: count('pass'), browserPassed: results.reduce((sum, result) => sum + result.passed, 0), moduleCount: boundaries.moduleCount, moduleFiles: boundaries.scannedFiles, customSourceSha256: build.customSourceSha256, buildScriptSha256: build.buildScriptSha256, wasmSha256: build.engineWasmSha256, buildApplicationCommit: build.applicationSourceCommit, buildApplicationDirty: build.applicationSourceDirty, results,
  limitations: ['Actual Hancom GUI/shortcut/layout comparison deferred by the user.', 'No paid LLM request; Agent regression uses a local deterministic model.', 'Full Hangul feature parity and four existing public cross-format preservation failures remain incomplete.'] };
await writeFile(resolve(directory, 'verification-summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
