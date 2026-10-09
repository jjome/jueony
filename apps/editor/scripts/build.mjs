import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const upstream = resolve(app, '../../upstream/rhwp-source');
const expectedCommit = '1a76570e833917d15817415a53c09ad61ab3203f';
const commit = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== expectedCommit) throw new Error(`참조 커밋이 다릅니다: ${commit}`);
const sourceChanges = execFileSync('git', ['-C', upstream, 'status', '--porcelain', '--untracked-files=all', '--',
  'rhwp-studio', 'assets/fonts', 'npm/hwpctrl-ocx', 'LICENSE', 'THIRD_PARTY_LICENSES.md'], { encoding: 'utf8' }).trim();
if (sourceChanges) throw new Error('참조 소스에 변경이 있습니다. 기준 커밋과 같은 소스로 빌드해 주세요.');
const root = join(app, '.build/studio');
await mkdir(root, { recursive: true });
await cp(join(upstream, 'rhwp-studio/src'), join(root, 'src'), { recursive: true });
await cp(join(upstream, 'rhwp-studio/types'), join(root, 'types'), { recursive: true });
const tsconfig = JSON.parse(await readFile(join(upstream, 'rhwp-studio/tsconfig.json'), 'utf8'));
tsconfig.compilerOptions.paths['@wasm/*'] = ['../../node_modules/@rhwp/core/*'];
await writeFile(join(root, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
// Windows Git 체크아웃의 fonts 항목은 심볼릭 링크 대신 텍스트 파일일 수 있다.
await mkdir(join(root, 'public'), { recursive: true });
for (const entry of await readdir(join(upstream, 'rhwp-studio/public'))) {
  if (entry === 'fonts' || entry.startsWith('rhwp')) continue;
  await cp(join(upstream, 'rhwp-studio/public', entry), join(root, 'public', entry), { recursive: true });
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

function replaceOnce(text, before, after, label) {
  if (text.split(before).length !== 2) throw new Error(`소스 패치 기준 불일치: ${label}`);
  return text.replace(before, after);
}
let html = await readFile(join(upstream, 'rhwp-studio/index.html'), 'utf8');
html = replaceOnce(html, '<script src="/theme-init.js"></script>', '<script src="/jueony-boot.js"></script>\n  <script src="/theme-init.js"></script>', 'boot');
html = replaceOnce(html, '<title>rhwp-studio</title>', '<title>Jueony 문서 편집기 · 개발판</title>', 'title');
html = html.replaceAll('rhwp-studio 문서 편집기', 'Jueony 문서 편집기');
html = html.replace('data-i18n="ui.studioHeader.srLabel"', '');
html = replaceOnce(html, '<div id="studio-root">', '<div id="studio-root">\n    <div id="jueony-title"><strong>Jueony 문서 편집기</strong><span>한글 2024 호환성 개발판</span></div>', 'titlebar');
html = replaceOnce(html, '</head>', '  <link rel="stylesheet" href="/src/jueony/editor.css" />\n</head>', 'css');
await writeFile(join(root, 'editor.html'), html);
await cp(join(app, 'src/shell.html'), join(root, 'index.html'));
let main = await readFile(join(root, 'src/main.ts'), 'utf8');
main = replaceOnce(main, 'confirmSaveBeforeReplacingDocument, fileCommands', 'confirmSaveBeforeReplacingDocument, saveCurrentDocument, fileCommands', 'host save import');
main = replaceOnce(main, "return params.has('url');", "return params.has('url') || params.get('skipRecovery') === '1';", 'tab recovery');
main = "import { installDesktopHost } from './jueony/desktop-host';\nimport { installHangulChrome } from './jueony/chrome-2024';\n" + main;
main = replaceOnce(main, "const initPromise = initialize();", `const initPromise = initialize();
installDesktopHost({ wasm, eventBus, documentState, ready: initPromise,
  save: () => saveCurrentDocument(commandServices),
  discard: async () => { await autosaveManager.discardCurrentDraft('tab-discard'); documentState.markClean('tab-discard'); },
});
void initPromise.then(() => installHangulChrome({ wasm, eventBus, documentState, automation }));`, 'desktop host');
await writeFile(join(root, 'src/main.ts'), main);
let documentTitle = await readFile(join(root, 'src/ui/document-title.ts'), 'utf8');
documentTitle = documentTitle.replaceAll('rhwp-studio', 'Jueony 문서 편집기');
await writeFile(join(root, 'src/ui/document-title.ts'), documentTitle);

// 저장할 Blob에 문서 버전을 연결해 저장 중 발생한 새 편집을 clean 처리하지 않는다.
let fileCommands = (await readFile(join(root, 'src/command/commands/file.ts'), 'utf8')).replace(/\r\n/g, '\n');
fileCommands = "import { confirmDownload } from '../../jueony/download-save';\n" + fileCommands;
fileCommands = replaceOnce(fileCommands,
  'blob: new Blob([artifact.bytes as unknown as BlobPart], {\n      type: SAVE_FORMAT_DETAILS[format].mimeType,\n    }),',
  `blob: Object.assign(new Blob([artifact.bytes as unknown as BlobPart], {
      type: SAVE_FORMAT_DETAILS[format].mimeType,
    }), { jueonyRevision: (window as any).jueonyEditor?.revision() }),`, 'save revision');
fileCommands = replaceOnce(fileCommands,
  "console.warn('[file:save] File System Access API 실패, 폴백:', error);\n    return { method: 'fallback', handle: null, fileName: suggestedName };",
  "console.error('[file:save]', error);\n    alert('저장하지 못했습니다. 문서는 수정 상태로 유지됩니다.\\n' + String(error));\n    return 'cancelled';", 'save failure');
fileCommands = replaceOnce(fileCommands,
  'const downloadName = await promptFallbackName(saveName, format);',
  'const downloadName = saveName;', 'single save-as dialog');
fileCommands = replaceOnce(fileCommands,
  'if (!downloadName) return;\n    persistDownloadWithContentLoss(',
  'if (!downloadName) return;\n    if (!await confirmDownload(payload.blob, downloadName)) return;\n    persistDownloadWithContentLoss(', 'confirm save-as download');
fileCommands = replaceOnce(fileCommands,
  "if (!downloadName) return 'cancelled';\n    persistDownloadWithContentLoss(",
  "if (!downloadName) return 'cancelled';\n    if (!await confirmDownload(payload.blob, downloadName)) return 'cancelled';\n    persistDownloadWithContentLoss(", 'confirm save download');
fileCommands = fileCommands.replaceAll('() => downloadBlob(payload.blob, downloadName)', '() => {}');
fileCommands = replaceOnce(fileCommands,
  "services.eventBus.emit('create-new-document');",
  `if (new URLSearchParams(location.search).get('child') === '1' && window.parent !== window) {
        window.parent.postMessage({ type: 'jueony:new-document' }, location.origin);
        // 이름 변경 전에 열린 부모 창의 탭 생성도 지원한다.
        window.parent.postMessage({ type: 'joouni:new-document' }, location.origin);
      } else services.eventBus.emit('create-new-document');`, 'new document tab');
await writeFile(join(root, 'src/command/commands/file.ts'), fileCommands);
let fileSystem = (await readFile(join(root, 'src/command/file-system-access.ts'), 'utf8')).replace(/\r\n/g, '\n');
fileSystem = "import { writeSnapshot, rememberFileSnapshot } from '../jueony/save-guard';\n" + fileSystem;
fileSystem = replaceOnce(fileSystem,
  'const file = await handle.getFile();\n  return {\n    name: file.name,\n    bytes: new Uint8Array(await file.arrayBuffer()),',
  'const file = await handle.getFile();\n  const bytes = new Uint8Array(await file.arrayBuffer());\n  await rememberFileSnapshot(handle, bytes);\n  return {\n    name: file.name,\n    bytes,', 'source file fingerprint');
fileSystem = replaceOnce(fileSystem,
  'const writable = await handle.createWritable();\n  await writable.write(blob);\n  await writable.close();',
  'await writeSnapshot(handle, blob);', 'save transaction guard');
await writeFile(join(root, 'src/command/file-system-access.ts'), fileSystem);
await build({
  configFile: false, root, base: './', publicDir: join(root, 'public'),
  define: { __APP_VERSION__: JSON.stringify('0.8.7'), __RHWP_DISABLE_EXTERNAL_WEBFONTS__: 'true', __RHWP_HWPCTRL__: 'false' },
  resolve: { alias: {
    '@': join(root, 'src'),
    '@wasm/rhwp.js': join(app, 'node_modules/@rhwp/core/rhwp.js'),
    '@wasm': join(app, 'node_modules/@rhwp/core'),
    '@rhwp/hwpctrl/studio-plugin': join(upstream, 'npm/hwpctrl-ocx/src/studio-plugin.mjs'),
  } },
  build: { outDir: join(app, 'dist'), emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 3000,
    rolldownOptions: { input: { index: join(root, 'index.html'), editor: join(root, 'editor.html') } },
  },
});
const sha256 = data => createHash('sha256').update(data).digest('hex');
const customSource = [];
for (const name of (await readdir(join(app, 'src'))).sort()) customSource.push(name, await readFile(join(app, 'src', name), 'utf8'));
const evidence = {
  applicationId: 'jueony-editor',
  sourceCommit: commit, enginePackage: '@rhwp/core@0.8.7', builtAt: new Date().toISOString(),
  engineWasmSha256: sha256(await readFile(join(app, 'node_modules/@rhwp/core/rhwp_bg.wasm'))),
  buildScriptSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  customSourceSha256: sha256(customSource.join('\n')),
  applicationSourceCommit: execFileSync('git', ['-C', app, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  applicationSourceDirty: Boolean(execFileSync('git', ['-C', app, 'status', '--porcelain', '--', '.'], { encoding: 'utf8' }).trim()),
  sourceBuild: false, note: 'Rust 엔진은 공식 npm WASM 바이너리 사용. 이 빌드에서 Rust 엔진을 재컴파일하지 않음.',
};
await writeFile(join(app, 'dist/build-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
