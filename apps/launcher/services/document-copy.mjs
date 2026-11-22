import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, open, readFile, realpath, stat, unlink } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { executeBodyOperations } from '../../editor/src/adapters/rhwp/body-operations.ts';
import { verifyPreservedExport } from '../../editor/src/adapters/rhwp/preservation.ts';
import { validateEditOperations } from '../../editor/src/modules/document/public/index.ts';

const fileLimit = 16 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/u;
const supported = /^(?:hwp|hwpx)$/u;
const baseEngine = '1a76570e833917d15817415a53c09ad61ab3203f';

function inside(root, path) {
  const remainder = relative(root, path);
  if (!remainder || remainder === '..' || remainder.startsWith('..' + sep) || isAbsolute(remainder)) {
    throw new Error('허용한 문서 폴더 안의 파일을 지정하세요.');
  }
  return path;
}

async function loadEngine(root) {
  const engine = await realpath(root);
  const evidence = JSON.parse(await readFile(join(engine, 'jueony-engine-build.json'), 'utf8'));
  const js = join(engine, 'rhwp.js');
  const [jsBytes, wasm] = await Promise.all([readFile(js), readFile(join(engine, 'rhwp_bg.wasm'))]);
  if (evidence.baseCommit !== baseEngine || hash(jsBytes) !== evidence.jsSha256 || hash(wasm) !== evidence.wasmSha256) {
    throw new Error('복원한 문서 엔진의 파일과 해시가 일치하지 않습니다.');
  }
  const module = await import(pathToFileURL(js).href);
  await module.default({module_or_path: wasm});
  return module.HwpDocument;
}

