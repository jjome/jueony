"""Read-only TTC/name/cmap4/hmtx audit. Never exports font tables or bytes."""
from pathlib import Path
from collections import Counter
import argparse
import bisect
import hashlib
import json
import struct

parser = argparse.ArgumentParser()
parser.add_argument('--font', default='C:/Windows/Fonts/gulim.ttc')
parser.add_argument('--source-raw', default='build/file-closure69-public/typography-residual-candidate70/native-baseline/unclaimed-raw.json')
parser.add_argument('--output', default='build/Python3-width-own76/review76/installed-font-numeric-proof.json')
args = parser.parse_args()
blob = Path(args.font).read_bytes()
u16 = lambda offset: struct.unpack_from('>H', blob, offset)[0]
s16 = lambda offset: struct.unpack_from('>h', blob, offset)[0]
u32 = lambda offset: struct.unpack_from('>I', blob, offset)[0]
assert blob[:4] == b'ttcf'
selected = None
for index in range(u32(8)):
    offset = u32(12 + 4 * index)
    tables = {blob[offset + 12 + 16 * j:offset + 16 + 16 * j].decode():
              u32(offset + 20 + 16 * j) for j in range(u16(offset + 4))}
    nt = tables['name']
    names = []
    for j in range(u16(nt + 2)):
        platform, encoding, language, name_id, length, start = struct.unpack_from('>6H', blob, nt + 6 + 12 * j)
        if platform == 3 and name_id == 6:
            begin = nt + u16(nt + 4) + start
            names.append(blob[begin:begin + length].decode('utf-16be'))
    if 'GulimChe' in names:
        assert selected is None, 'ambiguous PostScript face'
        selected = tables
assert selected is not None
tables = selected
cm = tables['cmap']
sub = None
for index in range(u16(cm + 2)):
    platform, encoding, offset = struct.unpack_from('>HHI', blob, cm + 4 + 8 * index)
    if platform == 3 and encoding == 1 and u16(cm + offset) == 4:
        sub = cm + offset
assert sub is not None, 'measured BMP cmap4 is required'
segments = u16(sub + 6) // 2
ends = [u16(sub + 14 + 2 * index) for index in range(segments)]

def glyph(codepoint):
    index = bisect.bisect_left(ends, codepoint)
    assert index < segments
    start = u16(sub + 16 + 2 * segments + 2 * index)
    assert codepoint >= start
    delta = s16(sub + 16 + 4 * segments + 2 * index)
    position = sub + 16 + 6 * segments + 2 * index
    distance = u16(position)
    if distance == 0:
        return (codepoint + delta) & 65535
    value = u16(position + distance + 2 * (codepoint - start))
    return (value + delta) & 65535 if value else 0

metric_count = u16(tables['hhea'] + 34)
em = u16(tables['head'] + 18)

def advance(character):
    gid = glyph(ord(character))
    return u16(tables['hmtx'] + 4 * min(gid, metric_count - 1))

metrics = [{'unicode': f'U+{codepoint:04X}', 'glyphId': glyph(codepoint),
            'advanceUnits': advance(chr(codepoint))}
           for codepoint in [0xAC00, 0xB098, 0x0020, 0x002E, 0xC791]]
assert [entry['advanceUnits'] for entry in metrics] == [1024, 1024, 512, 512, 1024]
proof = {'fontPath': str(Path(args.font).resolve()), 'fontSha256': hashlib.sha256(blob).hexdigest(),
         'fontBytes': len(blob), 'face': 'GulimChe', 'unitsPerEm': em,
         'method': 'Standard-library TTC SFNT/name/cmap4/hhea/hmtx read only. No font installation/extraction/redistribution.',
         'ownCharacters': metrics,
         'sourceIndependentArithmetic': {'full25Half6ScaledHU': (25 * 1024 + 6 * 512) * 1100 * 97 / (em * 100),
                                         'sumIndividualFloorHU': 25 * int(1024 * 1100 * 97 / (em * 100)) + 6 * int(512 * 1100 * 97 / (em * 100)),
                                         'boxHU': 29868},
         'limitations': ['No actual Hancom glyph positions were measured.',
                         'Equal hmtx advances do not prove identical outlines, hinting, ink bounds or line-fit acceptance.',
                         'The font program bytes are deliberately absent from the evidence.']}
source_path = Path(args.source_raw)
if source_path.exists():
    data = source_path.read_bytes()
    text = json.loads(data.decode('utf-8'))['targetParagraphs'][1]['paragraph']['text'][:31]
    widths = [advance(character) for character in text]
    assert Counter(widths) == Counter({1024: 25, 512: 6})
    proof['publicSourceBoundedAudit'] = {
        'rawEvidenceSha256': hashlib.sha256(data).hexdigest(),
        'first31Utf8Sha256': hashlib.sha256(text.encode()).hexdigest(),
        'advanceHistogram': dict(Counter(widths)),
        'scaledSumHU': sum(widths) * 1100 * 97 / (em * 100),
        'note': 'Only count/hash/numeric values retained; no public text or glyph program is copied.'}
Path(args.output).write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('PASS installed-font numeric proof', proof['sourceIndependentArithmetic'])
