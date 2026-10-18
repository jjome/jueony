// Independent ZIP fixture reader/writer for preservation regressions.
// Small, unencrypted, non-ZIP64 test packages only; never touches user files.
import assert from 'node:assert/strict';
import {inflateRawSync, deflateRawSync} from 'node:zlib';

const MAX_PART = 16 * 1024 * 1024;
const table = Array.from({length: 256}, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc32 = bytes => {
  let n = 0xffffffff;
  for (const byte of bytes) n = table[(n ^ byte) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
};

export function readOwnedZip(value, {allowDuplicates = false} = {}) {
  const b = Buffer.from(value), parts = []; let end = -1;
  for (let p = b.length - 22; p >= Math.max(0, b.length - 65557); p--) {
    if (b.readUInt32LE(p) === 0x06054b50 && p + 22 + b.readUInt16LE(p + 20) === b.length) {end = p; break;}
  }
  assert.ok(end >= 0, 'ZIP end directory');
  assert.equal(b.readUInt16LE(end + 4), 0); assert.equal(b.readUInt16LE(end + 6), 0);
  assert.equal(b.readUInt16LE(end + 8), b.readUInt16LE(end + 10));
  const names = new Set(); let p = b.readUInt32LE(end + 16), total = 0;
  for (let i = 0; i < b.readUInt16LE(end + 10); i++) {
    assert.equal(b.readUInt32LE(p), 0x02014b50);
    const flags = b.readUInt16LE(p + 8), method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20);
    const length = b.readUInt32LE(p + 24), nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30);
    const cl = b.readUInt16LE(p + 32), local = b.readUInt32LE(p + 42);
    assert.equal(flags & 1, 0, 'encrypted test package'); assert.ok(length <= MAX_PART, 'part budget');
    total += length; assert.ok(total <= 64 * 1024 * 1024, 'package budget');
    const name = b.subarray(p + 46, p + 46 + nl).toString('utf8');
    assert.equal(b.readUInt32LE(local), 0x04034b50);
    assert.equal(b.readUInt16LE(local + 8), method);
    const localNameLength = b.readUInt16LE(local + 26), start = local + 30 + localNameLength + b.readUInt16LE(local + 28);
    assert.equal(b.subarray(local + 30, local + 30 + localNameLength).toString('utf8'), name);
    assert.ok(start + size <= b.readUInt32LE(end + 16), 'part overlaps directory');
    const packed = b.subarray(start, start + size);
    const bytes = method === 0 ? Buffer.from(packed) : method === 8 ? inflateRawSync(packed, {maxOutputLength: MAX_PART}) : assert.fail('ZIP compression');
    assert.equal(bytes.length, length); assert.equal(crc32(bytes), b.readUInt32LE(p + 16));
    if (!allowDuplicates) assert.ok(!names.has(name), 'duplicate ZIP entry: ' + name);
    names.add(name); parts.push([name, bytes]); p += 46 + nl + el + cl;
  }
  assert.equal(p, end, 'unexpected directory bytes'); return parts;
}

// Accepts entries rather than a Map so negative tests can create duplicates.
export function writeOwnedZip(parts) {
  const locals = [], central = []; let offset = 0;
  assert.ok(parts.length < 65535);
  for (const [name, value] of parts) {
    const bytes = Buffer.from(value), n = Buffer.from(name), method = name === 'mimetype' ? 0 : 8;
    assert.ok(n.length < 65535); assert.ok(bytes.length <= MAX_PART);
    const packed = method === 0 ? bytes : deflateRawSync(bytes), crc = crc32(bytes), l = Buffer.alloc(30), c = Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt16LE(0x800, 6); l.writeUInt16LE(method, 8);
    l.writeUInt32LE(crc, 14); l.writeUInt32LE(packed.length, 18); l.writeUInt32LE(bytes.length, 22); l.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(method, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(bytes.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    locals.push(l, n, packed); central.push(c, n); offset += l.length + n.length + packed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(parts.length, 8); end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
