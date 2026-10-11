import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL('../apps/editor/package.json', import.meta.url));
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const normalize = value => value.replaceAll('\\', '/').replace(/^\.\//, '');
const moduleOf = file => {
  const match = /(?:^|\/)modules\/([^/]+)\/([^/]+)\//.exec(file);
  return match ? { name: match[1], layer: match[2] } : undefined;
};
const forbiddenGlobals = new Set(['globalThis', 'global', 'window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'navigator', 'location', 'process', 'Buffer', 'require', 'WebAssembly', 'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker', 'BroadcastChannel', 'FileReader', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'requestAnimationFrame', 'alert', 'prompt', 'confirm']);
const nativeType = name => /^(FileSystem.*Handle|IDB.*|Window|Document|Node|HTMLElement|HTML.*Element|File|Blob|WasmDocument|HwpDocument|WebAssembly)$/.test(name);
const sourceExtension = /\.(?:[cm]?[jt]s|tsx|jsx)$/;

function targetOf(file, specifier, files) {
  if (!specifier.startsWith('.')) return undefined;
  const target = posix.normalize(posix.join(posix.dirname(file), specifier));
  const candidates = [target, ...['.ts', '.mts', '.mjs', '.js', '.tsx', '/index.ts', '/index.mjs'].map(suffix => target + suffix)];
  if (/\.[cm]?js$/.test(target)) candidates.push(target.replace(/\.js$/, '.ts').replace(/\.mjs$/, '.mts').replace(/\.cjs$/, '.cts'));
  return candidates.find(candidate => files.has(candidate)) ?? target;
}

function components(graph) {
  let sequence = 0;
  const indices = new Map(), low = new Map(), stack = [], stacked = new Set(), result = [];
  function visit(name) {
    indices.set(name, sequence); low.set(name, sequence++); stack.push(name); stacked.add(name);
    for (const child of graph.get(name) ?? []) {
      if (!indices.has(child)) { visit(child); low.set(name, Math.min(low.get(name), low.get(child))); }
      else if (stacked.has(child)) low.set(name, Math.min(low.get(name), indices.get(child)));
    }
    if (low.get(name) === indices.get(name)) {
      const found = []; let item;
      do { item = stack.pop(); stacked.delete(item); found.push(item); } while (item !== name);
      if (found.length > 1) result.push(found.sort());
    }
  }
  for (const name of graph.keys()) if (!indices.has(name)) visit(name);
  return result;
}

/** Pure source audit, suitable for negative fixtures without editing the working tree. */
export function auditModuleSources(sources, { allowlist = [] } = {}) {
  const files = new Map(Object.entries(sources).map(([file, code]) => [normalize(file), code]));
  const diagnostics = [], dependencies = [], modules = new Set(), graph = new Map(), used = new Set();
  const exceptions = new Map();
  const add = (code, file, message, node, target) => diagnostics.push({ code, file, line: node?.loc?.start?.line ?? 1, message, ...(target ? { target } : {}) });
  for (const item of allowlist) {
    const valid = item && ['from', 'to', 'owner', 'reason', 'removal'].every(key => typeof item[key] === 'string' && item[key].trim()) && !/[?*]/.test(item.from + item.to) && !moduleOf(item.from);
    if (!valid) { add('invalid-allowlist', 'scripts/module-boundaries.json', 'Exceptions require exact legacy from/to, owner, reason and removal stage.'); continue; }
    const key = normalize(item.from) + ' -> ' + normalize(item.to);
    if (exceptions.has(key)) add('invalid-allowlist', 'scripts/module-boundaries.json', 'Duplicate exception: ' + key);
    exceptions.set(key, item);
  }
  for (const [file, source] of files) {
    if (!sourceExtension.test(file)) continue;
    const own = moduleOf(file);
    if (own) { modules.add(own.name); if (!graph.has(own.name)) graph.set(own.name, new Set()); }
    let ast;
    try { ast = parse(source, { sourceType: 'unambiguous', plugins: [['typescript', { dts: /\.d\.[cm]?ts$/.test(file) }], 'jsx'], createImportExpressions: true }); }
    catch (error) { add('parse-error', file, String(error.message)); continue; }
    function dependency(specifier, node, kind) {
      if (typeof specifier !== 'string') { if (own) add('dynamic-import', file, 'Computed module imports cannot be audited.', node); return; }
      const target = targetOf(file, specifier, files), other = target && moduleOf(target);
      dependencies.push({ from: file, to: target ?? specifier, kind });
      if (own) {
        if (!target || !other) add('core-external', file, 'Core modules depend only on module contracts and injected ports: ' + specifier, node, target);
        else {
          if (!files.has(target)) add('missing-target', file, 'Module target does not exist: ' + target, node, target);
          if (own.name !== other.name) {
            graph.get(own.name).add(other.name);
            if (other.layer !== 'public') add('private-import', file, 'Cross-module imports must use the public facade: ' + target, node, target);
          } else if (['domain', 'ports'].includes(own.layer) && other.layer === 'application') {
            add('layer-direction', file, 'Domain/ports must not import application orchestration.', node, target);
          }
        }
      } else if (other && other.layer !== 'public') {
        const key = file + ' -> ' + target;
        if (exceptions.has(key)) used.add(key);
        else add('private-import', file, 'Legacy/adapter consumers require public facade or a scoped migration exception: ' + target, node, target);
      }
    }
    traverse(ast, {
      ImportDeclaration(path) { dependency(path.node.source.value, path.node, path.node.importKind === 'type' ? 'type' : 'import'); },
      ExportNamedDeclaration(path) { if (path.node.source) dependency(path.node.source.value, path.node, path.node.exportKind === 'type' ? 'type-export' : 'export'); },
      ExportAllDeclaration(path) { dependency(path.node.source.value, path.node, 'export-all'); },
      ImportExpression(path) { dependency(path.node.source.type === 'StringLiteral' ? path.node.source.value : undefined, path.node, 'dynamic'); },
      TSImportType(path) { dependency(path.node.argument.type === 'StringLiteral' ? path.node.argument.value : undefined, path.node, 'import-type'); },
      CallExpression(path) {
        if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'require' && !path.scope.hasBinding('require', true)) dependency(path.node.arguments[0]?.type === 'StringLiteral' ? path.node.arguments[0].value : undefined, path.node, 'require');
      },
      TSAnyKeyword(path) { if (own?.layer === 'public') add('public-any', file, 'Public contracts must use explicit DTOs or unknown, never any.', path.node); },
      TSTypeReference(path) {
        const name = path.node.typeName;
        if (own && name.type === 'Identifier' && nativeType(name.name)) add('public-native-type', file, 'Native handles belong in adapters, including types reexported by public contracts: ' + name.name, path.node);
      },
      ReferencedIdentifier(path) {
        if (own && forbiddenGlobals.has(path.node.name) && !path.scope.hasBinding(path.node.name, true)) add('core-global', file, 'Inject an adapter instead of global ' + path.node.name + '.', path.node);
      },
    });
  }
  for (const cycle of components(graph)) add('module-cycle', 'apps/editor/src/modules', 'Module dependency cycle (including type imports): ' + cycle.join(' -> '));
  for (const key of exceptions.keys()) if (!used.has(key)) add('stale-allowlist', 'scripts/module-boundaries.json', 'Remove unused exception: ' + key);
  return { ok: diagnostics.length === 0, scannedFiles: files.size, moduleCount: modules.size, modules: [...modules].sort(), dependencies, diagnostics, allowedLegacyImports: used.size };
}

async function collect(root, directory, sources) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(root, path, sources);
    else if (entry.isFile() && sourceExtension.test(entry.name)) sources[normalize(relative(root, path))] = await readFile(path, 'utf8');
  }
}

export async function auditRepository(root = resolve(here, '..')) {
  const sources = {};
  await collect(root, join(root, 'apps/editor/src'), sources);
  let allowlist = [];
  try { allowlist = JSON.parse(await readFile(join(root, 'scripts/module-boundaries.json'), 'utf8')).legacyPrivateImports ?? []; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return auditModuleSources(sources, { allowlist });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await auditRepository();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
