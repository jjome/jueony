import test from 'node:test';
import assert from 'node:assert/strict';
import {formattingToolbarCommands} from '../src/adapters/rhwp/formatting-toolbar.ts';

function withCatalogs(run: (fixture: any) => void) {
  const runtime = globalThis as any, previousWindow = runtime.window, previousDocument = runtime.document;
  runtime.document = new EventTarget(); runtime.window = {jueonyEditor: {busy: () => false}};
  const catalogs = Array.from({length: 7}, (_, language) => Array.from({length: language + 2}, (_, index) => index === language ? '지정 글꼴' : `원래${language}-${index}`));
  const existing = catalogs.map(list => list[1]), emitted: any[] = [], resolved: any[] = [];
  const input = {active: true, cursor: {}, getCharProperties: () => ({fontFamilies: existing})};
  const services = {
    getContext: () => ({hasDocument: true, isEditable: true, isFormMode: false}), getInputHandler: () => input,
    wasm: {
      findOrCreateFontId() { throw Error('A Korean resource ID cannot identify the same name in every language'); },
      findOrCreateFontIdForLang(language: number, name: string) { resolved.push({language, name}); return catalogs[language].indexOf(name); },
    },
    eventBus: {emit: (type: string, properties: any) => emitted.push({type, properties})},
  };
  try { run({catalogs, existing, emitted, resolved, services}); }
  finally { if (previousWindow === undefined) delete runtime.window; else runtime.window = previousWindow; if (previousDocument === undefined) delete runtime.document; else runtime.document = previousDocument; }
}

test('all-language font selection resolves names independently across differently ordered catalogs', () => withCatalogs(({catalogs, emitted, resolved, services}) => {
  const before = structuredClone(catalogs);
  formattingToolbarCommands[0]!.execute(services, {name: '지정 글꼴', language: 'all'});
  assert.equal(emitted.length, 1); assert.equal(emitted[0].type, 'format-char');
  assert.deepEqual(emitted[0].properties.fontIds.map((id: number, language: number) => catalogs[language][id]), Array(7).fill('지정 글꼴'));
  assert.deepEqual(resolved.map((value: any) => value.language), [0, 1, 2, 3, 4, 5, 6]); assert.deepEqual(catalogs, before);
}));

test('single-language selection keeps all other declared family names and emits one edit', () => withCatalogs(({catalogs, existing, emitted, services}) => {
  formattingToolbarCommands[0]!.execute(services, {name: '지정 글꼴', language: 4});
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0].properties.fontIds.map((id: number, language: number) => catalogs[language][id]), existing.map((name: string, language: number) => language === 4 ? '지정 글꼴' : name));
}));

test('invalid language resource IDs refuse the text-format commit', () => withCatalogs(({emitted, services}) => {
  const original = services.wasm.findOrCreateFontIdForLang;
  services.wasm.findOrCreateFontIdForLang = (language: number, name: string) => language === 3 ? -1 : original(language, name);
  assert.throws(() => formattingToolbarCommands[0]!.execute(services, {name: '지정 글꼴', language: 'all'}), /등록/);
  assert.deepEqual(emitted, []);
}));
