import struct,json,numpy as np,collections,os,math
from pathlib import Path
from scipy.spatial.transform import Rotation
BASE=Path(__file__).resolve().parent.parent/'public'/'assets'
OUTPUT=Path(__file__).resolve().parent.parent
DETAILS={}

def T_from_node(n):
 if 'matrix' in n: return np.array(n['matrix'],dtype=float).reshape(4,4,order='F')
 t=np.eye(4)
 if 'translation' in n:t[:3,3]=n['translation']
 if 'rotation' in n:t[:3,:3]=Rotation.from_quat(n['rotation']).as_matrix()
 if 'scale' in n:t[:3,:3]=t[:3,:3]@np.diag(n['scale'])
 return t
for filename in ['environment.glb','enemy.glb','first person view.glb']:
 path=BASE/filename
 with open(path,'rb') as f:
  header=f.read(12);magic,version,length=struct.unpack('<III',header)
  jlen,jtype=struct.unpack('<II',f.read(8));js=json.loads(f.read(jlen).decode('utf8')); blen,btype=struct.unpack('<II',f.read(8)); binary=f.read(blen)
 print('\n###',filename,'length',round(length/1e6,1),'MB', 'glTF',version)
 nodes=js.get('nodes',[]);meshes=js.get('meshes',[]);skins=js.get('skins',[]);anims=js.get('animations',[]);materials=js.get('materials',[]);textures=js.get('textures',[]);images=js.get('images',[])
 root_ids=js.get('scenes',[{}])[js.get('scene',0)].get('nodes',[])
 parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
 M={}
 def world(i):
  if i in M:return M[i]
  m=T_from_node(nodes[i]); M[i]=world(parents[i])@m if i in parents else m;return M[i]
 for i in range(len(nodes)):world(i)
 bbox_min=np.array([float('inf')]*3);bbox_max=-bbox_min
 mesh_uses=[];tri=0;poly_by_node=[]
 for i,n in enumerate(nodes):
  if 'mesh' not in n:continue
  mesh=meshes[n['mesh']];local_min=np.array([float('inf')]*3);local_max=-local_min;tris=0
  for p in mesh['primitives']:
   if p.get('mode',4)!=4:continue
   pa=js['accessors'][p['attributes']['POSITION']];pmn=np.array(pa.get('min',[-1]*3));pmx=np.array(pa.get('max',[1]*3))
   local_min=np.minimum(local_min,pmn);local_max=np.maximum(local_max,pmx)
   ia=js['accessors'][p['indices']] if 'indices' in p else pa
   tris+=ia['count']//3
  corners=np.array([[x,y,z,1] for x in [local_min[0],local_max[0]] for y in [local_min[1],local_max[1]] for z in [local_min[2],local_max[2]]])
  transform=(world(i)@corners.T).T[:,:3]
  bbox_min=np.minimum(bbox_min,transform.min(0));bbox_max=np.maximum(bbox_max,transform.max(0));tri+=tris
  mesh_uses.append((i,n.get('name',''),round(float(transform[:,0].mean()),2),round(float(transform[:,1].min()),2),round(float(transform[:,2].mean()),2),round(float(tris))))
  poly_by_node.append({'node':i,'name':n.get('name',str(i)),'triangles':tris, 'bounds':[transform.min(0).round(3).tolist(),transform.max(0).round(3).tolist()]})
 print('nodes',len(nodes),'mesh definitions',len(meshes),'mesh instances',len(mesh_uses),'triangles instanced',tri)
 print('materials',len(materials),'images',len(images),'textures',len(textures),'skins',len(skins),'animation clips',len(anims))
 print('roots:',[(i,nodes[i].get('name')) for i in root_ids]);print('world extents',bbox_min.round(3),bbox_max.round(3),'size',(bbox_max-bbox_min).round(3))
 print('mesh nodes sample:',[(z[1],z[-1]) for z in mesh_uses[:35]])
 print('materials names:',[x.get('name') for x in materials[:25]])
 print('textures images:',[x.get('name',x.get('uri','embedded '+str(x.get('bufferView')))) for x in images[:35]])
 skind=[]
 for skin in skins:
  joints=skin.get('joints',[]);skind.append({'name':skin.get('name'),'joint_count':len(joints),'root':nodes[skin['skeleton']].get('name','') if 'skeleton' in skin else None,'joints':[(j,nodes[j].get('name','')) for j in joints]})
  print('skin',skin.get('name'),'bones',len(joints),'root',skin.get('skeleton'),'joints',[(j,nodes[j].get('name')) for j in joints[:25]])
 clips=[]
 for a in anims:
  paths=collections.Counter(ch['target']['path'] for ch in a.get('channels',[]));duration=0
  names=[]
  for ch in a['channels']:
   si=a['samplers'][ch['sampler']]['input'];acc=js['accessors'][si];duration=max(duration,max(acc.get('max',[0])));names.append(nodes[ch['target']['node']].get('name',''))
  clips.append({'name':a.get('name',''), 'duration':duration, 'channels':len(a.get('channels',[])),'paths':dict(paths),'targets':list(dict.fromkeys(names))[:15]})
 print('clips:');[print(' ',x['name'],'duration',round(x['duration'],2),'channels',x['channels'],'target',x['targets'][:3]) for x in clips]
 if filename=='environment.glb':
  print('env all named meshes:')
  for d in sorted(poly_by_node,key=lambda d:d['triangles'],reverse=True)[:100]:print(' ',d['name'],d['triangles'],d['bounds'])
 if filename=='first person view.glb':
  print('all nodes:')
  for i,n in enumerate(nodes):print(' ',i,n.get('name'), 'mesh',n.get('mesh'),'skin',n.get('skin'),'children',len(n.get('children',[])))
 DETAILS[filename]={'filename':filename,'size_bytes':length,'nodes':len(nodes),'root_nodes':root_ids,'mesh_definitions':len(meshes),'mesh_instances':len(mesh_uses),'triangles':tri,'materials':[x.get('name','Unnamed') for x in materials], 'images':[{'name':x.get('name'),'uri':x.get('uri'),'embedded':('bufferView' in x),'mimeType':x.get('mimeType')} for x in images], 'skins':skind,'animations':clips,'bounds_min':bbox_min.round(5).tolist(),'bounds_max':bbox_max.round(5).tolist(),'dimensions':(bbox_max-bbox_min).round(5).tolist(),'mesh_nodes':poly_by_node,'nodes_all':[{'id':i,'name':n.get('name'),'mesh':n.get('mesh'),'skin':n.get('skin'),'children':n.get('children',[]),'translation':n.get('translation'),'rotation':n.get('rotation'),'scale':n.get('scale')} for i,n in enumerate(nodes)]}
with open(OUTPUT/'asset_analysis.json','w') as f:json.dump(DETAILS,f,indent=2)
