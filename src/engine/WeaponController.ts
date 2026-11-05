import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {EffectsManager} from './EffectsManager';
import {AudioManager} from './AudioManager';
import type {Controls} from './types';

export interface WeaponHit {point:THREE.Vector3;enemy:boolean;hit:boolean;killed:boolean;score:number;}

/** Keeps ALL of the supplied carbine and arm meshes; weapon characteristics are LMG-like. */
export class WeaponController {
  readonly scene=new THREE.Scene();private root=new THREE.Group();private model:THREE.Group;
  private fx:EffectsManager;private flash:THREE.Sprite;private light:THREE.PointLight;
  private magazine?:THREE.Object3D;private bolt?:THREE.Object3D;
  private magazineAt?:THREE.Vector3;private boltAt?:THREE.Vector3;
  ammo=80;reserve=480;readonly capacity=80;readonly reloadDuration=3.25;reloadTimer=0;
  shooting=false;ads=false;recoil=0;recoilImpulse=0;shots=0;hits=0;
  private shotTimer=0;private heat=0;private time=0;private flashTime=0;
  private lowering=0;private lastFire=false;private aimBlend=0;private viewOffset=0;
  private readonly nominalScale=.53;private sizeMultiplier=1;
  // The supplied weapon's main receiver extends to local +Z=1.386. After a 180°
  // yaw conversion, its barrel is forward in camera-space -Z (not facing the player).
  private muzzle=new THREE.Vector3(0,.53*.318,-.53*1.366); // Actual barrel-tip from source GLB; scaled with weapon
  constructor(gltf:GLTF,private audio:AudioManager){
    this.model=gltf.scene;
    this.model.rotation.y=Math.PI;
    this.model.scale.setScalar(this.nominalScale);
    this.root.add(this.model);this.root.position.set(.15,-.34,-.92);this.scene.add(this.root);
    this.model.traverse(o=>{
      if(o.name==='clip')this.magazine=o;
      if(o.name==='bolt')this.bolt=o;
      if((o as THREE.Mesh).isMesh)(o as THREE.Mesh).frustumCulled=false;
    });
    this.magazineAt=this.magazine?.position.clone();this.boltAt=this.bolt?.position.clone();
    // 'allanims' has 69 combined tracks; never assert it is a dedicated reload clip.
    // Procedural control of the real, independently named magazine/bolt is safer.
    this.fx=new EffectsManager(this.scene);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d')!;
    const grad=ctx.createRadialGradient(64,64,2,64,64,63);
    grad.addColorStop(0,'#fff');grad.addColorStop(.12,'#fff8c9');grad.addColorStop(.42,'#ffba5f');grad.addColorStop(1,'#ff7d2400');
    ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
    this.flash=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,depthTest:false}));
    this.flash.scale.set(.55,.55,1);this.flash.position.copy(this.muzzle);this.flash.visible=false;
    this.root.add(this.flash);
    this.light=new THREE.PointLight(0xffb553,0,3);this.light.position.copy(this.muzzle);this.root.add(this.light);
  }
  /** Move the user's actual arms/weapon vertically without changing the original mesh. */
  setViewOffset(offset:number){this.viewOffset=THREE.MathUtils.clamp(offset,-.22,.26);}
  /** Adjust perceived size without altering any source GLB geometry/material/rig. */
  setSize(multiplier:number){
    this.sizeMultiplier=THREE.MathUtils.clamp(multiplier,.85,1.25);
    const scale=this.nominalScale*this.sizeMultiplier;
    this.model.scale.setScalar(scale);
    this.muzzle.set(0,.318*scale,-1.366*scale);
    this.flash.position.copy(this.muzzle);
    this.light.position.copy(this.muzzle);
  }
  beginReload(){if(this.reloadTimer>0||this.ammo===this.capacity||this.reserve===0)return false;
    this.reloadTimer=this.reloadDuration;this.shooting=false;this.lastFire=false;this.audio.reload();return true;}
  forceLower(active:boolean){this.lowering=THREE.MathUtils.lerp(this.lowering,active?1:0,.16);}
  update(dt:number,controls:Controls,shoot:(direction:THREE.Vector3,maxRange:number,damage:number)=>WeaponHit|null){
    this.time+=dt;this.recoil*=Math.exp(-dt*13);this.recoilImpulse*=Math.exp(-dt*18);
    this.heat=Math.max(0,this.heat-dt*.22);
    this.flashTime=Math.max(0,this.flashTime-dt);this.flash.visible=this.flashTime>0;
    this.light.intensity=this.flash.visible?2.3:0;
    if(this.flash.visible)this.flash.material.rotation+=dt*19;
    if(this.reloadTimer>0){
      this.reloadTimer=Math.max(0,this.reloadTimer-dt);
      if(this.reloadTimer===0){const count=Math.min(this.capacity-this.ammo,this.reserve);this.ammo+=count;this.reserve-=count;this.audio.reload();}
    }
    const reloadPhase=this.reloadTimer>0?1-this.reloadTimer/this.reloadDuration:0;
    if(this.magazine&&this.magazineAt){
      this.magazine.position.copy(this.magazineAt);
      if(this.reloadTimer>0)this.magazine.position.y-=Math.sin(reloadPhase*Math.PI)*.13;
    }
    if(this.bolt&&this.boltAt){this.bolt.position.copy(this.boltAt);this.bolt.position.z+=this.recoilImpulse*.022;}
    this.ads=controls.ads&&this.reloadTimer===0&&this.lowering<.4;
    this.aimBlend=THREE.MathUtils.damp(this.aimBlend,this.ads?1:0,12,dt);
    const idle=Math.sin(this.time*1.7)*.005;
    const reloadDrop=this.reloadTimer>0?Math.sin(reloadPhase*Math.PI)*.3:0;
    // Crop arm endings below the frame, keep the true optic centred during ADS.
    // The original mesh has long rearward arms: move the full model closer but
    // keep the near hand geometry outside the camera near clipping plane.
    const scale=this.nominalScale*this.sizeMultiplier;
    const base=new THREE.Vector3(.15,-.34+this.viewOffset,-.92)
      .lerp(new THREE.Vector3(0,-.457*scale+this.viewOffset,-.93),this.aimBlend);
    base.add(new THREE.Vector3(Math.sin(this.time*.65)*.006,idle-reloadDrop-this.lowering*.5-this.recoil*.015,this.recoil*.07));
    this.root.position.lerp(base,Math.min(1,dt*12));
    this.root.rotation.x=THREE.MathUtils.damp(this.root.rotation.x,this.recoil*.045+this.lowering*.48+Math.sin(this.time*1.2)*.003,14,dt);
    this.root.rotation.z=THREE.MathUtils.damp(this.root.rotation.z,-.035*(1-this.aimBlend)+this.recoil*.008,12,dt);
    this.shooting=controls.fire&&this.reloadTimer===0&&this.lowering<.4&&this.ammo>0;
    if(!this.shooting){this.shotTimer=0;this.lastFire=false;}
    if(this.shooting){
      if(!this.lastFire)this.shotTimer=0;
      this.shotTimer-=dt;this.lastFire=true;
      let budget=3; // FPS drops must not consume an unlimited number of bullets.
      while(this.shotTimer<=0&&this.ammo>0&&budget-->0){
        this.shotTimer+=.086;this.ammo--;this.shots++;
        this.recoil=Math.min(1.25,this.recoil+.2);this.recoilImpulse=1;this.heat=Math.min(1,this.heat+.06);
        this.flashTime=.055;this.flash.material.rotation=Math.random()*6.28;this.audio.gun();
        const spread=(this.ads?.008:.029)+this.heat*(this.ads?.026:.06);
        const dir=new THREE.Vector3((Math.random()-.5)*spread*2,(Math.random()-.5)*spread*2,-1).normalize();
        const result=shoot(dir,90,this.ads?38:32);if(result?.hit)this.hits++;
        this.fx.smoke(this.muzzleWorld);
        if(Math.random()<.55)this.fx.casing(this.root.localToWorld(new THREE.Vector3(.14,-.10,-.13)));
        if(this.ammo<=0){this.shooting=false;this.beginReload();break;}
      }
    }
    this.fx.update(dt);
  }
  get accuracy(){return this.shots?Math.round(this.hits/this.shots*100):100;}
  get reload(){return this.reloadTimer>0;}
  get reloadProgress(){return this.reloadTimer>0?1-this.reloadTimer/this.reloadDuration:0;}
  get muzzleWorld(){this.root.updateMatrixWorld(true);return this.root.localToWorld(this.muzzle.clone());}
  reset(){this.ammo=this.capacity;this.reserve=480;this.reloadTimer=0;this.shots=0;this.hits=0;this.heat=0;
    this.shotTimer=0;this.shooting=false;this.lowering=0;this.recoil=0;this.aimBlend=0;this.flashTime=0;}
  dispose(){this.fx.dispose();(this.flash.material as THREE.SpriteMaterial).map?.dispose();this.flash.material.dispose();}
}
