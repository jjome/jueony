"""Create malformed embedded-image fixtures from a generated HWPX, without touching user files."""
import sys,zipfile,struct,zlib
source,target,mode=sys.argv[1:4]
changed=False
with zipfile.ZipFile(source) as original,zipfile.ZipFile(target,'w') as output:
    for item in original.infolist():
        data=original.read(item.filename)
        if not changed and item.filename.startswith('BinData/') and item.filename.lower().endswith('.png'):
            changed=True
            if mode=='missing':continue
            if mode=='corrupt':data=b'invalid image payload'
            elif mode=='large-bytes':data=b'\0'*(10*1024*1024+1)
            elif mode=='large-dimensions':
                assert data[12:16]==b'IHDR'
                ihdr=struct.pack('>I',8193)+data[20:29]
                data=data[:16]+ihdr+struct.pack('>I',zlib.crc32(b'IHDR'+ihdr))+data[33:]
            else:raise ValueError(mode)
        output.writestr(item,data)
assert changed,'no generated PNG asset found'
