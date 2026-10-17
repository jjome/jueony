from pathlib import Path
import json,hashlib,shutil,gzip
r=Path(__file__).resolve().parents[2];o=r/'build/table-origin-closure77';sha=lambda b:hashlib.sha256(b).hexdigest()
p=o/'completed-breakable-frame77.patch';proof=json.loads((o/'candidate-proof.json').read_text(encoding='utf-8'))
counts=[]
for n,count in [('native-final-origin77.log',8),('native-actual11.log',11),('native-mcst-v5.log',2)]:
 text=(o/n).read_text(encoding='utf-8');assert f'{count} passed; 0 failed; 0 ignored' in text;counts.append({'log':n,'passed':count,'ignored':0,'sha256':sha((o/n).read_bytes())})
ex=json.loads((o/'candidate/exclusion-results.json').read_text(encoding='utf-8'));assert len(ex)==11 and all(c['geometryDifferences']==0 and c['modelSame']for c in ex)
partial=json.loads((o/'candidate/partial-negative-result.json').read_text(encoding='utf-8'));assert partial['fullGeometryDifferences']==[]
before=json.loads((o/'baseline/observations.json').read_text(encoding='utf-8'));after=json.loads((o/'candidate/observations.json').read_text(encoding='utf-8'))
extract=lambda x:[{'policy':n['policy'],'geometryDifferences':len(n['differences']),'sourceUnchanged':n['sourceUnchanged']}for n in x]
scope={'patchSHA256':sha(p.read_bytes()),'sourceProof':proof,'tests':counts,'passedNativeTests':21,'strictFullGeometryReopens':112,'counts':{'ownTablePolicyAndHistory':20,'actual11TwoSourcesTwoFormatsTwoCycles':88,'MCSTHWPXCurrentAndHistory':4,'negativeCasesUnchanged':11,'actualPartialFragmentCase':1},'before':extract(before),'after':extract(after),'negativeResults':ex,'partialResult':partial,'failureHistory':['native-baseline77-harness-compile-failed.log','failed-v1/native-candidate77.log','failed-v2/native-candidate77.log','native-trace77.log','native-trace77-existing-diagnostics.log'],'contract':'No source/model/serializer changes. Existing None guard preserved verbatim. Only a bounded plain complete-grid whole breakable frame whose source first-line advance and actual current consumed height match the existing HeightMeasurer + table::format queries may reject a cached successor origin inside that painted frame. Numeric geometry tolerance remains0.2.','limitations':['Formal WASM/public guard/fresh browser integration still required by root.','Actual Hancom HWPX absolute first/second top157.4/218.9 versus this own live153.6/223.1 remain a separate native interpretation difference, not claimed corrected.','Nested large-after runtime negative uses default Center cell vertical alignment; controls exclusion is independent of that alignment. It does not by itself exercise the transparent Top-wrapper measurement shortcut.','No expansion of partial-table/merged/protected/explicit-offset support. Existing unsupported behavior is retained, not reported as saved successfully.']}
(o/'handoff-final-v3.json').write_text(json.dumps(scope,indent=2,ensure_ascii=False),encoding='utf-8')
out=o/'compact-staging';out.mkdir(exist_ok=True)
names=['handoff-final-v3.json','candidate-proof.json','completed-breakable-frame77.patch','native-baseline77-harness-compile-failed.log','native-baseline77.log','native-candidate77-interrupted.log','native-final-origin77.log','native-actual11.log','native-mcst-v5.log','native-trace77-existing-diagnostics.log','partial-negative.hwp','partial-negative-baseline77.json','candidate/partial-negative-result.json','candidate/exclusion-results.json','source-candidate77/tests/jueony_table_origin.rs','source-candidate77/tests/jueony_actual11.rs','source-candidate77/tests/jueony_mcst_hwpx.rs','verify-completed-breakable-frame-engine.mjs','prepare-partial-negative.mjs','finalize-proof.py','package-handoff.py','run-final-origin.sh','resume-candidate.sh']
for name in names:
 q=out/name;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(o/name,q)
for sub in['failed-v1','failed-v2']:
 for name in ['native-candidate77.log','candidate-proof.json','completed-breakable-frame77.patch']:
  q=out/sub/name;q.parent.mkdir(exist_ok=True,parents=True);shutil.copyfile(o/sub/name,q)
for label in ['cell-break-whole','row-break-whole','history-cell-break','none-whole','default-whole']:
 for suffix in ['-1.hwp','-1.hwpx','-result.json']:
  src=o/'candidate'/(label+suffix)
  if src.is_file():q=out/'own-artifacts'/src.name;q.parent.mkdir(exist_ok=True);shutil.copyfile(src,q)
for name in ['runtime-manifest.json','native-trace77.log','baseline/observations.json','candidate/observations.json']:
 q=out/(name.replace('/','-')+'.gz');q.write_bytes(gzip.compress((o/name).read_bytes(),mtime=0))
manifest={'scope':'Self-owned test documents and compact results only. Public MCST document, Hancom external source bytes, fonts, vendor binaries, WASM and full source copies excluded. Actual11 oracle inputs remain immutable at original referenced paths.','files':[{'path':p.relative_to(out).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}for p in sorted(out.rglob('*'))if p.is_file()and p.name!='manifest.json']}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print(len(manifest['files']),sha((out/'manifest.json').read_bytes()))
