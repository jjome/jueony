export function assertSaveRevision(expected: unknown, actual: string) {
 if(typeof expected!=='string'||expected!==actual)throw new Error('저장 준비 중 문서가 바뀌었습니다. 다시 저장해 주세요.');
}
