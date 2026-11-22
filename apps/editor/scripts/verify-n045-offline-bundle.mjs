import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { auditN045OfflineBundle, classifyN045OfflineFailure, compileN045EndpointAllowlist, inventoryN045NetworkLiterals } from './lib/n045-offline-contract.mjs';

const root = process.env.JUEONY_OFFLINE_DIST;
assert.ok(root && isAbsolute(root), 'JUEONY_OFFLINE_DIST absolute path required');
const policyPath = process.env.JUEONY_OFFLINE_POLICY ?? resolve(import.meta.dirname, '../tests/fixtures/n045-offline-policy/manifest.json');
assert.ok(isAbsolute(policyPath), 'JUEONY_OFFLINE_POLICY must be absolute');
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const authorize = compileN045EndpointAllowlist([]);
assert.equal(authorize('https://example.invalid/v1'), false, 'empty institutional allowlist must reject every endpoint');
let report, failure;
try { report = await auditN045OfflineBundle(root, policy); } catch (error) { failure = classifyN045OfflineFailure(error); }
const result = report ? { ...report } : { schemaVersion: 1, policyId: policy.policyId, status: 'FAIL_OFFLINE_BUNDLE', failure };
if(failure){
  try{result.networkInventory=await inventoryN045NetworkLiterals(root,policy);}
  catch(error){result.inventoryFailure=classifyN045OfflineFailure(error);}
}
result.endpointPolicy = { configuredEntries: 0, defaultExternalRequestAllowed: false };
result.limitations = [
  '정적 번들 자산과 WebView2 고정 버전 오프라인 artifact manifest를 검사한 결과이며, 최종 설치본의 실제 런타임 로딩과 운영체제 전체 트래픽 계측은 아니다.',
  '기관 endpoint allowlist는 비어 있어 외부 요청을 기본 거절한다. 실제 기관 주소는 배포 승인 뒤 별도 주입해야 한다.',
  'WebView2 artifact·license·notice는 로컬 상대경로와 정확한 SHA-256으로 확인하지만 최종 설치 패키지 서명과 기관 배포 승인 여부는 이 검사 범위 밖이다.',
];
const output = process.env.JUEONY_OFFLINE_OUTPUT;
if (output) {
  assert.ok(isAbsolute(output), 'JUEONY_OFFLINE_OUTPUT must be absolute');
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify(result, null, 2));
if (failure) process.exitCode = 1;
