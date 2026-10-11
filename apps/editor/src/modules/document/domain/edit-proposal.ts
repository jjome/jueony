import type { Snapshot, EditProposal } from '../public/types.ts';
import { validateEditOperations } from './edit-operations.ts';
export function validateEditProposal(raw: unknown, snapshot: Snapshot, sourceIds: string[]): EditProposal {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('응답이 JSON 객체가 아닙니다.');
 const value = raw as Record<string, unknown>;
 if (Object.keys(value).some(key => !['message', 'operations', 'sourceIds'].includes(key))) throw new Error('지원하지 않는 응답 필드입니다.');
 if (typeof value.message !== 'string' || value.message.length > 6000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value.message)) throw new Error('텍스트 형식/길이가 잘못되었습니다.');
 if (!Array.isArray(value.sourceIds) || value.sourceIds.some(id => typeof id !== 'string' || !sourceIds.includes(id))) throw new Error('알 수 없는 출처입니다.');
 return {message:value.message, operations:validateEditOperations(value.operations,snapshot), sourceIds:value.sourceIds as string[]};
}
