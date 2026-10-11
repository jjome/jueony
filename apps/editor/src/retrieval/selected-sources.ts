// Compatibility entry. New consumers use the References facade.
export type {RetrievalScope,SourceChunk,RetrievalHit,RetrievalSummary,RetrievalIndex,RetrievedSource} from '../modules/references/public/index.ts';
import {references} from '../composition/references.ts';
export const indexSelectedSources=references.index;
export const searchSelectedSources=references.search;
