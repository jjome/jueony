import { validateStylePackage } from './style-package.ts';
import type { StylePackage } from './style-package.ts';

type StyleSlotAssignment = { slot: number; styleName: string };

export type StyleGalleryEntry = { id: string; label: string; package: StylePackage };
export type StyleGalleryProfile = {
  format: 'jueony-style-gallery-profile';
  version: 1;
  id: string;
  name: string;
  organization: string;
  gallery: StyleGalleryEntry[];
  shortcuts: StyleSlotAssignment[];
};

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('스타일마당 프로필 항목 형식이 올바르지 않습니다.');
  return value as Record<string, unknown>;
};
const text = (value: unknown, label: string, max = 120): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label}을(를) 확인하세요.`);
  return value.normalize('NFC');
};
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]) => {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('지원하지 않는 스타일마당 프로필 속성이 있습니다.');
};

export function validateStyleGalleryProfile(value: unknown): StyleGalleryProfile {
  const source = record(value);
  exactKeys(source, ['format', 'version', 'id', 'name', 'organization', 'gallery', 'shortcuts']);
  if (source.format !== 'jueony-style-gallery-profile' || source.version !== 1) throw new Error('지원하는 스타일마당 프로필은 v1입니다.');
  const id = text(source.id, '프로필 ID', 80), name = text(source.name, '프로필 이름'), organization = text(source.organization, '기관 이름');
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(id)) throw new Error('프로필 ID는 영문 소문자·숫자·점·밑줄·붙임표만 사용할 수 있습니다.');
  if (!Array.isArray(source.gallery) || source.gallery.length > 32 || !Array.isArray(source.shortcuts) || source.shortcuts.length > 10 || source.gallery.length + source.shortcuts.length < 1) throw new Error('프로필에는 1개 이상의 스타일마당 또는 번호키 지정이 필요합니다.');
  const entryIds = new Set<string>(), labels = new Set<string>();
  const gallery = source.gallery.map(raw => {
    const entry = record(raw); exactKeys(entry, ['id', 'label', 'package']);
    const entryId = text(entry.id, '스타일마당 ID', 80), label = text(entry.label, '스타일마당 이름');
    if (!/^[a-z0-9][a-z0-9._-]*$/u.test(entryId)) throw new Error('스타일마당 ID 형식을 확인하세요.');
    const normalizedLabel = label.toLocaleLowerCase('ko-KR');
    if (entryIds.has(entryId) || labels.has(normalizedLabel)) throw new Error('스타일마당 ID 또는 이름이 중복됩니다.');
    entryIds.add(entryId); labels.add(normalizedLabel);
    return { id: entryId, label, package: validateStylePackage(entry.package) };
  });
  const slots = new Set<number>();
  const shortcuts = source.shortcuts.map(raw => {
    const assignment = record(raw); exactKeys(assignment, ['slot', 'styleName']);
    if (typeof assignment.slot !== 'number' || !Number.isInteger(assignment.slot) || assignment.slot < 0 || assignment.slot > 9 || slots.has(assignment.slot)) throw new Error('번호키 지정은 0~9에서 중복 없이 선택해야 합니다.');
    slots.add(assignment.slot);
    return { slot: assignment.slot, styleName: text(assignment.styleName, '번호키 스타일 이름', 250) };
  }).sort((left, right) => left.slot - right.slot);
  return { format: 'jueony-style-gallery-profile', version: 1, id, name, organization, gallery, shortcuts };
}

export function parseStyleGalleryProfile(source: string): StyleGalleryProfile {
  if (typeof source !== 'string' || source.length > 2_000_000) throw new Error('스타일마당 프로필은 2MB 이하여야 합니다.');
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error('스타일마당 프로필 JSON 형식을 확인하세요.'); }
  return validateStyleGalleryProfile(value);
}
