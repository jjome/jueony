import assert from 'node:assert/strict';
import test from 'node:test';
import {directionCopyName, requireDistinctDirectionCopy} from '../src/adapters/files/direction-save-copy.ts';

test('suggests a distinct HWPX name for a matching document title or backing file', () => {
  assert.equal(directionCopyName('계획.hwpx','계획.HWPX',null),'계획 (글 방향 보존).hwpx');
  assert.equal(directionCopyName('계획.hwpx','다른 제목',{name:'계획.hwpx'.normalize('NFD')}),'계획 (글 방향 보존).hwpx');
  assert.equal(directionCopyName('결과.hwpx','계획.hwpx',null),'결과.hwpx');
});

test('a bound original requires evidence that the destination is a distinct file', async () => {
  const source={name:'본문.hwpx'};
  await assert.rejects(requireDistinctDirectionCopy(source,source.name,source),/원본 파일/);
  await assert.rejects(requireDistinctDirectionCopy({name:'alias.hwpx',isSameEntry:async()=>true},source.name,source),/원본 파일/);
  await assert.rejects(requireDistinctDirectionCopy({name:'사본.hwpx'},source.name,source),/원본 파일/);
  await requireDistinctDirectionCopy({name:source.name,isSameEntry:async()=>false},source.name,source);
});

test('unbound documents can save to a distinct name while retaining their source', async () => {
  await assert.rejects(requireDistinctDirectionCopy({name:'본문.hwpx'.normalize('NFD')},'본문.HWPX',null),/원본 파일/);
  await requireDistinctDirectionCopy({name:'사본.hwpx'},'본문.hwpx',null);
});
