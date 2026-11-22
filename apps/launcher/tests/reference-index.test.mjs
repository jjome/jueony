import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createReferenceIndex } from '../services/reference-index.mjs';

test('FTS index updates selectively, survives restart, and isolates each selection', async () => {
  const dir = await mkdtemp(resolve(tmpdir(),'jueony-fts-'));
  const file = resolve(dir,'index.sqlite');
  const record = (letter, token) => ({id:letter.repeat(64),title:[token],body:[token]});
  const a = { workspaceId:'one',chatId:'chat',chunks:[record('a','준비'),record('b','예산')],query:['예산'] };
  const b = { workspaceId:'two',chatId:'chat',chunks:[record('c','예산')],query:['예산'] };
  let index;
  try {
    index = await createReferenceIndex(file);
    assert.deepEqual(index.updateAndSearch(a).hits.map(h=>h.id), ['b'.repeat(64)]);
    assert.equal(index.updateAndSearch(b).hits.length,1);
    index.close();index = await createReferenceIndex(file);
    assert.equal(index.updateAndSearch(a).inserted,0);
    const next = index.updateAndSearch({...a,chunks:[record('a','준비'),record('d','장비')]});
    assert.deepEqual(next,{hits:[],inserted:1,deleted:1});
    assert.deepEqual(index.clear({workspaceId:'one'}),{cleared:true});
    assert.equal(index.updateAndSearch(a).inserted,2);
    assert.equal(index.updateAndSearch(b).inserted,0);
    index.close();index = undefined;
    assert.equal((await readFile(file)).includes(Buffer.from('예산')),false);
    const bad = resolve(dir,'damaged.sqlite');await writeFile(bad,'corrupt');
    await assert.rejects(createReferenceIndex(bad));
    assert.equal((await readFile(bad,'utf8')),'corrupt');
  } finally {
    index?.close();
    await rm(file,{force:true});
    await rm(resolve(dir,'damaged.sqlite'),{force:true});
    await rmdir(dir);
  }
});
