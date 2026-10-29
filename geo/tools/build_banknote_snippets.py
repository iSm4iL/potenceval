"""Create the reviewed game snippets from local source images. Never copies full originals to the game."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

def build(source_dir):
    rows = json.loads((ROOT / 'geo/data/banknotes.json').read_text(encoding='utf-8'))
    for row in rows:
        source = source_dir / row['sourceFile']
        if hashlib.sha256(source.read_bytes()).hexdigest() != row['sourceSha256']:
            raise ValueError(f"{row['key']}: source changed; review its crop again")
        left, top, right, bottom = row['crop']
        if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
            raise ValueError(f"{row['key']}: invalid crop")
        image = Image.open(source).convert('RGB')
        width, height = image.size
        box = tuple(round(v * (width if i % 2 == 0 else height)) for i, v in enumerate(row['crop']))
        snippet = image.crop(box)
        snippet.thumbnail((720, 400))
        target = ROOT / row['asset']
        target.parent.mkdir(parents=True, exist_ok=True)
        snippet.save(target, quality=88)
    print(f'Built {len(rows)} reviewed banknote snippets')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_dir', type=Path, help='Directory with sourceFile inputs listed in banknotes.json')
    build(parser.parse_args().source_dir)
