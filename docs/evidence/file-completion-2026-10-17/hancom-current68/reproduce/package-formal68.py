from pathlib import Path
import json,hashlib,shutil
here=Path(__file__).resolve().parent;repo=here.parents[1];out=here/'permanent-staging/formal68';assert not out.exists()
out.mkdir(parents=True)
def copy(src,dest):
 target=out/dest;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,target)
result=json.loads((here/'independent-oracle68.json').read_text(encoding='utf8'))
assert len(result['observations'])==11 and len(result['results'])==8 and len(result['failures'])==3
for r in result['observations']:
 name=r['name'];source=Path(r['original']['path']);actual=Path(r['hancom']['path'])
 for p,sha in[(source,r['original']['sha256']),(actual,r['hancom']['sha256'])]:assert hashlib.sha256(p.read_bytes()).hexdigest()==sha,p
 copy(source,'original/'+name);copy(actual,'hancom/'+name)
compact=[]
for r in result['observations']:
 compact.append({k:r[k]for k in['name','original','hancom','geometryDifferences','semanticDifferences','independentRawSummary','rawSummaryDifferences','resaves']if k in r}|{'originalLayoutSha256':hashlib.sha256(json.dumps(r['beforeLayout'],ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),'hancomLayoutSha256':hashlib.sha256(json.dumps(r['afterLayout'],ensure_ascii=False,separators=(',',':')).encode()).hexdigest()})
(out/'actual11-formal68.json').write_text(json.dumps({'engine':result['engine'],'results':result['results'],'failures':result['failures'],'observations':compact,'scope':result['scope']},ensure_ascii=False,indent=2),encoding='utf8')
copy(here/'independent-oracle68.json','independent-full-geometry-oracle68.json')
copy(here/'raw-summary-oracle.json','raw-summary-oracle41.json')
copy(here/'conversion16/result.json','conversion16-formal68.json')
copy(here/'original-comparison/result.json','history/old-cached-input-comparison-formal68.json')
for name in['caption-saved.png','positive-saved.png','negative-saved.png']:copy(here/'hancom-current'/name,'hancom/'+name)
for name in['compare-current.mjs','inspect-pairs.mjs','generate-final-inputs.mjs','probe-support.mjs','raw-summary-oracle.py','package-formal68.py']:copy(here/name,'reproduce/'+name)
copy(repo/'build/document-metadata-candidate/table-fixture-summary-oracle.py','reproduce/independent-propertyset-opf-reader.py')
copy(repo/'apps/editor/scripts/lib/hwp-summary-evidence.mjs','reproduce/hwp-summary-evidence.mjs')
copy(repo/'apps/editor/scripts/verify-hancom-overlap-roundtrip.mjs','history/unchanged-old-verifier.mjs')
copy(repo/'build/rhwp-engine/source-cda65172283c6657/pkg/jueony-engine-build.json','engine-build.json')
readme='''# Formal68 independent Hancom overlap review

The 11 self-authored original documents and 11 separate Hancom 2024 GUI SaveAs files are immutable copies. Their original paths and SHA-256 are in actual11-formal68.json. The same result retains all semantic differences (including summary five fields), all public layout fields with the unchanged 0.2 maximum, raw PropertySet summary evidence and both-format guarded re-save results. The complete published geometry oracle is preserved separately; no new candidate is used for these observations.

Result: eight actual pairs pass; positive-offset, negative-offset and two-column cases fail geometry, with semantic differences zero. The two-column/negative cases show that the old Native-HWP fallback lacks 283HU top inset; their current HWPX coordinate agrees with Hancom. No claim of full N001 completion is made. The offset case has a separate duplicate top inset in its visible edge.

G105's current multiline and caption outputs pass full actual semantics/layout and both-format re-save. The current positive bare-cache case also passes. Historical source caches retain 160 versus Hancom158 line starts and source declared-height differences; those failed observations are preserved under history. Reversible text editing followed by the existing real content-height command produces the current independently verified outputs, but this is not proof that arbitrary old stored row partitions may be silently discarded. Such source ownership remains N001 scope.

G090 two/three and G096 plain/Unicode/superscript each pass full actual comparison. Explicit offset remains a failing case until the follow-up engine candidate is formally integrated and reverified. This package does not normalize external metadata or waive unknown owners. Candidate v1/v2 failed histories and all private source experiments remain outside this package in ignored build/file-closure69-overlap.

Reproduction scripts retain their original repository-relative imports and recorded source paths. Run originals from the repository root; copied scripts and their hashes identify exactly what ran. Font files, WASM, SDK binaries, public corpora and user documents are excluded. Three screenshots were recorded by the parent through actual Hancom UI; Native measurement is not a pixel-comparison claim.
'''
(out/'README.md').write_text(readme,encoding='utf8')
files=[]
for p in sorted(out.rglob('*')):
 if p.is_file():files.append({'path':p.relative_to(out).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
manifest={'files':files,'fileCount':len(files),'payloadBytes':sum(x['bytes']for x in files),'scope':'Formal68 observations only; independent actual11 = 8PASS/3FAIL, Native conversion16=16PASS; no candidate completion claim.'}
(out/'SHA256-MANIFEST.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps({'path':str(out),'files':len(files),'bytes':manifest['payloadBytes'],'manifestSha256':hashlib.sha256((out/'SHA256-MANIFEST.json').read_bytes()).hexdigest()}))
