"""Generates the app icons from a 24x24 pixel-art grid. No extra libraries needed.
Run from the project folder:  python3 tools/make_icons.py
Edit GRID or COLORS below to change the icon."""
import struct
import zlib
from pathlib import Path

COLORS = {
    '.': (0x14, 0x14, 0x1c),  # background (--bg)
    'X': (0xc7, 0xa2, 0x5b),  # gold (--gold)
    'H': (0x7f, 0x64, 0x33),  # dark gold (--gold-lo)
    'f': (0x28, 0x28, 0x37),  # shield fill (--panel-2)
    'C': (0xdf, 0xc2, 0x85),  # chevrons (--gold-hi)
    'B': (0x55, 0x53, 0x6e),  # XP bar frame (--line-hi)
    'g': (0xc7, 0xa2, 0x5b),  # XP bar fill
    'w': (0x12, 0x12, 0x19),  # XP bar empty (--well)
}

# A shield with a double "level up" chevron, over an XP bar.
GRID = [
    '........................',
    '........................',
    '.....XXXXXXXXXXXXXX.....',
    '.....XHHHHHHHHHHHHX.....',
    '.....XHffffCCffffHX.....',
    '.....XHfffCCCCfffHX.....',
    '.....XHffCCffCCffHX.....',
    '.....XHfCCffffCCfHX.....',
    '.....XHffffCCffffHX.....',
    '.....XHfffCCCCfffHX.....',
    '......XHfCCffCCfHX......',
    '......XHCCffffCCHX......',
    '.......XHffffffHX.......',
    '........XHffffHX........',
    '.........XHffHX.........',
    '..........XXXX..........',
    '........................',
    '........................',
    '...BBBBBBBBBBBBBBBBBB...',
    '...BggggggggggwwwwwwB...',
    '...BggggggggggwwwwwwB...',
    '...BBBBBBBBBBBBBBBBBB...',
    '........................',
    '........................',
]
assert all(len(r) == 24 for r in GRID) and len(GRID) == 24


def png(path, size, scale, pad_cells=0):
    """Write the grid scaled up by `scale`, centered on a `size` x `size` canvas."""
    cells = len(GRID) + pad_cells * 2
    offset = (size - cells * scale) // 2 + pad_cells * scale
    bg = COLORS['.']
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter: none
        gy = (y - offset) // scale if y >= offset else -1
        for x in range(size):
            gx = (x - offset) // scale if x >= offset else -1
            c = COLORS[GRID[gy][gx]] if 0 <= gy < 24 and 0 <= gx < 24 else bg
            raw += bytes(c)

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    Path(path).write_bytes(data)


def svg(path):
    rects = ''.join(
        f'<rect x="{x}" y="{y}" width="1" height="1" fill="#{"%02x%02x%02x" % COLORS[ch]}"/>'
        for y, row in enumerate(GRID) for x, ch in enumerate(row) if ch != '.')
    Path(path).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges">'
                          f'<rect width="24" height="24" fill="#14141c"/>{rects}</svg>\n')


if __name__ == '__main__':
    out = Path(__file__).resolve().parent.parent / 'icons'
    out.mkdir(exist_ok=True)
    png(out / 'apple-touch-icon.png', 180, 7)            # iPhone home screen (iOS rounds the corners)
    png(out / 'icon-192.png', 192, 8)
    png(out / 'icon-512.png', 512, 21)
    png(out / 'icon-maskable-512.png', 512, 16, pad_cells=4)   # extra margin for Android's shape masks
    png(out / 'favicon-32.png', 32, 1)
    svg(out / 'favicon.svg')
    print('icons written to', out)
