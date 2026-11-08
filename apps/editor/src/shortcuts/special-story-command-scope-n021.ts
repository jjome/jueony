import type {ShortcutStoryKindN021} from './special-story-context-n021.ts';

export type SpecialStoryShortcutContractN021 =
  | 'input-handler-submode-global'
  | 'registry-document-save';

export type SpecialStoryShortcutPermissionN021 = Readonly<{
  contract: SpecialStoryShortcutContractN021;
  stories: readonly Exclude<ShortcutStoryKindN021, 'body' | 'unknown'>[];
}>;

const exactStories = Object.freeze([
  'header',
  'footer',
  'footnote',
  'endnote',
  'textbox',
] as const);

/**
 * Narrow allow-list backed by the pinned Studio contracts.
 *
 * - InputHandler's `SUBMODE_GLOBAL_COMMANDS` explicitly dispatches undo,
 *   redo, goto and select-all before the header/footer and note early returns.
 *   Textbox editing uses the ordinary dispatcher route for the same commands.
 * - `file:save` is a registry command whose admission is only `hasDocument`
 *   and whose executor serializes the active document; it does not reinterpret
 *   the current cursor as a body cursor.
 *
 * Save As, print, view commands and every content/format command remain absent
 * until their focus, dialog and story semantics have equally narrow evidence.
 */
export const specialStoryShortcutPermissionsN021 = Object.freeze({
  'edit:undo': Object.freeze({contract: 'input-handler-submode-global', stories: exactStories}),
  'edit:redo': Object.freeze({contract: 'input-handler-submode-global', stories: exactStories}),
  'edit:goto': Object.freeze({contract: 'input-handler-submode-global', stories: exactStories}),
  'edit:select-all': Object.freeze({contract: 'input-handler-submode-global', stories: exactStories}),
  'file:save': Object.freeze({contract: 'registry-document-save', stories: exactStories}),
} satisfies Record<string, SpecialStoryShortcutPermissionN021>);

export type SpecialStorySafeCommandN021 = keyof typeof specialStoryShortcutPermissionsN021;

export function isExactSpecialStoryShortcutAllowedN021(
  command: string,
  story: ShortcutStoryKindN021,
): boolean {
  if (story === 'body' || story === 'unknown') return false;
  const permission = specialStoryShortcutPermissionsN021[command as SpecialStorySafeCommandN021];
  return Boolean(permission && permission.stories.includes(story));
}