async function boundedRead(root, name) {
  if (typeof name !== 'string' || !name || name.length > 1024 || name.includes('\0')) throw new Error('원본 파일 경로가 필요합니다.');
  const candidate = inside(root, resolve(root, name));
  const path = inside(root, await realpath(candidate));
  const listed = await lstat(candidate);
  if (listed.isSymbolicLink() || !listed.isFile()) throw new Error('실제 문서 파일의 경로를 지정하세요.');
  const file = await open(path, 'r');
  try {
    const entry = await file.stat();
    if (entry.dev !== listed.dev || entry.ino !== listed.ino || entry.size !== listed.size || entry.mtimeMs !== listed.mtimeMs) {
      throw new Error('읽는 동안 문서 항목이 바뀌었습니다.');
    }
    if (!entry.isFile() || !entry.size || entry.size > fileLimit) throw new Error('원본 문서는 1바이트~16MB의 일반 파일이어야 합니다.');
    const buffer = Buffer.alloc(entry.size + 1);
    let total = 0;
    while (total < buffer.length) {
      const {bytesRead} = await file.read(buffer, total, buffer.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    const after = await file.stat();
    if (total !== entry.size || after.mtimeMs !== entry.mtimeMs || after.ctimeMs !== entry.ctimeMs) throw new Error('읽는 동안 원본 파일이 바뀌었습니다.');
    const bytes = buffer.subarray(0, total);
    return {path, bytes, sha256: hash(bytes)};
  } finally { await file.close(); }
}

async function outputPath(root, name, format) {
  if (typeof name !== 'string' || !name || name.length > 1024 || name.includes('\0')) throw new Error('사본의 새 파일 경로가 필요합니다.');
  const candidate = inside(root, resolve(root, name));
  const parent = await realpath(dirname(candidate));
  const output = inside(root, join(parent, basename(candidate)));
  if (extname(output).toLowerCase() !== '.' + format || basename(output).includes(':')) throw new Error('원본과 같은 확장자의 새 사본 경로를 지정하세요.');
  return output;
}

async function publish(output, bytes, assertSource) {
  const temporary = join(dirname(output), '.jueony-copy-' + randomUUID() + '.tmp');
  const handle = await open(temporary, 'wx', 0o600);
  try {
    try { await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
    await assertSource();
    try { await link(temporary, output); }
    catch (error) {
      if (error?.code === 'EEXIST') throw new Error('사본 경로가 이미 사용 중입니다. 비어 있는 이름을 지정하세요.');
      if (['EPERM','EXDEV','ENOSYS','ENOTSUP'].includes(error?.code)) {
        throw new Error('이 폴더에서 사본의 완료된 파일을 공개할 수 없습니다. 하드 링크가 허용되는 로컬 폴더를 지정하세요.');
      }
      throw error;
    }
  } finally { await unlink(temporary).catch(() => {}); }
}

function documentSnapshot(doc, path, sha256) {
  const format = extname(path).slice(1).toLowerCase();
  if (!supported.test(format) || doc.getSourceFormat() !== format) throw new Error('파일 확장자와 한글 문서 형식이 일치하지 않습니다.');
  const editable = JSON.parse(doc.getDocumentMetadata()).editable === true;
  const controls = JSON.parse(doc.getControls());
  const unsupported = new Set(controls.filter(control => control.list === 0 && control.ctrlId !== 'secd' && control.ctrlId !== 'cold').map(control => control.para));
  let characters = 0, flat = 0;
  const nodes = [];
  for (let section = 0; section < doc.getSectionCount(); section++) {
    for (let paragraph = 0; paragraph < doc.getParagraphCount(section); paragraph++, flat++) {
      const length = doc.getParagraphLength(section, paragraph);
      const text = doc.getTextRange(section, paragraph, 0, length);
      characters += text.length;
      if (nodes.length >= 2000 || characters > 120_000) throw new Error('문서 조회 한도인 2,000문단 또는 120,000자를 넘습니다.');
      const runs = length && !unsupported.has(flat) ? JSON.parse(doc.getCharShapeRuns(section, paragraph, 0, length)) : [];
      const uniform = !length || (Array.isArray(runs) && runs.length > 0 && runs.every(run => run.charShapeId === runs[0].charShapeId));
      nodes.push({id:`s${section}p${paragraph}`, section, paragraph, text, editable:editable && uniform && !unsupported.has(flat)});
    }
  }
  return {name:basename(path), format, revision:sha256, nodes,
    limitations:['본문 문단을 조회합니다. 사본 편집은 혼합 글자 서식·필드·개체가 없는 문단만 지원합니다.']};
}

export async function openDocumentCopyService(rootPath, enginePath) {
  if (!rootPath || !enginePath) throw new Error('문서 폴더와 복원한 엔진 경로를 지정하세요.');
  const root = await realpath(rootPath);
  if (!(await stat(root)).isDirectory()) throw new Error('허용 범위는 문서 폴더여야 합니다.');
  const HwpDocument = await loadEngine(enginePath);
  const reopen = bytes => new HwpDocument(bytes);

  return {
    async inspect(source) {
      const input = await boundedRead(root, source);
      const document = reopen(input.bytes);
      try { return documentSnapshot(document, input.path, input.sha256); }
      finally { document.free(); }
    },
    async applyCopy(request) {
      if (!request || !hashPattern.test(request.expectedSha256 ?? '') || !Array.isArray(request.operations) ||
          !request.operations.length || request.operations.some(item => !['replace_body_text','delete_body_text'].includes(item?.kind))) {
        throw new Error('조회한 원본 SHA-256과 본문 교체 또는 삭제 명령을 지정하세요.');
      }
      const source = await boundedRead(root, request.source);
      if (request.expectedSha256 !== source.sha256) throw new Error('조회한 뒤 원본 파일이 바뀌었습니다.');
      const document = reopen(source.bytes);
      let output, bytes, operations;
      try {
        const snapshot = documentSnapshot(document, source.path, source.sha256);
        output = await outputPath(root, request.output, snapshot.format);
        if (relative(source.path, output) === '') throw new Error('사본은 원본과 다른 경로에 저장해야 합니다.');
        operations = validateEditOperations(request.operations, snapshot);
        const replacements = new Map(operations.map(operation => {
          const original = [...snapshot.nodes.find(node => node.id === operation.target).text];
          return [operation.target, [...original.slice(0, operation.start), operation.text ?? '', ...original.slice(operation.start + operation.count)].join('')];
        }));
        if (!snapshot.nodes.some(node => replacements.has(node.id) && replacements.get(node.id) !== node.text)) throw new Error('사본에 적용할 변경이 없습니다.');
        executeBodyOperations(document, snapshot, operations);
        const artifact = snapshot.format === 'hwp' ? document.exportHwpWithReport() : document.exportHwpxWithReport();
        try {
          bytes = artifact.takeBytes();
          verifyPreservedExport(document, bytes, snapshot.format, artifact.contentLoss(), reopen);
        } finally { artifact.free(); }
        const saved = reopen(bytes);
        try {
          const actual = documentSnapshot(saved, output, hash(bytes));
          const expected = snapshot.nodes.map(node => [node.id, replacements.get(node.id) ?? node.text]);
          if (JSON.stringify(actual.nodes.map(node => [node.id, node.text])) !== JSON.stringify(expected)) throw new Error('재열기에서 사본과 원본의 대상 문단을 확인하지 못했습니다.');
        } finally { saved.free(); }
      } finally { document.free(); }
      await publish(output, bytes, async () => {
        const latest = await boundedRead(root, request.source);
        if (source.path !== latest.path || source.sha256 !== latest.sha256) throw new Error('편집 계획 확인 뒤 원본이 변경되어 사본을 만들지 않았습니다.');
      });
      return {status:'saved-copy', output:relative(root, output), bytes:bytes.byteLength, sourceSha256:source.sha256,
        sha256:hash(bytes), operationCount:operations.length, verification:'saved-reopened'};
    },
  };
}
