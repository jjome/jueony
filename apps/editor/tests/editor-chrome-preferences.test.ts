import test from 'node:test';
import assert from 'node:assert/strict';
import { bindEditorChromePreferences } from '../src/adapters/browser/editor-chrome-preferences.ts';
import { defaultEditorChromePreferences, readEditorChromePreferences, validateEditorChromePreferences, EDITOR_CHROME_KEY, LEGACY_STYLE_PANEL_KEY } from '../src/modules/preferences/public/index.ts';

function fixture(entries: [string, string][] = []) {
  const values = new Map(entries), events = new EventTarget(), errors: Error[] = [], changes: unknown[] = [];
  let writes = 0, denyWrite = false, denyRead = false;
  const storage = {
    getItem(key: string) { if (denyRead) throw new Error('read denied'); return values.get(key) ?? null; },
    setItem(key: string, value: string) { if (denyWrite) throw new Error('quota'); writes++; values.set(key, value); },
  };
  const bind = () => bindEditorChromePreferences({ storage, events, onChange: (value, source) => changes.push({ value, source }), onError: error => errors.push(error) });
  const emit = (key: string | null) => { const event = new Event('storage'); Object.defineProperty(event, 'key', { value: key }); events.dispatchEvent(event); };
  return { values, storage, bind, events, errors, changes, emit, writes: () => writes, denyWrite(value: boolean) { denyWrite = value; }, denyRead(value: boolean) { denyRead = value; } };
}

test('opening a blank editor restores defaults without writing any preference', () => {
  const f = fixture(), binding = f.bind();
  assert.deepEqual(binding.snapshot(), defaultEditorChromePreferences());
  assert.equal(f.writes(), 0); assert.deepEqual(f.errors, []);
});

test('legacy hidden style panel is restored without startup writes and survives ribbon migration', () => {
  const f = fixture([[LEGACY_STYLE_PANEL_KEY, 'false']]), binding = f.bind();
  assert.equal(binding.snapshot().stylePanelOpen, false); assert.equal(f.writes(), 0);
  assert.equal(binding.setRibbonTab('format'), true);
  assert.deepEqual(readEditorChromePreferences(f.storage), { version: 1, stylePanelOpen: false, ribbonTab: 'format' });
  assert.equal(f.values.get(LEGACY_STYLE_PANEL_KEY), 'false');
  const restart = f.bind(); assert.deepEqual(restart.snapshot(), binding.snapshot()); assert.equal(f.writes(), 1);
});

test('sequential stale document tabs merge independent ribbon and panel choices', () => {
  const f = fixture(), first = f.bind(), second = f.bind();
  first.setStylePanelOpen(false); second.setRibbonTab('page');
  assert.deepEqual(readEditorChromePreferences(f.storage), { version: 1, stylePanelOpen: false, ribbonTab: 'page' });
  first.setRibbonTab('format'); second.setStylePanelOpen(true);
  assert.deepEqual(readEditorChromePreferences(f.storage), { version: 1, stylePanelOpen: true, ribbonTab: 'format' });
});

test('storage events synchronize another editor and clear resets defaults without echo writes', () => {
  const f = fixture(), first = f.bind(), second = f.bind(); first.setStylePanelOpen(false);
  assert.equal(second.snapshot().stylePanelOpen, true);
  f.emit('unrelated'); assert.equal(second.snapshot().stylePanelOpen, true);
  f.emit(EDITOR_CHROME_KEY); assert.equal(second.snapshot().stylePanelOpen, false); assert.equal(f.writes(), 1);
  f.values.clear(); f.emit(null); assert.deepEqual(second.snapshot(), defaultEditorChromePreferences()); assert.equal(f.writes(), 1);
});

test('legacy changes synchronize only before the v1 preferences were created', () => {
  const f = fixture(), binding = f.bind(); f.values.set(LEGACY_STYLE_PANEL_KEY, 'false'); f.emit(LEGACY_STYLE_PANEL_KEY);
  assert.equal(binding.snapshot().stylePanelOpen, false);
  binding.setRibbonTab('view'); f.values.set(LEGACY_STYLE_PANEL_KEY, 'true'); f.emit(LEGACY_STYLE_PANEL_KEY);
  assert.equal(binding.snapshot().stylePanelOpen, false);
});

