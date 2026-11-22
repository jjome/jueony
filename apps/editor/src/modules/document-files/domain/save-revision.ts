export function assertSaveRevision(expected: unknown, actual: string) {
 if(typeof expected!=='string'||expected!==actual)throw new Error('저장 준비 중 문서가 바뀌었습니다. 다시 저장해 주세요.');
}

export const saveSourceConflictMessage='다른 프로그램에서 원본 파일을 변경했습니다. 다른 이름으로 저장하거나 원본을 다시 열어 주세요.';

export class SaveSourceConflictError extends Error {
 constructor(){super(saveSourceConflictMessage);this.name='SaveSourceConflictError';}
}
