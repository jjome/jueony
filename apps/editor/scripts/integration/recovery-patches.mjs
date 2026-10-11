import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function replaceOnce(source, before, after, name) {
  if (source.split(before).length !== 2) throw new Error(`복구 소스 패치 기준 불일치: ${name}`);
  return source.replace(before, after);
}

/** Run after the common Studio integration. The shell owns embedded recovery; standalone Studio retains its manager. */
export async function applyRecoveryPatches({ root }) {
  const path = join(root, 'src/main.ts');
  let main = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
  main = replaceOnce(main, '  const settings = userSettings.getAutosaveSettings();\n  return {\n    recoveryEnabled: settings.recoveryEnabled,',
    "  const settings = userSettings.getAutosaveSettings();\n  // Embedded documents use the workspace checkpoint writer, with these same settings.\n  if (window.parent !== window && new URLSearchParams(location.search).get('child') === '1') {\n    return { recoveryEnabled: false, recoveryIntervalMs: 0, idleEnabled: false, idleDelayMs: 0 };\n  }\n  return {\n    recoveryEnabled: settings.recoveryEnabled,", 'single recovery owner');
  await writeFile(path, main);

  const optionsPath = join(root, 'src/ui/options-dialog.ts');
  let dialog = (await readFile(optionsPath, 'utf8')).replace(/\r\n/g, '\n');
  dialog = replaceOnce(dialog, "    desc.textContent = i18nText('dialog.options.desc.text');",
    "    desc.textContent = i18nText('dialog.options.desc.text');\n    if (window.parent !== window && new URLSearchParams(location.search).get('child') === '1') {\n      desc.textContent = '이 설정은 업무 안의 문서 복구본에 적용됩니다. 원본 파일은 저장 명령으로 저장하세요. 두 자동 저장을 모두 끄면 새 복구본을 만들지 않으며, 이미 보관된 복구본은 유지됩니다. 업무·채팅·환경 설정은 계속 저장됩니다.';\n    }", 'recovery semantics description');
  await writeFile(optionsPath, dialog);
}
