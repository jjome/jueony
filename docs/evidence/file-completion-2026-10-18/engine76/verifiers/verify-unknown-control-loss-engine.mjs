// A real, parseable, self-authored HWP fixture exercises WASM and the production save guard.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {capturePreservationEvidence, verifyPreservedExport, PreservationError} from '../src/adapters/rhwp/preservation.ts';

for (const name of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_UNKNOWN_FIXTURES', 'JUEONY_TEST_OUTPUT']) {
  assert.ok(isAbsolute(process.env[name] ?? ''), `${name} requires an absolute path`);
}
const pkg = resolve(process.env.JUEONY_ENGINE_PACKAGE);
const fixtures = resolve(process.env.JUEONY_UNKNOWN_FIXTURES);
const out = resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
const engine = json(await readFile(pkg + '/jueony-engine-build.json', 'utf8'));
assert.equal(sha(await readFile(pkg + '/rhwp_bg.wasm')), engine.wasmSha256);
assert.equal(sha(await readFile(pkg + '/rhwp.js')), engine.jsSha256);
const fixtureProof = json(await readFile(fixtures + '/result.json', 'utf8'));
assert.equal(fixtureProof.ownSyntheticOnly, true);
assert.equal(fixtureProof.otherStreamsUnchanged, true);
assert.equal(fixtureProof.recordChanges.length, 1);
assert.equal(fixtureProof.recordChanges[0].changedBytes, 4);
const wasm = await import(pathToFileURL(pkg + '/rhwp.js'));
await wasm.default({module_or_path: await readFile(pkg + '/rhwp_bg.wasm')});
const results = [];
for (const kind of ['known', 'unknown']) {
  const input = await readFile(`${fixtures}/${kind}-own-table.hwp`);
  assert.equal(sha(input), fixtureProof[`${kind}Sha256`]);
  const doc = new wasm.HwpDocument(input);
  try {
    const before = capturePreservationEvidence(doc);
    const beforeBytes = sha(doc.exportHwp());
    const beforeEvents = doc.getEventLog();
    const artifact = doc.exportHwpxWithReport();
    try {
      const bytes = artifact.takeBytes();
      const loss = json(artifact.contentLoss());
      if (kind === 'known') {
        assert.equal(loss.count, 0, 'Supported table must not receive an Unknown loss');
        const report = verifyPreservedExport(doc, bytes, 'hwpx', loss, data => new wasm.HwpDocument(data));
        assert.equal(report.status, 'checked');
        results.push({kind, inputSha256: sha(input), outputSha256: sha(bytes), loss, report});
      } else {
        assert.deepEqual(loss, fixtureProof.report, 'Actual WASM reports the exact omitted control owner');
        let caught;
        try { verifyPreservedExport(doc, bytes, 'hwpx', loss, data => new wasm.HwpDocument(data)); }
        catch (error) { caught = error; }
        assert.ok(caught instanceof PreservationError, 'Production save guard rejects lossy conversion');
        assert.ok(caught.report.issues.some(issue => issue.code === 'content-loss' && issue.path === 'serializer-report'));
        results.push({kind, inputSha256: sha(input), outputSha256: sha(bytes), loss, blocked: caught.report});
      }
    } finally { artifact.free(); }
    assert.deepEqual(capturePreservationEvidence(doc), before, 'Save validation does not mutate the source model');
    assert.equal(sha(doc.exportHwp()), beforeBytes, 'HWP source export stays byte-identical');
    assert.equal(doc.getEventLog(), beforeEvents, 'Save validation creates no edit event');
    assert.equal(sha(await readFile(`${fixtures}/${kind}-own-table.hwp`)), sha(input), 'Fixture on disk stays unchanged');
  } finally { doc.free(); }
}
await writeFile(out + '/result.json', JSON.stringify({
  engine, verifierSha256: sha(await readFile(new URL(import.meta.url))),
  fixtureProofSha256: sha(await readFile(fixtures + '/result.json')), results,
  scope: 'Real WASM parsing/serialization and the production preservation guard, self-authored HWP bytes. Does not simulate or prove an OS save dialog or Hancom rendering.'
}, null, 2));
console.log('PASS known control strict save, exact Unknown loss, production rejection, source/event/disk immutability');
