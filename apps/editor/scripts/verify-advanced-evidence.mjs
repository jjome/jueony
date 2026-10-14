import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'),agentEmptyProfile=process.argv.includes('--profile=agent-empty'),splitProfile=agentEmptyProfile||process.argv.includes('--profile=agent-split'),macroProfile=splitProfile||process.argv.includes('--profile=section-macros'),agentMastersProfile=macroProfile||process.argv.includes('--profile=agent-masters'),backgroundProfile=agentMastersProfile||process.argv.includes('--profile=agent-background'),agentSectionsProfile=backgroundProfile||process.argv.includes('--profile=agent-sections'),caretProfile=agentSectionsProfile||process.argv.includes('--profile=hwpx-caret'),emptyProfile=caretProfile||process.argv.includes('--profile=empty-section'),imagePasteProfile=emptyProfile||process.argv.includes('--profile=page-image-paste'),styleProfile=imagePasteProfile||process.argv.includes('--profile=page-style'),paperProfile=styleProfile||process.argv.includes('--profile=page-paper'),copyProfile=paperProfile||process.argv.includes('--profile=page-copy'),deleteProfile=copyProfile||process.argv.includes('--profile=page-delete'),lineProfile=deleteProfile||process.argv.includes('--profile=line-numbers'),masterProfile=lineProfile||process.argv.includes('--profile=master-page'),imageProfile=masterProfile||process.argv.includes('--profile=page-image'),regionProfile=imageProfile||process.argv.includes('--profile=page-region'),pageProfile=regionProfile||process.argv.includes('--profile=page-inclusion'),profile=agentEmptyProfile?'agent-empty':splitProfile?'agent-split':macroProfile?'section-macros':agentMastersProfile?'agent-masters':backgroundProfile?'agent-background':agentSectionsProfile?'agent-sections':caretProfile?'hwpx-caret':emptyProfile?'empty-section':imagePasteProfile?'page-image-paste':styleProfile?'page-style':paperProfile?'page-paper':copyProfile?'page-copy':deleteProfile?'page-delete':lineProfile?'line-numbers':masterProfile?'master-page':imageProfile?'page-image':regionProfile?'page-region':pageProfile?'page-inclusion':'advanced-editor',directory = resolve(repo, 'docs/evidence/'+profile+'-'+(imageProfile?'2026-10-14':'2026-10-13')), dist = resolve(repo, 'apps/editor/evidence/dist-'+profile);
const json = async path => JSON.parse(await readFile(path, 'utf8')), hash = bytes => createHash('sha256').update(bytes).digest('hex'), build = await json(resolve(dist, 'build-evidence.json'));
const source = [];
async function collect(path, prefix = '') { for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const name = prefix + entry.name; if (entry.isDirectory()) await collect(resolve(path, entry.name), name + '/'); else source.push(name, await readFile(resolve(path, entry.name), 'utf8')); } }
await collect(resolve(repo, 'apps/editor/src')); assert.equal(build.customSourceSha256, hash(source.join('\n')), 'source changed after build');
assert.equal(build.buildScriptSha256, hash(await readFile(resolve(repo, 'apps/editor/scripts/build.mjs'))));
assert.equal(build.studioPatchSha256, hash(await readFile(resolve(repo, 'apps/editor/scripts/integration/studio-patches.mjs'))));
assert.equal(build.tableConversionPatchSha256, hash(await readFile(resolve(repo, 'apps/editor/scripts/integration/table-conversion-patches.mjs'))));
assert.equal(build.pageBorderPatchSha256, hash(await readFile(resolve(repo, 'apps/editor/scripts/integration/page-border-patches.mjs'))));
for (const patch of build.engineBuild.patches) assert.equal(patch.sha256, hash(await readFile(resolve(repo, 'engine/patches', patch.name))));
assert.ok(build.engineBuild.patches.some(p => p.name === 'merged-table-transpose.patch'));
if(pageProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='page-border-inclusion.patch'));
if(regionProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='page-border-region.patch'));
if(deleteProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zzz-page-body-delete.patch'));
if(copyProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zzzz-page-body-copy.patch'));
if(backgroundProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zzzzzzzzzz-agent-page-background.patch'));
if(caretProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zzzzzzzzz-hwpx-body-caret.patch'));
if(emptyProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zzzzzzzz-empty-section-remove.patch'));
if(imagePasteProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zzzzzzz-page-body-image-paste.patch'));
if(styleProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zzzzzz-page-body-style-paste.patch'));
if(paperProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zzzzz-page-body-paper-paste.patch'));
if(lineProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='zz-line-number-settings.patch'));
if(masterProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='master-page-editing.patch'));
if(imageProfile)assert.ok(build.engineBuild.patches.some(p=>p.name==='page-border-z-image.patch'));
assert.deepEqual((await readdir(resolve(repo, 'engine/patches'))).filter(f => f.endsWith('.patch')).sort(), build.engineBuild.patches.map(p => p.name).sort());
const unitPath = resolve(directory, 'unit.txt'), unit = (await readFile(unitPath, 'utf8')).replace(/[ \t]+$/gmu, ''); await writeFile(unitPath, unit);
const count = label => Number(unit.match(new RegExp('^# ' + label + ' (\\d+)$', 'm'))?.[1]); assert.ok(count('tests') >= (agentEmptyProfile?476:splitProfile?466:macroProfile?452:agentMastersProfile?440:backgroundProfile?429:agentSectionsProfile?420:emptyProfile?411:imagePasteProfile?408:styleProfile?407:paperProfile?406:copyProfile?404:deleteProfile?402:lineProfile?400:masterProfile?398:imageProfile?395:regionProfile?386:pageProfile?385:384)); assert.equal(count('pass'), count('tests')); for (const key of ['fail', 'skipped', 'cancelled', 'todo']) assert.equal(count(key), 0);
const boundaries = await json(resolve(directory, 'boundaries.json')); assert.equal(boundaries.ok, true); assert.deepEqual(boundaries.diagnostics, []);
const suites = [['browser/result.json', regionProfile?24:pageProfile?20:18], ['regression-parity/result.json', 66], ['regression-session/result.json', 9], ['basic-text/basic-text-browser.json', 28], ['regression-agent/result.json', 9]];
if(pageProfile)suites.push(['regression-table/result.json',18]);
if(imageProfile)suites.push(['image-browser/result.json',26]);
if(masterProfile)suites.push(['master-browser/result.json',17]);
if(lineProfile)suites.push(['line-browser/result.json',12]);
if(deleteProfile)suites.push(['delete-browser/result.json',11]);
if(copyProfile)suites.push(['copy-browser/result.json',11]);
if(paperProfile)suites.push(['paper-browser/result.json',9]);
if(styleProfile)suites.push(['style-browser/result.json',10]);
if(imagePasteProfile)suites.push(['image-paste-browser/result.json',17]);
if(emptyProfile)suites.push(['empty-browser/result.json',11]);
if(caretProfile)suites.push(['caret-browser/result.json',6]);
if(agentSectionsProfile)suites.push(['section-browser/result.json',10]);
if(backgroundProfile)suites.push(['background-browser/result.json',9]);
if(agentMastersProfile)suites.push(['agent-master-browser/result.json',11]);
if(macroProfile)suites.push(['macro-browser/result.json',10]);
if(splitProfile)suites.push(['split-browser/result.json',12]);
if(agentEmptyProfile)suites.push(['agent-empty-browser/result.json',12]);
if (process.argv.includes('--include-bundle')) suites.push(['bundle-compatibility/result.json', 4]);
const reports = [];
for (const [file, minimum] of suites) {
  const report = await json(resolve(directory, file)); assert.ok(report.results.length >= minimum, file + ': incomplete suite');
  for (const key of ['failures', 'errors', 'pageErrors', 'consoleErrors', 'externalRequests', 'external']) if (report[key] !== undefined) assert.deepEqual(report[key], [], file + ': ' + key);
  for (const key of ['customSourceSha256', 'buildScriptSha256', 'studioPatchSha256', 'engineWasmSha256', 'tableConversionPatchSha256','pageBorderPatchSha256']) assert.equal(report.build[key], build[key], file + ': stale ' + key);
  reports.push({ file, passed: report.results.length, sha256: hash(await readFile(resolve(directory, file))) });
}
const native = await json(resolve(directory, 'native/result.json')); assert.ok(native.results.length >= (regionProfile?55:pageProfile?38:17)); assert.deepEqual(native.failures, []); assert.equal(native.engine.wasmSha256, build.engineWasmSha256);
let nativePassed=native.results.length;
if(imageProfile){const images=await json(resolve(directory,'image-native/result.json'));assert.ok(images.results.length>=35);assert.deepEqual(images.failures,[]);assert.equal(images.engine.wasmSha256,build.engineWasmSha256);nativePassed+=images.results.length;}
if(masterProfile){const masters=await json(resolve(directory,'master-native/result.json'));assert.ok(masters.results.length>=17);assert.deepEqual(masters.failures,[]);assert.equal(masters.engine.wasmSha256,build.engineWasmSha256);nativePassed+=masters.results.length;}
if(lineProfile){const lines=await json(resolve(directory,'line-native/result.json'));assert.ok(lines.results.length>=15);assert.deepEqual(lines.failures,[]);assert.equal(lines.engine.wasmSha256,build.engineWasmSha256);nativePassed+=lines.results.length;}
if(deleteProfile){const deletion=await json(resolve(directory,'delete-native/result.json'));assert.ok(deletion.results.length>=13);assert.deepEqual(deletion.failures,[]);assert.equal(deletion.engine.wasmSha256,build.engineWasmSha256);nativePassed+=deletion.results.length;}
if(copyProfile){const copying=await json(resolve(directory,'copy-native/result.json'));assert.ok(copying.results.length>=16);assert.deepEqual(copying.failures,[]);assert.equal(copying.engine.wasmSha256,build.engineWasmSha256);nativePassed+=copying.results.length;}
if(paperProfile){const papers=await json(resolve(directory,'paper-native/result.json'));assert.ok(papers.results.length>=15);assert.deepEqual(papers.failures,[]);assert.equal(papers.engine.wasmSha256,build.engineWasmSha256);nativePassed+=papers.results.length;}
if(styleProfile){const styles=await json(resolve(directory,'style-native/result.json'));assert.ok(styles.results.length>=19);assert.deepEqual(styles.failures,[]);assert.equal(styles.engine.wasmSha256,build.engineWasmSha256);nativePassed+=styles.results.length;}
if(imagePasteProfile){const images=await json(resolve(directory,'image-paste-native/result.json'));assert.ok(images.results.length>=30);assert.deepEqual(images.failures,[]);assert.equal(images.engine.wasmSha256,build.engineWasmSha256);nativePassed+=images.results.length;}
if(emptyProfile){const empty=await json(resolve(directory,'empty-native/result.json'));assert.ok(empty.results.length>=14);assert.deepEqual(empty.failures,[]);assert.equal(empty.engine.wasmSha256,build.engineWasmSha256);nativePassed+=empty.results.length;}
if(caretProfile){const caret=await json(resolve(directory,'caret-native/result.json'));assert.ok(caret.results.length>=16);assert.deepEqual(caret.failures,[]);assert.equal(caret.engine.wasmSha256,build.engineWasmSha256);nativePassed+=caret.results.length;}
if(backgroundProfile){const background=await json(resolve(directory,'background-native/result.json'));assert.ok(background.results.length>=16);assert.deepEqual(background.failures,[]);assert.equal(background.engine.wasmSha256,build.engineWasmSha256);nativePassed+=background.results.length;}
if(agentMastersProfile){const master=await json(resolve(directory,'agent-master-native/result.json'));assert.ok(master.results.length>=17);assert.deepEqual(master.failures,[]);assert.equal(master.engine.wasmSha256,build.engineWasmSha256);nativePassed+=master.results.length;}
if(macroProfile){const macros=await json(resolve(directory,'macro-native/result.json'));assert.ok(macros.results.length>=9);assert.deepEqual(macros.failures,[]);assert.equal(macros.engine.wasmSha256,build.engineWasmSha256);nativePassed+=macros.results.length;}
if(splitProfile){const split=await json(resolve(directory,'split-native/result.json'));assert.ok(split.results.length>=12);assert.deepEqual(split.failures,[]);assert.equal(split.engine.wasmSha256,build.engineWasmSha256);nativePassed+=split.results.length;}
if(agentEmptyProfile){const empty=await json(resolve(directory,'agent-empty-native/result.json'));assert.ok(empty.results.length>=15);assert.deepEqual(empty.failures,[]);assert.equal(empty.engine.wasmSha256,build.engineWasmSha256);nativePassed+=empty.results.length;}
let providerPassed;
if(agentSectionsProfile){const section=await json(resolve(directory,'section-native/result.json'));assert.ok(section.results.length>=11);assert.deepEqual(section.failures,[]);assert.equal(section.engine.wasmSha256,build.engineWasmSha256);nativePassed+=section.results.length;const provider=(await readFile(resolve(directory,'provider-tests.txt'),'utf8')).replace(/[ \t]+$/gmu,'');await writeFile(resolve(directory,'provider-tests.txt'),provider);const total=Number(provider.match(/^# tests (\d+)$/m)?.[1]);assert.ok(total>=52);assert.match(provider,new RegExp('^# pass '+total+'$','m'));for(const key of ['fail','skipped','cancelled','todo'])assert.match(provider,new RegExp('^# '+key+' 0$','m'));providerPassed=total;}
const summary = { status: 'PASS_SCOPED_AUTOMATED_CHECKS', verifiedAt: new Date().toISOString(), providerPassed, unitPassed: count('pass'), browserPassed: reports.reduce((n, r) => n + r.passed, 0), nativePassed, moduleCount: boundaries.moduleCount, moduleFiles: boundaries.scannedFiles,
  customSourceSha256: build.customSourceSha256, buildScriptSha256: build.buildScriptSha256, wasmSha256: build.engineWasmSha256, engineSourceId: build.engineBuild.sourceId, buildApplicationCommit: build.applicationSourceCommit, buildApplicationDirty: build.applicationSourceDirty, reports,
  limitations: ['Actual Hancom GUI/layout comparison is deferred.', 'No paid LLM request: Agent tests use a deterministic local adapter.', 'Full Hangul feature parity remains incomplete; no percentage of completion is inferred from these scoped tests.', 'Unsupported source properties may be blocked by the stricter cell preservation guard.'] };
if(agentEmptyProfile)summary.limitations.push('Empty body section removal is a standalone command only for a native-supported whole plain document; sole/nonempty/whitespace/complex originals are refused. Removing a section removes its paper/background too; no arbitrary merge, private model token, repeat recording or automatic save.');
if(splitProfile)summary.limitations.push('Agent splitting is a standalone source-section command for one-column editable plain body only; table/field/page-hide/numbered/mixed sources, structural batching and repeat recording are refused. Source inheritance follows the guarded native splitter.');
if(macroProfile)summary.limitations.push('Section repeats require explicit current destinations and revalidate source capabilities; existing table/object/style ID and script recording remain unsupported.');
if(agentMastersProfile)summary.limitations.push('Agent masters support stored basic uniform text only, not pictures/tables/fields/extensions. HWP sparse parity combinations and long originals are refused; deleting a stored master does not suppress earlier inheritance.');
if(backgroundProfile)summary.limitations.push('Agent background commands support none/plain solid originals only. Image, gradient, hatch, alpha, mixed/advanced effects are read-only; parity geometry and original visibility are preserved.');
if(agentSectionsProfile)summary.limitations.push('Agent tools support section default tabs and bounded HWPX line numbering; per-paragraph tabs, binary HWP numbering, external MCP and automatic save remain unsupported.');
if(caretProfile)summary.limitations.push('Native HWPX file caret supports bounded single-section plain body only; multiple sections, nested stories, tabs/fields/objects and native Hancom verification remain deferred.');
if(emptyProfile&&!caretProfile)summary.limitations.push('Native HWPX file caret parsing/serialization is unimplemented; local document/view restoration is separately tested.');
await writeFile(resolve(directory, 'verification-summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
