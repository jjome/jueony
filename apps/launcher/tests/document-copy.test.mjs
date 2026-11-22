import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { openDocumentCopyService } from '../services/document-copy.mjs';

test('a verified HWP/HWPX copy survives reopen and refuses a stale source, an existing target, and directory escape', {
  skip: !process.env.JUEONY_ENGINE_PACKAGE && 'requires the restored Jueony engine',
}, async () => {
  const pkg = resolve(process.env.JUEONY_ENGINE_PACKAGE);
  const wasm = await import(pathToFileURL(join(pkg, 'rhwp.js')).href);
  await wasm.default({module_or_path:await readFile(join(pkg, 'rhwp_bg.wasm'))});
  const root = await mkdtemp(join(tmpdir(), 'jueony-doc-copy-'));
  try {
    const service = await openDocumentCopyService(root, pkg);
    for (const format of ['hwp', 'hwpx']) {
      const sourceName = 'source.' + format;
      const output = 'copy.' + format;
      const doc = wasm.HwpDocument.createEmpty();
      let original;
      try {
        doc.createBlankDocument();
        doc.insertText(0,0,0,'이전 내용');
        original = format === 'hwp' ? doc.exportHwp() : doc.exportHwpx();
      } finally { doc.free(); }
      await writeFile(join(root, sourceName), original);
      const info = await service.inspect(sourceName);
      assert.equal(info.nodes[0].text, '이전 내용');
      assert.equal(info.nodes[0].editable, true);
      const request = {source:sourceName, output, expectedSha256:info.revision,
        operations:[{kind:'replace_body_text',target:'s0p0',start:0,count:2,text:'새'}]};
      await assert.rejects(service.applyCopy({...request,output:sourceName}), /다른 경로/);
      await assert.rejects(service.applyCopy({...request,output:'../outside.' + format}), /허용한/);
      await assert.rejects(service.applyCopy({...request,expectedSha256:'0'.repeat(64)}), /원본 파일이 바뀌었습니다/);
      const result = await service.applyCopy(request);
      assert.equal(result.verification, 'saved-reopened');
      assert.equal((await service.inspect(output)).nodes[0].text, '새 내용');
      assert.deepEqual(new Uint8Array(await readFile(join(root, sourceName))), original);
      await assert.rejects(service.applyCopy(request), /사용 중/);
      assert.equal((await service.inspect(output)).revision, result.sha256);
    }
    assert.equal((await readdir(root)).length, 4);
  } finally { await rm(root, {recursive:true,force:true}); }
});
