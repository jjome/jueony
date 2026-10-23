import {patchExportMetadataLoss} from './integration/export-metadata-loss-patches.mjs';
import {applyStudioPatches} from './integration/studio-patches.mjs';
import {applyAgentBoundSavePatches} from './integration/agent-bound-save-patches.mjs';
import {applyManualFeaturePatches} from './integration/manual-feature-patches.mjs';
import {applyRecoveryPatches} from './integration/recovery-patches.mjs';
import {applyTabFeaturePatches} from './integration/tab-feature-patches.mjs';
import {applySectionBoundaryPatches} from './integration/section-boundary-patches.mjs';
import {applyDocumentInsertionPatches} from './integration/document-insertion-patches.mjs';
import {applyStyleManagementPatches} from './integration/style-management-patches.mjs';
import {applyStyleFlowPatches} from './integration/style-flow-patches.mjs';
import {applyTableConversionPatches} from './integration/table-conversion-patches.mjs';
import {applyPageBorderPatches} from './integration/page-border-patches.mjs';
import {applySelectedObjectPropertiesPatches} from './integration/selected-object-properties-patches.mjs';
import {applyFormattingToolbarPatches} from './integration/formatting-toolbar-patches.mjs';
import {applyDocumentTabCyclePatches} from './integration/document-tab-cycle-patches.mjs';
import {applyKeyboardContextPatches} from './integration/keyboard-context-patches.mjs';
import {applyDocumentSwapStatePatches} from './integration/document-swap-state-patches.mjs';
import {applyDocumentCreatedInformationPatches} from './integration/document-created-information-patches.mjs';
import {applyDocumentHistoryPatches} from './integration/document-history-patches.mjs';
import {applyBasicFindPatches} from './integration/basic-find-patches.mjs';
import {applyFormatCopyTransactionPatches} from './integration/format-copy-transaction-patches.mjs';
import {applySafeObjectCutPatches} from './integration/safe-object-cut-patches.mjs';
import {applyFontSetPreferencesPatches} from './integration/font-set-preferences-patches.mjs';
import {applyWordBoundaryPatches} from './integration/word-boundary-patches.mjs';
import {applyClipboardEventPatches} from './integration/clipboard-event-patches.mjs';
import {applyCellWordDeletionPatches} from './integration/cell-word-deletion-patches.mjs';
import {applyPasteFailurePatches} from './integration/paste-failure-patches.mjs';
import {applyFormatDialogTargetPatches} from './integration/format-dialog-target-patches.mjs';
import {applyFormulaFormatPatches} from './integration/formula-format-patches.mjs';
import {applyTableSizeTargetPatches} from './integration/table-size-target-patches.mjs';
import {auditRepository} from '../../../scripts/check-module-boundaries.mjs';
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(app, '../..');
const boundaries=await auditRepository(projectRoot);
if(!boundaries.ok)throw new Error('Module boundary violations: '+JSON.stringify(boundaries.diagnostics));
const licenseText = await readFile(join(projectRoot, 'LICENSE.txt'), 'utf8');
if (licenseText !== await readFile(join(app, 'LICENSE.txt'), 'utf8')) {
  throw new Error('루트와 앱의 LICENSE.txt가 다릅니다. 같은 약관 원문으로 동기화해 주세요.');
}
const upstream = resolve(app, '../../upstream/rhwp-source');
const expectedCommit = '1a76570e833917d15817415a53c09ad61ab3203f';
const sha256 = data => createHash('sha256').update(data).digest('hex');
const engineRoot = process.env.JUEONY_ENGINE_PACKAGE ? resolve(projectRoot, process.env.JUEONY_ENGINE_PACKAGE) : join(app, 'node_modules/@rhwp/core');
let engineEvidence;
if (process.env.JUEONY_ENGINE_PACKAGE) {
  engineEvidence = JSON.parse(await readFile(join(engineRoot, 'jueony-engine-build.json'), 'utf8'));
  if (engineEvidence.baseCommit !== expectedCommit ||
      engineEvidence.wasmSha256 !== sha256(await readFile(join(engineRoot, 'rhwp_bg.wasm'))) ||
      engineEvidence.jsSha256 !== sha256(await readFile(join(engineRoot, 'rhwp.js')))) throw new Error('Local engine provenance mismatch');
  for (const patch of engineEvidence.patches) {
    if (!/^[a-z0-9-]+\.patch$/.test(patch.name) || patch.sha256 !== sha256(await readFile(join(projectRoot, 'engine/patches', patch.name)))) throw new Error('Local engine patches changed; rebuild WASM first');
  }
  const currentPatches=(await readdir(join(projectRoot,'engine/patches'))).filter(name=>name.endsWith('.patch')).sort();
  if(JSON.stringify(currentPatches)!==JSON.stringify(engineEvidence.patches.map(p=>p.name).sort()))throw new Error('Local engine patch set changed; rebuild WASM first');
}
const commit = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== expectedCommit) throw new Error(`참조 커밋이 다릅니다: ${commit}`);
const sourceChanges = execFileSync('git', ['-C', upstream, 'status', '--porcelain', '--untracked-files=all', '--',
  'rhwp-studio', 'assets/fonts', 'npm/hwpctrl-ocx', 'LICENSE', 'THIRD_PARTY_LICENSES.md'], { encoding: 'utf8' }).trim();
