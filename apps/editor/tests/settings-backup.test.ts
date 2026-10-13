import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsBackup, parseSettingsBackup, projectEditorSettings, defaultDocumentDefaults, captureSettingsVersion, importSettingsBackup, SETTINGS_BACKUP_KEYS } from '../src/modules/preferences/public/index.ts';
const settings = () => ({ version: 1, font: { fontSets: [], showRecentFonts: true, recentFontCount: 3 }, theme: { mode: 'light', skin: 'default', skinChosen: true }, dialog: { picturePropsKeepRatio: true, showPdfPrintGuidance: true }, view: { showParagraphMarks: false, showControlCodes: false, clipView: true, toolbarBasic: true, toolbarFormat: true, pageArrangement: { kind: 'single' }, pageMovement: { direction: 'vertical', wheelHorizontal: true }, zoomFitMode: 'none' }, autosave: { recoveryEnabled: true, recoveryIntervalMinutes: 10, idleSaveEnabled: true, idleDelaySeconds: 10 } });
function store(initial: [string, string][] = []) { const values = new Map(initial); return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } }; }
test('environment export is an explicit detached projection with no credential or content fields', () => {
  const source: any = settings(); source.apiKey = 'synthetic-secret'; source.view.conversation = 'synthetic-message';
  const backup = createSettingsBackup(source, defaultDocumentDefaults()), text = JSON.stringify(backup);
  assert.equal(text.includes('synthetic-'), false); assert.deepEqual(parseSettingsBackup(text), backup); backup.settings.view.toolbarBasic = false; assert.equal(source.view.toolbarBasic, true);
});
test('backup rejects bad version, broken types, large data, malformed JSON and excessive values', () => {
  const backup = createSettingsBackup(settings(), defaultDocumentDefaults());
  for (const text of ['broken', '{}', JSON.stringify({ ...backup, version: 2 }), ' '.repeat(256001)]) assert.throws(() => parseSettingsBackup(text));
  for (const edit of [(v: any) => { v.version = 2; }, (v: any) => { v.view.toolbarBasic = 'true'; }, (v: any) => { v.autosave.idleDelaySeconds = 1; }, (v: any) => { v.view.pageArrangement = { kind: 'multiple', rows: 9, columns: 1 }; }]) { const value = settings(); edit(value); assert.throws(() => projectEditorSettings(value)); }
});
test('import preserves local unknown fields, validates input first and refuses concurrently changed settings', () => {
  const source: any = settings(); source.futureSetting = 7; source.view.futureSetting = 9;
  const defaults: any = defaultDocumentDefaults(); defaults.futureSetting = 11;
  const storage = store([[SETTINGS_BACKUP_KEYS[0], JSON.stringify(source)], [SETTINGS_BACKUP_KEYS[1], JSON.stringify(defaults)]]), before = captureSettingsVersion(storage), imported = settings(); imported.view.showControlCodes = true;
  importSettingsBackup(storage, JSON.stringify(createSettingsBackup(imported, defaultDocumentDefaults())), before);
  assert.equal(JSON.parse(storage.getItem(SETTINGS_BACKUP_KEYS[0])!).futureSetting, 7); assert.equal(JSON.parse(storage.getItem(SETTINGS_BACKUP_KEYS[0])!).view.futureSetting, 9); assert.equal(JSON.parse(storage.getItem(SETTINGS_BACKUP_KEYS[0])!).view.showControlCodes, true); assert.equal(JSON.parse(storage.getItem(SETTINGS_BACKUP_KEYS[1])!).futureSetting, 11);
  const unchanged = captureSettingsVersion(storage); assert.throws(() => importSettingsBackup(storage, JSON.stringify(createSettingsBackup(imported, defaults)), before), /다른 창/); assert.deepEqual(captureSettingsVersion(storage), unchanged);
});
test('second write failure restores first write, including initially absent settings', () => {
  for (const initial of [[], [[SETTINGS_BACKUP_KEYS[0], JSON.stringify(settings())]]] as [string, string][][]) {
    const storage = store(initial), before = captureSettingsVersion(storage), set = storage.setItem;
    storage.setItem = (key, value) => { if (key === SETTINGS_BACKUP_KEYS[1]) throw new Error('synthetic quota'); set(key, value); };
    const incoming = settings(); incoming.view.showControlCodes = true;
    assert.throws(() => importSettingsBackup(storage, JSON.stringify(createSettingsBackup(incoming, defaultDocumentDefaults())), before), /복구했습니다/); assert.deepEqual(captureSettingsVersion(storage), before);
  }
});
test('corrupt existing settings are never overwritten by import', () => {
  for (const key of SETTINGS_BACKUP_KEYS) { const storage = store([[key, '{broken']]), before = captureSettingsVersion(storage); assert.throws(() => importSettingsBackup(storage, JSON.stringify(createSettingsBackup(settings(), defaultDocumentDefaults())), before), /손상/); assert.deepEqual(captureSettingsVersion(storage), before); }
});
