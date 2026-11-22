import type { RetrievalIndex, RetrievalScope } from '../public/contracts.ts';

export interface RankedIndexPort {
  rank(index: RetrievalIndex, query: string, signal?: AbortSignal): Promise<ReadonlyMap<string, number>>;
  clear(scope: Pick<RetrievalScope, 'workspaceId'> & Partial<Pick<RetrievalScope, 'chatId'>>): Promise<void>;
}