if (sourceChanges) throw new Error('참조 소스에 변경이 있습니다. 기준 커밋과 같은 소스로 빌드해 주세요.');
const profile = process.env.JUEONY_BUILD_PROFILE ?? '';
if (profile && !/^[a-z][a-z0-9-]{0,30}$/.test(profile)) throw new Error('Invalid build profile');
const root = join(app, '.build', profile ? `studio-${profile}` : 'studio');
const outputDir = profile ? join(app, 'evidence', `dist-${profile}`) : join(app, 'dist');
await mkdir(root, { recursive: true });
await cp(join(upstream, 'rhwp-studio/src'), join(root, 'src'), { recursive: true });
await cp(join(upstream, 'rhwp-studio/types'), join(root, 'types'), { recursive: true });
const tsconfig = JSON.parse(await readFile(join(upstream, 'rhwp-studio/tsconfig.json'), 'utf8'));
tsconfig.compilerOptions.paths['@wasm/*'] = [engineRoot.replaceAll('\\', '/') + '/*'];
await writeFile(join(root, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
// Windows Git 체크아웃의 fonts 항목은 심볼릭 링크 대신 텍스트 파일일 수 있다.
await mkdir(join(root, 'public'), { recursive: true });
for (const entry of await readdir(join(upstream, 'rhwp-studio/public'))) {
  if (entry === 'fonts' || entry.startsWith('rhwp')) continue;
  await cp(join(upstream, 'rhwp-studio/public', entry), join(root, 'public', entry), { recursive: true });
}
for (const name of ['LICENSE.txt', 'THIRD_PARTY_NOTICES.md']) {
  await cp(join(projectRoot, name), join(root, 'public', name));
}
await cp(join(upstream, 'assets/fonts'), join(root, 'public/fonts'), { recursive: true });
await cp(join(app, 'src'), join(root, 'src/jueony'), { recursive: true });
await cp(join(app, 'src/boot.js'), join(root, 'public/jueony-boot.js'));
await cp(join(upstream, 'LICENSE'), join(root, 'public/LICENSE.rhwp.txt'));
await cp(join(upstream, 'THIRD_PARTY_LICENSES.md'), join(root, 'public/THIRD_PARTY_LICENSES.rhwp.md'));
await mkdir(join(root, 'public/licenses'), { recursive: true });
for (const [name, file] of [['canvaskit-wasm', 'LICENSE'], ['@noble/hashes', 'LICENSE'], ['@rhwp/core', 'LICENSE']]) {
  await cp(join(app, 'node_modules', name, file), join(root, 'public/licenses', name.replaceAll('/', '-') + '.txt'));
}

await applyStudioPatches({root,upstream,app});
await applyAgentBoundSavePatches({root});
await writeFile(join(root,'src/core/export-content-loss.ts'),patchExportMetadataLoss(await readFile(join(root,'src/core/export-content-loss.ts'),'utf8')));
await applyManualFeaturePatches({root});
await applyPageBorderPatches({root});
await applyRecoveryPatches({root});
// These dialogs require the patched engine's section-aware tab layout.
if (engineEvidence) await applyTabFeaturePatches({root});
if (engineEvidence) await applySectionBoundaryPatches({root});
if (engineEvidence?.patches.some(p => p.name === 'document-insertion.patch')) await applyDocumentInsertionPatches({root});
if (engineEvidence?.patches.some(p => p.name === 'style-reference-deletion.patch')) await applyStyleManagementPatches({root,orderEnabled:engineEvidence.patches.some(p=>p.name==='style-reference-order.patch')});
await applyStyleFlowPatches({root});
await applyTableConversionPatches({root});
await applySelectedObjectPropertiesPatches({root});
await applyFormattingToolbarPatches({root});
await applyDocumentTabCyclePatches({root});
await applyKeyboardContextPatches({root});
await applyDocumentSwapStatePatches({root});
await applyDocumentHistoryPatches({root});
await applyBasicFindPatches({root});
await applyFormatCopyTransactionPatches({root});
await applySafeObjectCutPatches({root});
await applyFontSetPreferencesPatches({root});
await applyFormatDialogTargetPatches({root});
await applyTableSizeTargetPatches({root});
await applyFormulaFormatPatches({root});
await applyWordBoundaryPatches({root});
await applyClipboardEventPatches({root});
await applyCellWordDeletionPatches({root});
await applyPasteFailurePatches({root});
await applyDocumentCreatedInformationPatches({root});
await build({
  configFile: false, root, base: './', publicDir: join(root, 'public'),
  define: { __APP_VERSION__: JSON.stringify('0.8.7'), __RHWP_DISABLE_EXTERNAL_WEBFONTS__: 'true', __RHWP_HWPCTRL__: 'false' },
  resolve: { alias: {
    '@': join(root, 'src'),
    '@wasm/rhwp.js': join(engineRoot, 'rhwp.js'),
    '@wasm': engineRoot,
    '@rhwp/hwpctrl/studio-plugin': join(upstream, 'npm/hwpctrl-ocx/src/studio-plugin.mjs'),
  } },
  build: { outDir: outputDir, emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 3000,
    rolldownOptions: { input: { index: join(root, 'index.html'), editor: join(root, 'editor.html') } },
  },
});
const customSource = [];
async function collectSource(directory, prefix = '') {
 for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
  const name = prefix + entry.name;
  if (entry.isDirectory()) await collectSource(join(directory, entry.name), name + '/');
  else customSource.push(name, await readFile(join(directory, entry.name), 'utf8'));
 }
}
await collectSource(join(app, 'src'));
const evidence = {
  applicationId: 'jueony-editor',
  sourceCommit: commit, enginePackage: engineEvidence ? '@jueony/rhwp-engine-review@0.8.7' : '@rhwp/core@0.8.7', builtAt: new Date().toISOString(),
  engineWasmSha256: sha256(await readFile(join(engineRoot, 'rhwp_bg.wasm'))),
  engineBuild: engineEvidence ?? null,
  buildScriptSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  studioPatchSha256: sha256(await readFile(join(app,'scripts/integration/studio-patches.mjs'))),
  agentBoundSavePatchSha256: sha256(await readFile(join(app,'scripts/integration/agent-bound-save-patches.mjs'))),
  featurePatchSha256: sha256(await readFile(join(app,'scripts/integration/manual-feature-patches.mjs'))),
  recoveryPatchSha256: sha256(await readFile(join(app,'scripts/integration/recovery-patches.mjs'))),
  tabFeaturePatchSha256: sha256(await readFile(join(app,'scripts/integration/tab-feature-patches.mjs'))),
  sectionBoundaryPatchSha256: sha256(await readFile(join(app,'scripts/integration/section-boundary-patches.mjs'))),
  documentInsertionPatchSha256: sha256(await readFile(join(app,'scripts/integration/document-insertion-patches.mjs'))),
  styleManagementPatchSha256: sha256(await readFile(join(app,'scripts/integration/style-management-patches.mjs'))),
  styleFlowPatchSha256: sha256(await readFile(join(app,'scripts/integration/style-flow-patches.mjs'))),
  tableConversionPatchSha256: sha256(await readFile(join(app,'scripts/integration/table-conversion-patches.mjs'))),
  pageBorderPatchSha256: sha256(await readFile(join(app,'scripts/integration/page-border-patches.mjs'))),
  selectedObjectPropertiesPatchSha256: sha256(await readFile(join(app,'scripts/integration/selected-object-properties-patches.mjs'))),
  formattingToolbarPatchSha256: sha256(await readFile(join(app,'scripts/integration/formatting-toolbar-patches.mjs'))),
  documentTabCyclePatchSha256: sha256(await readFile(join(app,'scripts/integration/document-tab-cycle-patches.mjs'))),
  keyboardContextPatchSha256: sha256(await readFile(join(app,'scripts/integration/keyboard-context-patches.mjs'))),
  documentSwapStatePatchSha256: sha256(await readFile(join(app,'scripts/integration/document-swap-state-patches.mjs'))),
  documentCreatedInformationPatchSha256: sha256(await readFile(join(app,'scripts/integration/document-created-information-patches.mjs'))),
  documentHistoryPatchSha256: sha256(await readFile(join(app,'scripts/integration/document-history-patches.mjs'))),
  basicFindPatchSha256: sha256(await readFile(join(app,'scripts/integration/basic-find-patches.mjs'))),
  formatCopyTransactionPatchSha256: sha256(await readFile(join(app,'scripts/integration/format-copy-transaction-patches.mjs'))),
  safeObjectCutPatchSha256: sha256(await readFile(join(app,'scripts/integration/safe-object-cut-patches.mjs'))),
  exportMetadataLossPatchSha256: sha256(await readFile(join(app,'scripts/integration/export-metadata-loss-patches.mjs'))),
  fontSetPreferencesPatchSha256: sha256(await readFile(join(app,'scripts/integration/font-set-preferences-patches.mjs'))),
  wordBoundaryPatchSha256: sha256(await readFile(join(app,'scripts/integration/word-boundary-patches.mjs'))),
  clipboardEventPatchSha256: sha256(await readFile(join(app,'scripts/integration/clipboard-event-patches.mjs'))),
  cellWordDeletionPatchSha256: sha256(await readFile(join(app,'scripts/integration/cell-word-deletion-patches.mjs'))),
  pasteFailurePatchSha256: sha256(await readFile(join(app,'scripts/integration/paste-failure-patches.mjs'))),
  formatDialogTargetPatchSha256: sha256(await readFile(join(app,'scripts/integration/format-dialog-target-patches.mjs'))),
  formulaformatPatchSha256: sha256(await readFile(join(app,'scripts/integration/formula-format-patches.mjs'))),
  tablesizetargetPatchSha256: sha256(await readFile(join(app,'scripts/integration/table-size-target-patches.mjs'))),
  customSourceSha256: sha256(customSource.join('\n')),
  applicationSourceCommit: execFileSync('git', ['-C', app, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  applicationSourceDirty: Boolean(execFileSync('git', ['-C', app, 'status', '--porcelain', '--', '.'], { encoding: 'utf8' }).trim()),
  sourceBuild: Boolean(engineEvidence), note: engineEvidence ? '고정 rhwp 소스와 추적 패치를 직접 빌드한 검수용 WASM. 최적화 및 한컴 출력 비교 상태는 engineBuild와 검증 보고서 참조.' : 'Rust 엔진은 공식 npm WASM 바이너리 사용. 이 빌드에서 Rust 엔진을 재컴파일하지 않음.',
};
await writeFile(join(outputDir, 'build-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
