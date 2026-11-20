import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import {
  auditMenuReachability,
  findCrossSurfaceCommands,
  type MenuReachabilityEntry,
} from '../src/shortcuts/menu-reachability-audit.ts';

const repo = resolve(import.meta.dirname, '../../..');
const studio = resolve(repo, 'upstream/rhwp-source/rhwp-studio');

function files(root: string, extension = '.ts'): string[] {
  const result: string[] = [];
  for (const item of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, item.name);
    if (item.isDirectory()) result.push(...files(path, extension));
    else if (extname(path) === extension) result.push(path);
  }
  return result;
}

function registeredCommands(): Set<string> {
  const ids = new Set<string>();
  const sources = [
    ...files(resolve(studio, 'src/command/commands')),
    ...files(resolve(repo, 'apps/editor/src/adapters/rhwp')),
    ...files(resolve(repo, 'apps/editor/src/editor-actions')),
    resolve(repo, 'apps/editor/src/shortcuts/install.ts'),
    resolve(repo, 'apps/editor/src/chrome-2024.ts'),
  ];
  for (const path of sources) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/\bid\s*:\s*['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)) ids.add(match[1]!);
    for (const match of source.matchAll(/\bstub\(\s*['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)) ids.add(match[1]!);
    for (const match of source.matchAll(/\bblockCalcCommand\(\s*['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)) ids.add(match[1]!);
    for (const match of source.matchAll(/\bregister\(\s*['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)) ids.add(match[1]!);
  }
  const view = readFileSync(resolve(studio, 'src/command/commands/view.ts'), 'utf8');
  for (const match of view.matchAll(/zoomLevel\((\d+)(?:,|\))/g)) ids.add(`view:zoom-${match[1]}`);
  for (const match of view.matchAll(/themeModeCommand\(['"]([a-z]+)['"]/g)) ids.add(`view:theme-${match[1]}`);
  for (const match of view.matchAll(/themeSkinCommand\(['"]([a-z]+)['"]/g)) ids.add(`view:skin-${match[1]}`);
  const pageClipboard = readFileSync(resolve(repo, 'apps/editor/src/adapters/rhwp/page-body-clipboard.ts'), 'utf8');
  if (pageClipboard.includes("['copy','paste'] as const")) {
    ids.add('page:copy-body-page'); ids.add('page:paste-body-page');
  }
  // These two IDs are constructed by the shortcut installer from a closed tuple.
  ids.add('ext:jueony-select-cell-columns'); ids.add('ext:jueony-select-cell-rows');
  return ids;
}

function placeholderCommands(): Set<string> {
  const ids = new Set<string>();
  for (const path of files(resolve(studio, 'src/command/commands'))) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/\bstub\(\s*['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)) ids.add(match[1]!);
  }
  // Jueony replaces the pinned Studio caption stubs with registry-owned
  // snapshot commands during shortcut installation.
  const captionOverrides = readFileSync(resolve(repo, 'apps/editor/src/adapters/rhwp/manual-commands.ts'), 'utf8');
  if (captionOverrides.includes("id: 'insert:caption-' + placement")) {
    for (const placement of ['top', 'lt', 'lm', 'lb', 'rt', 'rm', 'rb', 'bottom', 'none']) ids.delete(`insert:caption-${placement}`);
  }
  return ids;
}

function menuEntries(): MenuReachabilityEntry[] {
  const html = readFileSync(resolve(studio, 'index.html'), 'utf8');
  const result: MenuReachabilityEntry[] = [];
  let menu = 'unknown';
  for (const [lineIndex, line] of html.split(/\r?\n/).entries()) {
    const menuMatch = line.match(/class="menu-item"\s+data-menu="([^"]+)"/);
    if (menuMatch) menu = menuMatch[1]!;
    if (!line.includes('class="md-item')) continue;
    const command = line.match(/data-cmd="([^"]+)"/)?.[1];
    if (command) {
      const params = [...line.matchAll(/data-(is-header|apply-to|template-id)="([^"]+)"/g)].map(match => `${match[1]}=${match[2]}`).join(';');
      result.push({ surface: 'menu', location: menu, commandId: command, variant: params || `line-${lineIndex + 1}`, staticallyDisabled: /class="md-item[^"]*\bdisabled\b/.test(line) });
    }
  }
  return result;
}

function ribbonEntries(): MenuReachabilityEntry[] {
  const source = readFileSync(resolve(repo, 'apps/editor/src/chrome-2024.ts'), 'utf8');
  const block = source.slice(source.indexOf('const tabs:'), source.indexOf('export function installHangulChrome'));
  const result: MenuReachabilityEntry[] = [];
  let tab = 'unknown'; let group = 'unknown';
  for (const [lineIndex, line] of block.split(/\r?\n/).entries()) {
    const tabMatch = line.match(/^\s{2}([a-z]+):/); if (tabMatch) tab = tabMatch[1]!;
    const groupMatch = line.match(/label:\s*'([^']+)'/); if (groupMatch) group = groupMatch[1]!;
    const commands = line.match(/commands:\s*\[([^\]]*)\]/)?.[1] ?? '';
    for (const match of commands.matchAll(/['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)) {
      result.push({ surface: 'ribbon', location: `${tab}/${group}`, commandId: match[1]! });
    }
  }
  const quick = source.match(/for \(const id of \[([^\]]+)\]\) \{\s*\n?\s*const button = commandButton\(id, true\)/)?.[1] ?? '';
  for (const match of quick.matchAll(/['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)) {
    result.push({ surface: 'quick-access', location: 'editor-style-bar', commandId: match[1]! });
  }
  return result;
}

function hostQuickEntries(): MenuReachabilityEntry[] {
  const source = readFileSync(resolve(repo, 'apps/editor/src/unified-chrome.ts'), 'utf8');
  const values = source.match(/const quick=\[([^\]]+)\]/)?.[1] ?? '';
  return [...values.matchAll(/['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)].map(match => ({
    surface: 'quick-access' as const,
    location: 'host-toolbar',
    commandId: match[1]!,
  }));
}

function contextEntries(): MenuReachabilityEntry[] {
  const source = readFileSync(resolve(studio, 'src/engine/input-handler.ts'), 'utf8');
  const start = source.indexOf('private getTableObjectContextMenuItems');
  const end = source.indexOf('/** 특수 키 처리', start);
  const block = source.slice(start, end);
  const result: MenuReachabilityEntry[] = [];
  let location = 'unknown';
  for (const [lineIndex, line] of block.split(/\r?\n/).entries()) {
    const method = line.match(/private (get[A-Za-z]+ContextMenuItems)/)?.[1]; if (method) location = method;
    for (const match of line.matchAll(/commandId:\s*['"]([a-z][a-z0-9-]*:[a-z0-9-]+)['"]/g)) {
      result.push({ surface: 'context-menu', location, commandId: match[1]!, variant: `line-${lineIndex + 1}` });
    }
  }
  return result;
}

test('N019 static menu, ribbon and context command IDs have registry evidence', () => {
  const entries = [...menuEntries(), ...ribbonEntries(), ...hostQuickEntries(), ...contextEntries()];
  const findings = auditMenuReachability(entries, registeredCommands(), placeholderCommands());
  assert.deepEqual(findings.filter(item => item.category === 'unregistered'), []);
});

test('N019 has no duplicate command in the same static UI location', () => {
  const entries = [...menuEntries(), ...ribbonEntries(), ...hostQuickEntries(), ...contextEntries()];
  const findings = auditMenuReachability(entries, registeredCommands(), placeholderCommands());
  assert.deepEqual(findings.filter(item => item.category === 'duplicate'), []);
});

test('N019 reports registered placeholders instead of claiming they are reachable', () => {
  const findings = auditMenuReachability(menuEntries(), registeredCommands(), placeholderCommands());
  const placeholders = findings.filter(item => item.category === 'placeholder');
  assert.deepEqual(placeholders.map(item => item.commandId).sort(), ['insert:comment', 'insert:para-band']);
  assert.deepEqual(placeholders.map(item => item.id).sort(), [
    'N019-PLACEHOLDER-menu-insert-insert-comment',
    'N019-PLACEHOLDER-menu-insert-insert-para-band',
  ]);
});

test('cross-surface commands are intentional reachability, not same-location duplicates', () => {
  const entries = [...menuEntries(), ...ribbonEntries(), ...hostQuickEntries(), ...contextEntries()];
  const cross = findCrossSurfaceCommands(entries);
  assert.deepEqual(cross.get('edit:copy'), ['context-menu', 'menu', 'ribbon']);
  assert.deepEqual(cross.get('table:cell-props'), ['context-menu', 'menu', 'ribbon']);
  assert.deepEqual(cross.get('file:save'), ['menu', 'quick-access']);
});

test('N019 audit detects synthetic missing, duplicate and placeholder entries with stable IDs', () => {
  const entries: MenuReachabilityEntry[] = [
    { surface: 'menu', location: 'file', commandId: 'file:known' },
    { surface: 'menu', location: 'file', commandId: 'file:known' },
    { surface: 'ribbon', location: 'edit/find', commandId: 'edit:missing' },
    { surface: 'context-menu', location: 'default', commandId: 'edit:stub' },
  ];
  const findings = auditMenuReachability(entries, new Set(['file:known', 'edit:stub']), new Set(['edit:stub']));
  assert.deepEqual(findings.map(item => item.id), [
    'N019-DUPLICATE-menu-file-file-known',
    'N019-UNREGISTERED-ribbon-edit-find-edit-missing',
    'N019-PLACEHOLDER-context-menu-default-edit-stub',
  ]);
});
