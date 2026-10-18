import {sha256} from '@noble/hashes/sha2.js';
import {createDocumentHistory,historyScopeKey} from '../../modules/document-files/public/index.ts';
import type {HistoryScope,HistoryOwner} from '../../modules/document-files/public/index.ts';
import {indexedDbDocumentHistory} from '../storage/document-history.ts';

let binding: {scope: HistoryScope; owner: () => HistoryOwner} | undefined;
export function documentHistoryAvailable(): boolean {return Boolean(binding?.owner().available && typeof indexedDB !== 'undefined');}
/** The authenticated host passes stable IDs through the same-bundle facade, never URL/file names. */
export function configureDocumentHistoryScope(scope: HistoryScope, owner: () => HistoryOwner): void {
  // Parent and iframe have distinct Object.prototype identities. Normalize the
  // trusted DTO into this realm before strict record-shape validation.
  const ownedScope=structuredClone(scope),key = historyScopeKey(ownedScope);
  if (binding && historyScopeKey(binding.scope) !== key) throw Error('열린 편집기의 문서 이력 범위를 바꿀 수 없습니다.');
  binding = {scope: ownedScope, owner};
}
export function openDocumentHistory() {
  if (!binding) throw Error('문서 이력은 업무 문서 탭에서 지원합니다. 업무 화면에서 문서를 여세요.');
  if (typeof indexedDB === 'undefined') throw Error('문서 이력을 지속 저장할 수 없어 작업을 시작하지 않았습니다.');
  return createDocumentHistory({...binding, records: indexedDbDocumentHistory(indexedDB), digest: value =>
    Array.from(sha256(new TextEncoder().encode(JSON.stringify(value))), b => b.toString(16).padStart(2,'0')).join('')});
}
