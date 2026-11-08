import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStyleGalleryProfile } from '../src/modules/document/domain/style-gallery-profile.ts';
import { createStyleGalleryProfileStore, STYLE_GALLERY_PROFILE_KEY } from '../src/adapters/browser/style-gallery-profile.ts';
import { resolveStyleSlot } from '../src/shortcuts/style-slots.ts';

const shape = () => ({ fontFamilies: Array(7).fill('함초롬바탕'), fontSize: 1000, bold: false, italic: false, underline: false, strikethrough: false, subscript: false, superscript: false, emboss: false, engrave: false, kerning: false, underlineColor: '#000000', strikeColor: '#000000', textColor: '#000000', shadeColor: '#ffffff', shadowColor: '#000000', underlineType: 'None', shadowType: 0, outlineType: 0, emphasisDot: 0, underlineShape: 0, strikeShape: 0, shadowOffsetX: 0, shadowOffsetY: 0, ratios: Array(7).fill(100), spacings: Array(7).fill(0), relativeSizes: Array(7).fill(100), charOffsets: Array(7).fill(0) });
const para = () => ({ alignment: 'justify', lineSpacingType: 'Percent', lineSpacing: 160, marginLeft: 0, marginRight: 0, indent: 0, spacingBefore: 0, spacingAfter: 0, widowOrphan: false, keepWithNext: false, keepLines: false, pageBreakBefore: false, fontLineHeight: false, singleLine: false, autoSpaceKrEn: false, autoSpaceKrNum: false, verticalAlign: 0, englishBreakUnit: 0, koreanBreakUnit: 0 });
const profile = () => ({ format: 'jueony-style-gallery-profile', version: 1, id: 'ministry.report', name: '기관 보고서', organization: '시험 기관', gallery: [{ id: 'annual', label: '연간 계획서', package: { format: 'jueony-styles', version: 1, styles: [{ name: '기관 제목', englishName: 'AgencyTitle', type: 0, next: 0, char: shape(), para: para() }] } }], shortcuts: [{ slot: 0, styleName: '기관 제목' }, { slot: 9, styleName: '기관 본문' }] });

test('institution gallery profile validates packages, conflicts and deterministic shortcut order', () => {
  const checked = validateStyleGalleryProfile({ ...profile(), shortcuts: profile().shortcuts.toReversed() });
  assert.deepEqual(checked.shortcuts.map(value => value.slot), [0, 9]);
  assert.throws(() => validateStyleGalleryProfile({ ...profile(), gallery: [...profile().gallery, { ...profile().gallery[0] }] }), /중복/);
  assert.throws(() => validateStyleGalleryProfile({ ...profile(), shortcuts: [{ slot: 0, styleName: 'A' }, { slot: 0, styleName: 'B' }] }), /중복/);
  assert.throws(() => validateStyleGalleryProfile({ ...profile(), futurePolicy: true }), /지원하지 않는/);
});

test('profile survives restart and corrupt/newer records are never overwritten', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const first = createStyleGalleryProfileStore(storage); first.save(profile());
  const reopened = createStyleGalleryProfileStore(storage).read(); assert.deepEqual(reopened, validateStyleGalleryProfile(profile()));
  const before = values.get(STYLE_GALLERY_PROFILE_KEY)!;
  values.set(STYLE_GALLERY_PROFILE_KEY, JSON.stringify({ ...profile(), version: 2 }));
  assert.throws(() => first.save(profile()), /v1/); assert.notEqual(values.get(STYLE_GALLERY_PROFILE_KEY), before); assert.match(values.get(STYLE_GALLERY_PROFILE_KEY)!, /"version":2/);
  values.set(STYLE_GALLERY_PROFILE_KEY, '{broken'); assert.throws(() => first.save(profile()), /JSON/); assert.equal(values.get(STYLE_GALLERY_PROFILE_KEY), '{broken');
});

test('storage failures are explicit and retain the last valid profile', () => {
  let raw: string | null = null, reject = false;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { if (reject) throw new Error('quota'); raw = value; } };
  const store = createStyleGalleryProfileStore(storage); store.save(profile()); const before = raw;
  reject = true;
  assert.throws(() => store.save({ ...profile(), name: '변경 프로필' }), /기존 설정을 유지/);
  assert.equal(raw, before);
});

test('user number slots resolve exact styles and fail closed after rename, deletion or ambiguity', () => {
  const assignment = [{ slot: 0, styleName: '기관 제목' }], styles = [{ id: 31, name: '기관 제목' }, { id: 8, name: '바탕글' }];
  assert.equal(resolveStyleSlot(styles, 0, assignment), 31);
  assert.equal(resolveStyleSlot([{ id: 31, name: '변경된 제목' }, { id: 8, name: '바탕글' }], 0, assignment), undefined);
  assert.equal(resolveStyleSlot([{ id: 31, name: '기관 제목' }, { id: 32, name: '기관 제목' }], 0, assignment), undefined);
  assert.equal(resolveStyleSlot(styles, 1, assignment), undefined);
  assert.equal(resolveStyleSlot([{ id: 8, name: '바탕글' }], 0), 8);
});
