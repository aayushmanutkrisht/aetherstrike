import * as THREE from 'three';
type Fx={object:THREE.Object3D;life:number;maxLife:number;velocity?:THREE.Vector3;};
type ImpactKind='enemy'|'world'|'concrete'|'metal'|'ground';
type EnemyBurst={points:THREE.Points;ring:THREE.Sprite;positions:Float32Array;velocities:Float32Array;life:number;maxLife:number;};

function createParticleTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d')!;
  const grad=ctx.createRadialGradient(32,32,0,32,32,30);
  grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.25,'rgba(255,235,220,.95)');
  grad.addColorStop(.65,'rgba(255,255,255,.24)');grad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}
function createRingTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=c.height=128;
  const ctx=c.getContext('2d')!;
  ctx.beginPath();ctx.arc(64,64,42,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,55,38,.96)';ctx.lineWidth=7;ctx.shadowBlur=18;ctx.shadowColor='#ff241e';ctx.stroke();
  return new THREE.CanvasTexture(c);
}
export class EffectsManager {
  private effects:Fx[]=[];
  private enemyBursts:EnemyBurst[]=[];
  private sparkGeo=new THREE.SphereGeometry(.045,5,4);
  private particleTexture=createParticleTexture();
  private ringTexture=createRingTexture();
  constructor(private scene:THREE.Scene){}
  tracer(from:THREE.Vector3,to:THREE.Vector3,host?:THREE.Scene){
    const length=from.distanceTo(to);if(length<.05)return;
    const material=new THREE.LineBasicMaterial({color:0xffca6f,transparent:true,opacity:.8,depthWrite:false});
    const points=new THREE.BufferGeometry().setFromPoints([from,to]);const line=new THREE.Line(points,material);
    (host??this.scene).add(line);this.effects.push({object:line,life:.085,maxLife:.085});
  }
  impact(where:THREE.Vector3,kind:ImpactKind='world'){
    for(let i=0;i<(kind==='enemy'?6:9);i++){
      const colors=kind==='enemy'?[0xff3530,0xffb073]:kind==='metal'?[0xffd18a,0xffffff]:kind==='ground'?[0x978675,0xc4ae86]:[0xffd7a1,0xb6a9a2];
      const m=new THREE.Mesh(this.sparkGeo,new THREE.MeshBasicMaterial({color:colors[i%2],transparent:true,opacity:1}));
      m.position.copy(where);const v=new THREE.Vector3((Math.random()-.5)*3.6,Math.random()*2.5,(Math.random()-.5)*3.6);
      this.scene.add(m);this.effects.push({object:m,life:.26+Math.random()*.25,maxLife:.51,velocity:v});
    }
  }
  /** A single glowing muzzle pulse when a 2D silhouette returns fire. */
  enemyMuzzleFlash(position:THREE.Vector3){
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:this.particleTexture,color:0xffe6a4,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:1}));
    sprite.position.copy(position);sprite.scale.set(.23,.23,1);
    this.scene.add(sprite);this.effects.push({object:sprite,life:.09,maxLife:.09});
  }
  /** 48 bright red fragments and an expanding red ring on elimination.
   * No mesh fade-out or extra enemy model is required. */
  enemyElimination(position:THREE.Vector3){
    const count=48;
    const positions=new Float32Array(count*3);
    const velocities=new Float32Array(count*3);
    const colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const o=i*3;
      const angle=Math.random()*Math.PI*2,spread=.6+Math.random()*2.3;
      velocities[o]=Math.cos(angle)*spread;
      velocities[o+1]=(Math.random()-.25)*2.8;
      velocities[o+2]=Math.sin(angle)*spread;
      colors[o]=1;
      colors[o+1]=Math.random()*.48;
      colors[o+2]=Math.random()*.26;
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const material=new THREE.PointsMaterial({
      size:.16,vertexColors:true,map:this.particleTexture,transparent:true,opacity:1,
      sizeAttenuation:true,depthWrite:false,blending:THREE.AdditiveBlending
    });
    const points=new THREE.Points(geometry,material);
    points.position.copy(position);
    const ring=new THREE.Sprite(new THREE.SpriteMaterial({
      map:this.ringTexture,color:0xff2520,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:1
    }));
    ring.position.copy(position);ring.scale.set(.22,.22,1);
    this.scene.add(points,ring);
    this.enemyBursts.push({points,ring,positions,velocities,life:.82,maxLife:.82});
  }
  smoke(pos:THREE.Vector3,host?:THREE.Scene){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.14,.14),new THREE.MeshBasicMaterial({color:0x8a9196,side:THREE.DoubleSide,transparent:true,opacity:.23,depthWrite:false}));
    mesh.position.copy(pos);mesh.rotation.z=Math.random()*6.28;
    (host??this.scene).add(mesh);this.effects.push({object:mesh,life:.7,maxLife:.7,velocity:new THREE.Vector3((Math.random()-.5)*.1,.3,0)});
  }
  casing(pos:THREE.Vector3,host?:THREE.Scene){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.052,6),new THREE.MeshStandardMaterial({color:0xc5a151,metalness:.8,roughness:.3}));
    mesh.position.copy(pos);(host??this.scene).add(mesh);
    this.effects.push({object:mesh,life:.7,maxLife:.7,velocity:new THREE.Vector3(.5+Math.random()*.6,.4+Math.random()*.6,0)});
  }
  private removeEffect(f:Fx){
    f.object.parent?.remove(f.object);
    if(f.object instanceof THREE.Line){f.object.geometry.dispose();f.object.material.dispose();}
    if(f.object instanceof THREE.Sprite){f.object.material.dispose();}
    if(f.object instanceof THREE.Mesh){if(f.object.geometry!==this.sparkGeo)f.object.geometry.dispose();
      (f.object.material as THREE.Material).dispose();}
  }
  private removeBurst(b:EnemyBurst){
    b.points.parent?.remove(b.points);b.ring.parent?.remove(b.ring);
    b.points.geometry.dispose();(b.points.material as THREE.Material).dispose();b.ring.material.dispose();
  }
  update(dt:number){
    for(let i=this.effects.length-1;i>=0;i--){
      const f=this.effects[i];f.life-=dt;
      if(f.velocity){f.object.position.addScaledVector(f.velocity,dt);f.velocity.y-=dt*2.2;f.object.rotation.z+=dt*2;}
      if(f.object instanceof THREE.Mesh&&(f.object.material as THREE.Material).transparent)
        (f.object.material as THREE.MeshBasicMaterial).opacity=Math.max(0,f.life/f.maxLife)*.65;
      if(f.object instanceof THREE.Sprite)(f.object.material as THREE.SpriteMaterial).opacity=Math.max(0,f.life/f.maxLife);
      if(f.life<=0){this.removeEffect(f);this.effects.splice(i,1);}
    }
    for(let i=this.enemyBursts.length-1;i>=0;i--){
      const b=this.enemyBursts[i];b.life-=dt;
      for(let j=0;j<b.velocities.length;j+=3){
        b.positions[j]+=b.velocities[j]*dt;
        b.positions[j+1]+=b.velocities[j+1]*dt;
        b.positions[j+2]+=b.velocities[j+2]*dt;
        b.velocities[j]*=Math.max(0,1-dt*2.5);
        b.velocities[j+1]-=dt*3;
        b.velocities[j+2]*=Math.max(0,1-dt*2.5);
      }
      (b.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
      const t=Math.max(0,b.life/b.maxLife);
      (b.points.material as THREE.PointsMaterial).opacity=t;
      b.ring.material.opacity=t*t;
      const ringScale=.22+(1-t)*1.25;b.ring.scale.set(ringScale,ringScale,1);
      if(b.life<=0){this.removeBurst(b);this.enemyBursts.splice(i,1);}
    }
  }
  dispose(){
    for(const f of this.effects)this.removeEffect(f);
    this.effects=[];
    for(const b of this.enemyBursts)this.removeBurst(b);
    this.enemyBursts=[];
    this.sparkGeo.dispose();this.particleTexture.dispose();this.ringTexture.dispose();
  }
}
