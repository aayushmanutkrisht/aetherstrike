"""Offline visual-sprite and grounding checks; no WebGL or webcam required."""
from pathlib import Path
from PIL import Image
import numpy as np
base=Path(__file__).resolve().parents[1]
frames=base/'public/assets/enemy_animations'
count=0
for state in ('idle','walk','shoot'):
    for variant in (0,1):
        seen=[]
        for frame in range(8):
            path=frames/f'{state}_{variant}_{frame}.png'
            assert path.is_file(), f'Missing animation frame: {path}'
            with Image.open(path) as img:
                assert img.mode=='RGBA' and img.size==(256,256),f'Unexpected PNG format: {path}'
                a=np.asarray(img.getchannel('A'))
                assert a.max()>180, f'Outline not visible in {path}'
                assert 0 < (a>0).sum() < 30000, f'Invalid transparent silhouette: {path}'
                assert np.any(a[240:255,:]>0), f'Feet not anchored near ground: {path}'
                seen.append(a.tobytes())
                count+=1
        assert len(set(seen))>=4, f'Insufficient frame variation in {state}_{variant}'
code=(base/'src/engine/EnemyManager.ts').read_text()
assert 'this.sprite.position.y' not in code,'Enemy sprite must not artificially bob off floor'
assert 'this.effects.enemyElimination(this.center)' in code,'Missing defeat particle trigger'
assert 'this.height=.83*scale' in code,'Unexpected enemy scale'
print(f'PASS: {count} translucent red RGBA PNG frames, non-floating sprite logic, defeat particle trigger.')
