import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GENERATED_FONT_RULES = Object.freeze([
  'src/core/generated/font-rule-projections/webfont-supply.ts',
  'src/core/generated/font-rule-projections/canvaskit-sfnt.ts',
]);
const NETWORK_LITERAL = /\b(?:https?|wss?):\/\/[^\s"'`<>\\)]+/giu;
const FONT_URL = /\.(?:woff2?|ttf|otf|ttc)(?:$|[?#])/iu;
const EXPECTED_NETWORK_LITERALS = 256;
const DISABLED_FONT_PREFIX = 'fonts/__external-disabled__/';

const sha256 = value => createHash('sha256').update(value).digest('hex');

export function disableGeneratedExternalFontSources(source, label = 'generated font rules') {
  if (typeof source !== 'string' || source.length === 0) throw new Error(`${label}: source is empty`);
  const urls = [...source.matchAll(NETWORK_LITERAL)].map(match => match[0]);
  if (urls.length === 0) throw new Error(`${label}: external font source marker is missing`);
  for (const value of urls) {
    let url;
    try { url = new URL(value); } catch { throw new Error(`${label}: malformed external font URL`); }
    if (url.protocol !== 'https:' || url.username || url.password || !FONT_URL.test(url.pathname)) {
      throw new Error(`${label}: non-font network literal rejected`);
    }
  }
  const replacements = new Map(urls.map(value => {
    const extension = /\.(woff2?|ttf|otf|ttc)(?:$|[?#])/iu.exec(new URL(value).pathname)?.[1]?.toLowerCase();
    return [value, `${DISABLED_FONT_PREFIX}${sha256(value).slice(0, 24)}.${extension}`];
  }));
  let output = source;
  for (const [before, after] of replacements) output = output.replaceAll(before, after);
  if (NETWORK_LITERAL.test(output)) throw new Error(`${label}: external font URL remained after sanitizing`);
  return Object.freeze({
    source: output,
    literalCount: urls.length,
    uniqueSourceCount: replacements.size,
    inputSha256: sha256(source),
    outputSha256: sha256(output),
  });
}

export function skipDisabledFontSources(source, file) {
  const prefix = JSON.stringify(DISABLED_FONT_PREFIX);
  const [before, after] = file === 'font-loader.ts' ? [
    'const FONT_LIST: readonly FontEntry[] = FONT_RULE_WEBFONT_ENTRIES;',
    `const FONT_LIST: readonly FontEntry[] = FONT_RULE_WEBFONT_ENTRIES.filter(entry => !entry.file.startsWith(${prefix}));`,
  ] : [
    'const snapshot = options.disableExternalWebFonts === true ? supply.offline : supply.online;',
    `const snapshot = options.disableExternalWebFonts === true || supply.online.sources.some(source => source.url.startsWith(${prefix})) ? supply.offline : supply.online;`,
  ];
  if (source.split(before).length !== 2) throw new Error(`${file}: offline font selection marker mismatch`);
  return source.replace(before, after);
}

export async function applyOfflineFontSourcePatches({ root }) {
  const files = [];
  for (const relativePath of GENERATED_FONT_RULES) {
    const path = join(root, ...relativePath.split('/'));
    const result = disableGeneratedExternalFontSources(await readFile(path, 'utf8'), relativePath);
    await writeFile(path, result.source);
    files.push(Object.freeze({
      path: relativePath,
      literalCount: result.literalCount,
      uniqueSourceCount: result.uniqueSourceCount,
      inputSha256: result.inputSha256,
      outputSha256: result.outputSha256,
    }));
  }
  const literalCount = files.reduce((sum, item) => sum + item.literalCount, 0);
  if (literalCount !== EXPECTED_NETWORK_LITERALS) {
    throw new Error(`offline font rule source count mismatch: ${literalCount}`);
  }
  for (const file of ['font-loader.ts', 'font-rule-runtime.ts']) {
    const path = join(root, 'src/core', file);
    await writeFile(path, skipDisabledFontSources(await readFile(path, 'utf8'), file));
  }
  const evidence = Object.freeze({
    schemaVersion: 1,
    policy: 'generated-external-fonts-disabled',
    literalCount,
    files,
  });
  await writeFile(join(root, 'public', 'offline-font-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}
