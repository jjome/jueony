import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hangulBindings, HangulKeyResolver, keyContextPriority, type Binding, type KeyContext } from '../src/shortcuts/keymap.ts';
import {
  auditCommandReachability,
  auditRequiredContexts,
  auditShortcutMatrix,
  effectiveSpecialScopes,
} from '../src/shortcuts/shortcut-audit.ts';

const root = resolve(import.meta.dirname, '..');
const body: KeyContext = { table: false, cells: false, object: false };

function eventFor(stroke: string, repeat = false, isComposing = false) {
  const parts = stroke.split('+');
  const key = parts.at(-1)!;
  const codeAliases: Record<string, string> = {
    '[': 'BracketLeft', ']': 'BracketRight', '=': 'Equal', '-': 'Minus', Space: 'Space',
  };
  const code = /^[A-Z]$/.test(key) ? `Key${key}` : /^\d$/.test(key) ? `Digit${key}` : codeAliases[key] ?? key;
  return {
    code,
    key: key === 'Space' ? ' ' : key,
    ctrlKey: parts.includes('Ctrl'),
    altKey: parts.includes('Alt'),
    shiftKey: parts.includes('Shift'),
    metaKey: false,
    repeat,
    isComposing,
  };
}

function contextFor(binding: Binding): KeyContext {
  if (binding.scope === 'table') return { ...body, table: true };
  if (binding.scope === 'cells') return { ...body, table: true, cells: true };
  if (binding.scope === 'object') return { ...body, object: true };
  return body;
}

function resolveBinding(binding: Binding, repeat = false) {
  const resolver = new HangulKeyResolver();
  const strokes = binding.keys.split(',');
  if (strokes.length === 2) {
    const prefix = resolver.resolve(eventFor(strokes[0]!), contextFor(binding), 1);
    assert.equal(prefix.handled, true, `${binding.keys} prefix`);
    return resolver.resolve(eventFor(strokes[1]!, repeat), contextFor(binding), 2);
  }
  return resolver.resolve(eventFor(strokes[0]!, repeat), contextFor(binding), 1);
}

test('N021 matrix audit keeps duplicate and prefix reachability failures at zero', () => {
  const findings = auditShortcutMatrix(hangulBindings);
  assert.deepEqual(findings.filter(item => item.category === 'duplicate'), []);
  assert.deepEqual(findings.filter(item => item.category === 'prefix-shadow'), []);
});

test('N021 resolves P cells/object overlap with explicit object-first precedence', () => {
  assert.deepEqual(keyContextPriority, ['object', 'cells', 'table', 'document']);
  const overlaps = auditShortcutMatrix(hangulBindings).filter(item => item.id === 'N021-CONTEXT-PRECEDENCE-p');
  assert.equal(overlaps[0]!.severity, 'info');
  assert.deepEqual(overlaps[0]!.commands, ['table:cell-props', 'format:object-properties']);
  assert.deepEqual(overlaps[0]!.scopes, ['cells', 'object']);

  const ambiguous: KeyContext = { table: true, cells: true, object: true };
  assert.equal(new HangulKeyResolver().resolve(eventFor('P'), ambiguous).binding?.command, 'format:object-properties');
  assert.equal(new HangulKeyResolver().resolve(eventFor('P'), { ...ambiguous, object: false }).binding?.command, 'table:cell-props');
});

test('N021 enumerates intentional document/special overrides instead of calling them duplicates', () => {
  const overrides = auditShortcutMatrix(hangulBindings)
    .filter(item => item.category === 'context-override')
    .filter(item => item.id.startsWith('N021-CONTEXT-OVERRIDE-'))
    .map(item => item.keys)
    .sort();
  assert.deepEqual(overrides, ['Ctrl+Backspace', 'Ctrl+Enter', 'Ctrl+N,C', 'F7']);
});

test('N021 records all pending shortcuts and no other command is treated as pending', () => {
  const pending = auditShortcutMatrix(hangulBindings).filter(item => item.category === 'pending');
  assert.deepEqual(pending.map(item => item.commands[0]).sort(), [
    'pending:clear-char-style',
    'pending:macro-record',
    'pending:page-number-dialog',
  ]);
});

test('every binding is reachable in its minimal context and repeat policy is enforced', () => {
  for (const binding of hangulBindings) {
    const normal = resolveBinding(binding);
    assert.equal(normal.binding?.command, binding.command, `${binding.keys} -> ${binding.command}`);
    const repeated = resolveBinding(binding, true);
    assert.equal(repeated.binding?.command, binding.repeatable ? binding.command : undefined, `${binding.keys} repeat`);
    assert.equal(repeated.handled, true, `${binding.keys} repeat handled`);
  }
});

test('composition resets a pending chord and never dispatches a shortcut', () => {
  const resolver = new HangulKeyResolver();
  assert.equal(resolver.resolve(eventFor('Ctrl+N'), body, 1).handled, true);
  assert.equal(resolver.resolve(eventFor('T', false, true), body, 2).handled, false);
  assert.equal(resolver.resolve(eventFor('T'), body, 3).handled, false);
});

test('capture installation contains the IME 229 and AltGraph guards outside the pure resolver', () => {
  const source = readFileSync(resolve(root, 'src/shortcuts/install.ts'), 'utf8');
  assert.match(source, /event\.keyCode\s*===\s*229/);
  assert.match(source, /getModifierState\?\.\('AltGraph'\)/);
  assert.match(source, /!candidate\.binding\?\.nativeClipboard/);
  assert.match(source, /stopImmediatePropagation\(\)/);
});

test('N021 exposes special-story context gaps without claiming feature completion', () => {
  assert.deepEqual(effectiveSpecialScopes, ['table', 'cells', 'object']);
  const gaps = auditRequiredContexts(effectiveSpecialScopes, [
    'table', 'cells', 'object', 'header-footer', 'footnote', 'endnote', 'textbox',
  ]);
  assert.deepEqual(gaps.map(item => item.id), [
    'N021-CONTEXT-MODEL-MISSING-header-footer',
    'N021-CONTEXT-MODEL-MISSING-footnote',
    'N021-CONTEXT-MODEL-MISSING-endnote',
    'N021-CONTEXT-MODEL-MISSING-textbox',
  ]);
});

test('registry reachability audit distinguishes pending reservations from missing commands', () => {
  const sample: Binding[] = [
    { keys: 'F1', command: 'known:command', label: 'known', scope: 'document' },
    { keys: 'F2', command: 'missing:command', label: 'missing', scope: 'document' },
    { keys: 'F3', command: 'pending:future', label: 'pending', scope: 'document' },
  ];
  const findings = auditCommandReachability(sample, new Set(['known:command']));
  assert.deepEqual(findings.map(item => item.id), ['N021-UNREGISTERED-document-f2-missing-command']);
});