test('contextual table and unknown ribbon choices are never persisted as general startup tools', () => {
  const f = fixture(), binding = f.bind();
  for (const tab of ['table', 'file', 'missing', '', null, 42]) assert.equal(binding.setRibbonTab(tab), false);
  assert.equal(f.writes(), 0); assert.equal(binding.snapshot().ribbonTab, 'edit');
});

test('quota failure preserves shown preferences and reports failure, then retry succeeds', () => {
  const f = fixture(), binding = f.bind(); f.denyWrite(true);
  assert.equal(binding.setStylePanelOpen(false), false); assert.equal(binding.snapshot().stylePanelOpen, true);
  assert.equal(f.errors.length, 1); assert.deepEqual(f.changes, []); assert.equal(f.writes(), 0);
  f.denyWrite(false); assert.equal(binding.setStylePanelOpen(false), true); assert.equal(binding.snapshot().stylePanelOpen, false);
});

for (const raw of ['{broken', '[]', 'null', '{"version":2,"ribbonTab":"future"}', '{"version":1,"ribbonTab":"table"}', '{"version":1,"stylePanelOpen":0}']) {
  test('corrupt or future state is preserved on startup and attempted changes: ' + raw, () => {
    const f = fixture([[EDITOR_CHROME_KEY, raw]]), binding = f.bind();
    assert.deepEqual(binding.snapshot(), defaultEditorChromePreferences());
    assert.equal(f.errors.length, 1); assert.equal(binding.setRibbonTab('format'), false);
    assert.equal(f.values.get(EDITOR_CHROME_KEY), raw); assert.equal(f.writes(), 0);
    f.values.set(EDITOR_CHROME_KEY, '{"version":1,"ribbonTab":"page","stylePanelOpen":false}'); f.emit(EDITOR_CHROME_KEY);
    assert.deepEqual(binding.snapshot(), { version: 1, ribbonTab: 'page', stylePanelOpen: false });
  });
}

test('unknown local extension fields survive valid edits but do not enter the public projection', () => {
  const f = fixture([[EDITOR_CHROME_KEY, '{"version":1,"future":{"value":5}}']]), binding = f.bind();
  binding.setStylePanelOpen(false);
  assert.deepEqual(JSON.parse(f.values.get(EDITOR_CHROME_KEY)!).future, { value: 5 });
  assert.equal(Object.hasOwn(binding.snapshot(), 'future'), false);
});

test('disposed editor stops notifications and cannot write persisted choices', () => {
  const f = fixture(), binding = f.bind(); binding.dispose();
  f.values.set(EDITOR_CHROME_KEY, '{"version":1,"ribbonTab":"format"}'); f.emit(EDITOR_CHROME_KEY);
  assert.equal(binding.snapshot().ribbonTab, 'edit'); assert.equal(binding.setStylePanelOpen(false), false); assert.equal(f.writes(), 0);
});

test('read denial leaves stored values intact and can recover after permission returns', () => {
  const f = fixture([[EDITOR_CHROME_KEY, '{"version":1,"ribbonTab":"page"}']]); f.denyRead(true);
  const binding = f.bind(); assert.equal(f.errors.length, 1); assert.equal(binding.setStylePanelOpen(false), false);
  f.denyRead(false); binding.refresh(); assert.equal(binding.snapshot().ribbonTab, 'page'); assert.equal(f.writes(), 0);
});

test('projection is detached and sparse v1 fields retain explicit defaults', () => {
  const raw = { version: 1, stylePanelOpen: false, future: 'ignored' };
  const parsed = validateEditorChromePreferences(raw); parsed.stylePanelOpen = true;
  assert.equal(raw.stylePanelOpen, false); assert.equal(parsed.ribbonTab, 'edit');
});
