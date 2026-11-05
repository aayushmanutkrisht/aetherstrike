"""Offline geometry survey using the supplied environment.glb; requires trimesh/numpy.
Not a substitute for live Three.js collision or enemy AI playtesting.
"""
from pathlib import Path
import trimesh,numpy as np,re
root=Path(__file__).resolve().parents[1]
m=trimesh.load(root/'public/assets/environment.glb',force='scene',process=False).to_geometry()
b=m.bounds
v=m.vertices.copy();v[:,0]=(v[:,0]-(b[0,0]+b[1,0])/2)*32;v[:,1]=(v[:,1]-b[0,1])*32;v[:,2]=(v[:,2]-(b[0,2]+b[1,2])/2)*32
faces=v[m.faces]
norm=np.cross(faces[:,1]-faces[:,0],faces[:,2]-faces[:,0]);norm/=np.maximum(1e-8,np.linalg.norm(norm,axis=1)[:,None]);floortris=faces[norm[:,1]>.55]
a,b,c=floortris[:,0,:],floortris[:,1,:],floortris[:,2,:]
den=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);den=np.where(abs(den)<1e-8,np.nan,den)
def floor(x,z):
    u=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/den
    vv=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/den
    w=1-u-vv
    y=u*a[:,1]+vv*b[:,1]+w*c[:,1]
    good=(u>=0)&(vv>=0)&(w>=0)&(y>=-.4)&(y<=3.9)
    return None if not good.any() else float(y[good][np.argmin(abs(y[good]))])
cover=[(8,11.2),(9.6,8),(11.2,4.8),(11.2,1.6),(11.2,-4.8),(11.2,-8.8)]
for p in cover:assert floor(*p)is not None, f'Cover position missing floor: {p}'
text=(root/'src/engine/LevelLayout.ts').read_text()
anchors=[tuple(map(float,m)) for m in re.findall(r'x:([\d.]+),z:([-\d.]+)',text)]
missing=[p for p in anchors if floor(*p) is None]
assert not missing,f'Enemy anchors have no floor: {missing}'
print('PASS: All 6 cover stations and all',len(anchors),'enemy anchors have original-mesh floor support.')
