import { parseStyleGalleryProfile, validateStyleGalleryProfile } from '../../modules/document/public/style-gallery-profile.ts';
import type { StyleGalleryProfile } from '../../modules/document/public/style-gallery-profile.ts';

export const STYLE_GALLERY_PROFILE_KEY = 'jueony-style-gallery-profile';
export type StyleGalleryProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Fail closed so corrupt or newer institution policy is never silently replaced. */
export function createStyleGalleryProfileStore(storage: StyleGalleryProfileStorage) {
  function read(): StyleGalleryProfile | undefined {
    let raw: string | null;
    try { raw = storage.getItem(STYLE_GALLERY_PROFILE_KEY); } catch { throw new Error('스타일마당 프로필을 읽지 못했습니다.'); }
    if (raw === null) return;
    return parseStyleGalleryProfile(raw);
  }
  function save(value: unknown): StyleGalleryProfile {
    // Refuse to overwrite a corrupt/newer record; a user must export or reset it explicitly.
    read();
    const checked = validateStyleGalleryProfile(value), raw = JSON.stringify(checked);
    try { storage.setItem(STYLE_GALLERY_PROFILE_KEY, raw); } catch { throw new Error('스타일마당 프로필을 저장하지 못했습니다. 기존 설정을 유지합니다.'); }
    return checked;
  }
  return { read, save };
}
