import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReviewEngine, snapshot, compareSnapshots, hash} from './lib/hancom-review.mjs';
import {verifyPreservedExport, PreservationError} from '../src/adapters/rhwp/preservation.ts';

for (const key of ['JUEONY_ENGINE_PACKAGE', 'JUEONY_REPOSITORY', 'JUEONY_TEST_OUTPUT']) {
  assert.ok(isAbsolute(process.env[key] ?? ''), `${key} requires an absolute path`);
}
const root = resolve(process.env.JUEONY_REPOSITORY);
const out = resolve(process.env.JUEONY_TEST_OUTPUT);
await mkdir(out, {recursive: true});
const inputPath = join(root, 'build/hancom-final-file-review-20261017/mcst-bid-2026-hwpx-hancom.hwpx');
const input = await readFile(inputPath);
const inputSha256 = hash(input);
assert.equal(inputSha256, '20a3960b4315626c3f97d9c5d47746e3cfadd8fe50dde43a4a424aa3a2a76936',
  'The independently Hancom-saved public fixture must remain immutable');
const engine = await loadReviewEngine(process.env.JUEONY_ENGINE_PACKAGE);
const results = [], failures = [], fontRuns = [];
const expectedFamily = 'HY중고딕,한컴바탕';
let source, reopened, artifact, outputSha256, outputBytes, lossCount, preservation, wholeDocument;
let sourceUnchanged = false, inputUnchanged = false;

// Identify a physical run by its root paragraph owner, never by a page/run index.
// Only font metadata is returned or written; text and complete snapshots stay in memory.
function ownedRun(state, charStart) {
  const matches = [];
  for (const page of state.layout) {
    for (const run of page.text.runs) {
      if (run.secIdx === 0 && run.paraIdx === 94 && run.charStart === charStart
          && run.parentParaIdx === undefined && run.cellIdx === undefined) {
        matches.push({page: page.page, section: 0, paragraph: 94, charStart,
          fontFamily: run.fontFamily, fontSize: run.fontSize});
      }
    }
  }
  assert.equal(matches.length, 1, `Expected one root font run at section0/paragraph94/charStart${charStart}`);
  return matches[0];
}

try {
  source = new engine.HwpDocument(input);
  const before = snapshot(source);
  const eventLog = source.getEventLog();
  artifact = source.exportHwpWithReport();
  const bytes = artifact.takeBytes();
  const loss = JSON.parse(artifact.contentLoss());
  outputSha256 = hash(bytes);
  outputBytes = bytes.length;
  lossCount = loss.count;
  reopened = new engine.HwpDocument(bytes);
  const after = snapshot(reopened);
  const comparison = compareSnapshots(before, after);
  wholeDocument = {
    status: comparison.status,
    pages: comparison.pages,
    geometryDifferences: comparison.geometry.count,
    geometryTolerance: comparison.geometry.tolerance,
    semanticDifferences: comparison.semantic.count,
    readIssues: {before: comparison.semantic.readIssues.before.length,
      after: comparison.semantic.readIssues.after.length},
  };

  // The existing whole-document guard receives the complete, unmodified loss
  // report. A successful three-font check never authorizes a damaged conversion.
  try {
    const checked = verifyPreservedExport(source, bytes, 'hwp', loss,
      data => new engine.HwpDocument(data));
    assert.equal(checked.status, 'checked');
    preservation = {status: 'checked', issueCount: 0};
  } catch (error) {
    if (!(error instanceof PreservationError)) throw error;
    assert.equal(error.report.status, 'blocked');
    preservation = {status: 'blocked', issueCount: error.report.issues.length,
      issues: error.report.issues.map(({code, path}) => ({code, path}))};
  }
  if (preservation.status === 'checked') {
    assert.equal(comparison.status, 'SAME_WITHIN_PUBLISHED_CONTRACT');
    assert.equal(lossCount, 0);
  }
  if (comparison.status !== 'SAME_WITHIN_PUBLISHED_CONTRACT' || lossCount !== 0) {
    assert.equal(preservation.status, 'blocked', 'Whole-document damage must remain blocked');
  }

  for (const charStart of [0, 4, 6]) {
    const name = `Declared fallback survives HWP storage at root0/94/${charStart}`;
    try {
      const a = ownedRun(before, charStart), b = ownedRun(after, charStart);
      fontRuns.push({charStart, before: a, after: b, exactFamilyEqual: a.fontFamily === b.fontFamily});
      assert.equal(a.fontFamily, expectedFamily, 'Pinned source must expose the declared fallback');
      assert.equal(b.fontFamily, a.fontFamily, 'Published family must survive exactly');
      assert.equal(b.fontSize, a.fontSize, 'Font size must not change');
      results.push(name);
      console.log('PASS', name);
    } catch (error) {
      failures.push({name, error: String(error)});
      console.error('FAIL', name);
    }
  }

  // Check every source field and edit event again after export and all guard opens.
  const unchanged = compareSnapshots(before, snapshot(source));
  assert.equal(unchanged.status, 'SAME_WITHIN_PUBLISHED_CONTRACT');
  assert.equal(source.getEventLog(), eventLog);
  sourceUnchanged = true;
} catch (error) {
  // Avoid serializing an error report that might contain public document values.
  failures.push({name: 'Export, source immutability and unchanged preservation guard',
    errorType: error?.name ?? 'Error'});
  console.error('FAIL export or invariant', error?.name ?? 'Error');
} finally {
  reopened?.free();
  artifact?.free();
  source?.free();
  inputUnchanged = hash(await readFile(inputPath)) === inputSha256;
  if (!inputUnchanged) failures.push({name: 'Public original bytes stay immutable', errorType: 'HashMismatch'});
}

const fontScopePassed = results.length === 3 && failures.length === 0;
await writeFile(join(out, 'result.json'), JSON.stringify({
  engine: engine.metadata,
  verifierSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  status: fontScopePassed
    ? (preservation?.status === 'checked' ? 'FONT_SCOPE_PASS_AND_CONVERSION_CHECKED'
      : 'FONT_SCOPE_PASS_FULL_CONVERSION_BLOCKED') : 'FONT_SCOPE_FAIL',
  results, failures, fontRuns, inputSha256, outputSha256, outputBytes, lossCount,
  sourceUnchanged, inputUnchanged, wholeDocument, preservation,
  scope: 'Exactly three public font-family declarations through real HWP storage. Every full semantic and layout field is compared in memory through the unchanged helper and production guard. No body, snapshots, input copy, converted document or font program is written.',
  limitation: 'A font-scope PASS does not close MCST cross-format layout or imply Hancom screen/print equality. Overall geometry counts, page counts and blocked conversion status remain separate.',
}, null, 2));
if (!fontScopePassed) process.exitCode = 1;
