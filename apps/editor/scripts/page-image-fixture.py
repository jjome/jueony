"""Synthetic RGB bands; no external image, font or private source file."""
import sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
image=Image.new('RGB',(48,24))
for y in range(24):
    for x in range(48):
        image.putpixel((x,y), ((240,20,40),(20,210,50),(30,50,230))[x//16] if y<18 else (0,0,0))
image.save(root/'background-bands.png')
image.save(root/'background-bands.jpg',quality=95)
(root/'invalid.png').write_bytes(b'not an image')
