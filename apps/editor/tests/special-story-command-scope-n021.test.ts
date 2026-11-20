import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {specialStoryShortcutPermissionsN021} from '../src/shortcuts/special-story-command-scope-n021.ts';

const editor = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const upstream = resolve(editor, '../../upstream/rhwp-source/rhwp-studio/src');

test('InputHandler explicitly admits the four story-aware global commands before submode early returns', () => {
  const source = readFileSync(resolve(upstream, 'engine/input-handler-keyboard.ts'), 'utf8');
  const start = source.indexOf('const SUBMODE_GLOBAL_COMMANDS');
  const end = source.indexOf(']);', start);
  assert.ok(start >= 0 && end > start);
  const contract = source.slice(start, end + 3);
  for (const command of ['edit:undo', 'edit:redo', 'edit:goto', 'edit:select-all']) {
    assert.match(contract, new RegExp(`['"]${command}['"]`));
    assert.equal(specialStoryShortcutPermissionsN021[command as keyof typeof specialStoryShortcutPermissionsN021].contract, 'input-handler-submode-global');
  }
  assert.match(source, /if \(this\.cursor\.isInHeaderFooter\(\)\) \{\s*if \(dispatchSubmodeGlobalShortcut\.call\(this, e\)\) return;/);
  assert.match(source, /if \(this\.cursor\.isInFootnote\(\)\) \{\s*if \(dispatchSubmodeGlobalShortcut\.call\(this, e\)\) return;/);
});

test('file save is the only additionally admitted lifecycle command and is cursor-independent in the registry', () => {
  const source = readFileSync(resolve(upstream, 'command/commands/file.ts'), 'utf8');
  const start = source.indexOf("id: 'file:save',");
  const end = source.indexOf("id: 'file:save-as',", start);
  assert.ok(start >= 0 && end > start);
  const contract = source.slice(start, end);
  assert.match(contract, /canExecute:\s*\(ctx\)\s*=>\s*ctx\.hasDocument/);
  assert.match(contract, /await saveCurrentDocument\(services\)/);
  assert.doesNotMatch(contract, /cursor|selection|inTable|inField/);
  assert.equal(specialStoryShortcutPermissionsN021['file:save'].contract, 'registry-document-save');
  assert.equal('file:save-as' in specialStoryShortcutPermissionsN021, false);
  assert.equal('file:print' in specialStoryShortcutPermissionsN021, false);
});
