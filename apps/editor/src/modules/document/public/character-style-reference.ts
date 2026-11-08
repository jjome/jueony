/**
 * Stable, document-local reference to a stored character-style definition.
 *
 * Direct formatting is deliberately a different request kind. A caller cannot
 * accidentally pass visible character properties where a durable definition
 * link is required.
 */
export type StoredCharacterStyleReference = Readonly<{
  kind: 'stored-character-style';
  version: 1;
  styleId: number;
  charShapeId: number;
  definitionSha256: string;
}>;

export type DirectCharacterFormattingRequest = Readonly<{
  kind: 'direct-character-formatting';
  properties: Readonly<Record<string, unknown>>;
}>;

export type CharacterFormattingRequest = StoredCharacterStyleReference | DirectCharacterFormattingRequest;
