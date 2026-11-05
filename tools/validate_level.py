"""Optional geometry QA. Run: python tools/validate_level.py (requires numpy, trimesh).

Validates that authored stations/route anchors lie on upward-facing original GLB
triangles and that the route and enemy sight lines have no triangle intersections.
This is offline math QA, NOT a replacement for an in-browser physics smoke test.
"""
from pathlib import Path
import math
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parent.parent
mesh=trimesh.load(ROOT/'public/assets/environment.glb',force='scene').to_geometry()
center=mesh.bounds.mean(axis=0)
v=(mesh.vertices-np.array([center[0],mesh.bounds[0,1],center[2]]))*32.0
triangles=v[mesh.faces]
p0,p1,p2=triangles[:,0,:],triangles[:,1,:],triangles[:,2,:]
e1,e2=p1-p0,p2-p0
normal=np.cross(e1,e2)
normal=normal/np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-12)
valid_norm=normal[:,1]>.34
f0,f1,f2=p0[valid_norm],p1[valid_norm],p2[valid_norm]
basis_a=f1[:,[0,2]]-f0[:,[0,2]];basis_b=f2[:,[0,2]]-f0[:,[0,2]]
det=basis_a[:,0]*basis_b[:,1]-basis_a[:,1]*basis_b[:,0]


def floor(x,z):
    point=np.array([x,z])-f0[:,[0,2]]
    den=np.where(abs(det)>1e-9,det,1)
    u=(point[:,0]*basis_b[:,1]-point[:,1]*basis_b[:,0])/den
    w=(basis_a[:,0]*point[:,1]-basis_a[:,1]*point[:,0])/den
    y=f0[:,1]+u*(f1[:,1]-f0[:,1])+w*(f2[:,1]-f0[:,1])
    mask=(u>=0)&(w>=0)&(u+w<=1)&(y>-.4)&(y<3.9)
    return float(y[mask].max()) if mask.any() else None


def intersect_segment(start,end):
    start=np.asarray(start,dtype=float);end=np.asarray(end,dtype=float)
    ray=end-start;distance=float(np.linalg.norm(ray));ray/=distance
    p=np.cross(ray[None,:],e2);d=np.einsum('ij,ij->i',e1,p)
    ok=np.abs(d)>1e-8
    inv=np.where(ok,1/np.where(ok,d,1),0)
    t=start-p0
    u=np.einsum('ij,ij->i',t,p)*inv
    q=np.cross(t,e1);w=np.einsum('ij,j->i',q,ray)*inv
    along=np.einsum('ij,ij->i',q,e2)*inv
    hits=ok&(u>=0)&(w>=0)&(u+w<=1)&(along>.08)&(along<distance-.08)
    return float(along[hits].min()) if hits.any() else None


def visible(a,b,origin_height=1.03,target_height=1.0):
    y0=floor(*a);y1=floor(*b)
    if y0 is None or y1 is None:return False
    return intersect_segment((a[0],y0+origin_height,a[1]),(b[0],y1+target_height,b[1])) is None

factor=1.6
covers=[(5*factor,7*factor),(7*factor,1*factor),(7*factor,-5.5*factor)]
route=[(x*factor,z*factor) for x,z in [(5,7),(5.5,6),(6,5),(6.5,4),(7,3),(7,2),(7,1),(7,0),(7,-1),(7,-2),(7,-3),(7,-4),(7,-5.5)]]
for point in route:
    assert floor(*point) is not None,f'Route has no floor: {point}'
for a,b in zip(route,route[1:]):
    assert visible(a,b,1,1),f'Original geometry blocks the route: {a} -> {b}'
print(f'PASS: {len(covers)} cover points and {len(route)-1} connected route segments on original geometry')

from math import sin,cos,pi,atan2,dist
encounters=[[(x*factor,z*factor) for x,z in wave] for wave in [[(4,5),(6,4),(7,3)],[(6,-1),(8,-2),(7,-3)],[(6,-6),(8,-7.5),(7.5,-8.5)]]]
for cover,squad in zip(covers,encounters):
    for x,z in squad:
        valid=False
        for radius in [0,.5,1,1.5,2,2.5,3]:
            for i in range(1 if radius==0 else 12):
                px=x+cos(i/12*2*pi)*radius;pz=z+sin(i/12*2*pi)*radius
                point=(px,pz)
                if floor(*point) is None:continue
                angle=atan2(-(px-cover[0]),-(pz-cover[1]))
                if abs(angle)>1.17 or dist(cover,point)<1.6:continue
                if visible(cover,point):valid=True;break
            if valid:break
        assert valid,f'No visible standing area for enemy: {cover} -> {(x,z)}'
print('PASS: all 9 enemy placements have a surveyed reachable floor / line-of-sight candidate')
