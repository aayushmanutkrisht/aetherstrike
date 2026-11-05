import * as THREE from 'three';
import {AssetManager} from '../assets/AssetManager';
import {Environment} from './Environment';
import {WeaponController} from './WeaponController';
import {EnemyManager} from './EnemyManager';
import {EffectsManager} from './EffectsManager';
import {AudioManager} from './AudioManager';
import type {Controls,GamePhase,Settings,Snapshot} from './types';
import {DEFAULT_SETTINGS,EMPTY_SNAPSHOT} from './types';
const zero:Controls={fire:false,ads:false,turn:0,tilt:0,reload:false,tracked:false};
const clamp=THREE.MathUtils.clamp;
const EYE_HEIGHT=1.03; // Lower stance for cover-based movement, with boots on source terrain.
/** Main render, navigation, encounter, weapon and collision orchestration. */
export class GameEngine {
  readonly renderer:THREE.WebGLRenderer; readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(76,1,.045,140);
  private weaponCamera=new THREE.PerspectiveCamera(76,1,.04,40);
  readonly assets=new AssetManager();readonly audio=new AudioManager();
  environment?:Environment;weapon?:WeaponController;enemies?:EnemyManager;effects:EffectsManager;
  settings:Settings={...DEFAULT_SETTINGS};phase:GamePhase='menu';
  onSnapshot?:(s:Snapshot)=>void;onLoaded?:(value:boolean,detail:string)=>void;
  onFinished?:(phase:'victory'|'defeat')=>void;
  private frameId=0;private lastFrame=0;private lastUI=0;private fps=60;
  private yaw=0;private pitch=0;private yawVelocity=0;private pitchVelocity=0;private cameraKick=0;private sway=0;
  private targetLocked=false;private transitTime=0;private transitSpeed=0;
  private wave=0;private clearedTimer=-1;private moving=false;private advanceTo=0;
  private health=100;private score=0;private suppressed=0;private controls:Controls={...zero};
  private fromKeyboard={fire:false,ads:false,turn:0,tilt:0,reload:false,tracked:false};
  private loaded=false;private destroyed=false;private message='';private messageTimer=0;private footstepTimer=0;
  private inputUpdateAt=0;private lastReloadSignal=false;private mouseDelta=0;private mouseVertical=0;
  private path:THREE.Vector3[]=[];private stalled=0;
  constructor(private canvas:HTMLCanvasElement){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.45;
    this.renderer.shadowMap.enabled=false;
    this.scene.background=new THREE.Color(0x27384a);this.scene.fog=new THREE.FogExp2(0x425467,.006);
    this.scene.add(new THREE.HemisphereLight(0xaccbea,0x514536,2.2));
    const sun=new THREE.DirectionalLight(0xffe6c4,3.1);sun.position.set(-16,26,-13);this.scene.add(sun);
    const fill=new THREE.DirectionalLight(0x97c1ff,.7);fill.position.set(18,12,16);this.scene.add(fill);
    this.weaponCamera.position.set(0,0,0);
    this.effects=new EffectsManager(this.scene);
    this.resize();window.addEventListener('resize',this.resize);
    this.frameId=requestAnimationFrame(this.tick);
  }
  readonly resize=()=>{
    const w=this.canvas.clientWidth||window.innerWidth,h=this.canvas.clientHeight||window.innerHeight;
    this.renderer.setSize(w,h,false);this.camera.aspect=this.weaponCamera.aspect=w/h;
    this.camera.updateProjectionMatrix();this.weaponCamera.updateProjectionMatrix();
  };
  async load(){
    if(this.loaded)return;
    try{
      const all=await this.assets.all((pct,key)=>this.onLoaded?.(false,`LOADING ${key.toUpperCase()} · ${Math.round(pct)}%`));
      if(this.destroyed)return;
      this.environment=new Environment(all.environment,this.scene);
      this.weapon=new WeaponController(all.weapon,this.audio);
      this.weapon.scene.add(new THREE.HemisphereLight(0xffffff,0x56627b,2.6));
      const light=new THREE.DirectionalLight(0xffe7d6,2.9);light.position.set(-2,6,8);this.weapon.scene.add(light);
      this.enemies=new EnemyManager(this.scene,this.environment,this.effects,this.audio);
      // Precompute every spawn and upload all animation textures BEFORE Start enables.
      // No expensive sector creation is left for the live gameplay loop.
      await this.enemies.prepareAll(this.renderer,message=>{if(!this.destroyed)this.onLoaded?.(false,message);});
      if(this.destroyed)return;
      this.loaded=true;this.reset(false);this.onLoaded?.(true,'ALL SIX SECTORS PRELOADED · READY');
    }catch(err){this.onLoaded?.(false,`ASSET ERROR: ${err instanceof Error?err.message:String(err)}`);throw err;}
  }
  ready(){return this.loaded;}
  reset(start=true){
    if(!this.loaded)return;
    this.phase=start?'playing':'menu';this.wave=0;this.health=100;this.score=0;
    this.suppressed=0;this.clearedTimer=-1;this.moving=false;this.advanceTo=0;
    this.yaw=0;this.pitch=0;this.yawVelocity=0;this.pitchVelocity=0;this.cameraKick=0;this.sway=0;this.targetLocked=false;this.transitTime=0;this.transitSpeed=0;this.path=[];this.stalled=0;this.lastReloadSignal=false;this.controls={...zero};this.fromKeyboard={...zero};
    this.weapon!.reset();this.weapon!.setSize(this.settings.weaponSize);this.weapon!.setViewOffset(this.settings.weaponOffset);
    this.enemies!.resetCampaign();
    if(start)this.enemies!.activate(0);
    this.camera.position.copy(this.environment!.cover[0].position).add(new THREE.Vector3(0,EYE_HEIGHT,0));
    this.camera.rotation.set(0,0,0);
    this.message=start?'ELIMINATE HOSTILE FORCES':'AWAITING DEPLOYMENT';this.messageTimer=3;
    if(start)this.audio.unlock();this.publish();
  }
  start(training=false){this.reset(true);if(training){this.message='TRAINING: MAKE A FIST TO AIM • PINCH TO FIRE';this.messageTimer=7;}}
  pause(){if(this.phase==='playing'){this.phase='paused';this.controls.fire=false;}else if(this.phase==='paused'){this.phase='playing';}this.publish();}
  setSettings(s:Settings){this.settings={...s};this.audio.setEnabled(s.audio);this.weapon?.setViewOffset(s.weaponOffset);this.weapon?.setSize(s.weaponSize);
    const scale=s.quality==='low'?1:s.quality==='medium'?1.4:Math.min(window.devicePixelRatio,2);
    this.renderer.setPixelRatio(scale);this.renderer.setSize(this.canvas.clientWidth,this.canvas.clientHeight,false);
    this.renderer.toneMappingExposure=s.quality==='low'?1.55:1.45;
  }
  setGesture(control:Controls){this.controls={...control};this.inputUpdateAt=performance.now();}
  setKeyboard(control:Partial<Controls>){this.fromKeyboard={...this.fromKeyboard,...control};}
  nudgeMouse(deltaX:number,deltaY=0){this.mouseDelta+=clamp(deltaX,-110,110);this.mouseVertical+=clamp(deltaY,-110,110);}
  get currentPhase(){return this.phase;}
  reload(){this.weapon?.beginReload();this.publish();}
  private show(message:string,duration=2.2){this.message=message;this.messageTimer=duration;}
  private tick=(time:number)=>{
    this.frameId=requestAnimationFrame(this.tick);
    const frameSeconds=Math.max(0,(time-(this.lastFrame||time))/1000);
    const dt=Math.min(.04,frameSeconds);this.lastFrame=time;
    this.fps=this.fps*.94+(frameSeconds>0?1/frameSeconds:60)*.06;
    if(this.phase==='playing'&&this.loaded)this.update(dt);
    if(this.weapon){
      this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);
      this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weapon.scene,this.weaponCamera);
      this.renderer.autoClear=true;
    }else this.renderer.render(this.scene,this.camera);
    if(time-this.lastUI>110){this.lastUI=time;this.publish();}
  };
  private update(dt:number){
    const env=this.environment!,gun=this.weapon!,enemies=this.enemies!;
    // Fail-safe: a gesture stream that stops updating must never keep firing.
    if(performance.now()-this.inputUpdateAt>300)this.controls={...zero};
    const controls={...this.controls,fire:this.controls.fire||this.fromKeyboard.fire,ads:this.controls.ads||this.fromKeyboard.ads,
      turn:this.controls.turn+this.fromKeyboard.turn,tilt:this.controls.tilt+this.fromKeyboard.tilt,reload:this.controls.reload||this.fromKeyboard.reload,tracked:this.controls.tracked};
    if(controls.reload&&!this.lastReloadSignal)gun.beginReload();this.lastReloadSignal=controls.reload;
    this.messageTimer=Math.max(0,this.messageTimer-dt);this.suppressed=Math.max(0,this.suppressed-dt*.26);
    this.yawVelocity=THREE.MathUtils.damp(this.yawVelocity,(this.settings.invert?1:-1)*controls.turn*this.settings.sensitivity,10,dt);
    this.pitchVelocity=THREE.MathUtils.damp(this.pitchVelocity,controls.tilt*this.settings.sensitivity*.78,10,dt);
    this.yaw=clamp(this.yaw+this.yawVelocity*dt-this.mouseDelta*.0023*this.settings.sensitivity,-1.32,1.32);
    this.mouseDelta=0;
    this.pitch=clamp(this.pitch+this.pitchVelocity*dt-this.mouseVertical*.0022*this.settings.sensitivity,-.7,.68);
    this.mouseVertical=0;
    this.cameraKick=THREE.MathUtils.damp(this.cameraKick,0,8,dt);
    this.camera.rotation.set(this.pitch-this.cameraKick*.03,this.yaw,.005*Math.sin(performance.now()*.0008),'YXZ');
    if(this.moving){
      const cover=env.cover[this.advanceTo];
      // Follow authored waypoints projected onto the supplied scene's real floor.
      if(!this.path.length)this.path=cover.route.map(p=>p.clone());
      const dest=this.path[0];
      if(!dest){this.moving=false;return;}
      const foot=this.camera.position.clone().add(new THREE.Vector3(0,-EYE_HEIGHT,0));
      const delta=new THREE.Vector3(dest.x-foot.x,0,dest.z-foot.z);
      if(delta.length()<.25){this.path.shift();this.stalled=0;
        if(!this.path.length){
          this.camera.position.copy(cover.position).add(new THREE.Vector3(0,EYE_HEIGHT,0));
          this.moving=false;this.transitSpeed=0;this.wave=this.advanceTo;enemies.activate(this.wave);
          // Partial resupply between cover encounters keeps escalating waves playable.
          gun.reserve=Math.min(900,gun.reserve+70);
          this.health=Math.min(100,this.health+Math.max(5,16-this.wave*2));
          gun.forceLower(false);this.clearedTimer=-1;this.yaw=0;this.yawVelocity=0;
          this.pitch=0;this.pitchVelocity=0;this.show(`POSITION ${this.wave+1} SECURED · ENGAGE`,3);
        }
      }else{
        const d=delta.normalize();
        // Foot-paced acceleration, camera follows the walking direction and
        // stays at a fixed eye height above the source mesh (never free-flying).
        this.transitSpeed=THREE.MathUtils.damp(this.transitSpeed,1.75,2.3,dt);
        const step=Math.min(delta.length(),dt*this.transitSpeed);
        const heading=Math.atan2(-d.x,-d.z);
        this.yaw=THREE.MathUtils.damp(this.yaw,heading,4,dt);
        this.pitch=THREE.MathUtils.damp(this.pitch,-.07,3,dt);
        this.transitTime+=dt*this.transitSpeed*8;
        const candidate=foot.clone().addScaledVector(d,step);
        let accepted=env.walkable(foot,candidate);
        if(!accepted){
          // A near-wall camera transition tries small sideways steps, never teleports.
          for(const side of [1,-1]){
            const trial=foot.clone().add(new THREE.Vector3(-d.z*step*side,0,d.x*step*side));
            if(env.walkable(foot,trial)){candidate.copy(trial);accepted=true;break;}
          }
        }
        if(accepted){
          this.camera.position.x=candidate.x;this.camera.position.z=candidate.z;
          const floor=env.floor(candidate.x,candidate.z,foot.y);
          if(floor!==null){
            const walkingBob=.017*Math.sin(this.transitTime)+.006*Math.sin(this.transitTime*2);
            this.camera.position.y=THREE.MathUtils.damp(this.camera.position.y,floor+EYE_HEIGHT+walkingBob,13,dt);
          }
          this.stalled=0;
        }else{
          this.stalled+=dt;
          if(this.stalled>1.4){this.show('ROUTE OBSTRUCTED · SEARCHING SAFE APPROACH',1.5);this.stalled=0;}
        }
        this.footstepTimer-=dt;if(this.footstepTimer<=0){this.audio.footsteps();this.footstepTimer=.5;}
      }
      gun.forceLower(true);gun.update(dt,{...zero},()=>null);this.effects.update(dt);
      this.camera.rotation.set(this.pitch,this.yaw,.008*Math.sin(this.transitTime),'YXZ');
      this.targetLocked=false;this.camera.fov=THREE.MathUtils.damp(this.camera.fov,78,5,dt);this.camera.updateProjectionMatrix();
      this.weaponCamera.fov=76;this.weaponCamera.updateProjectionMatrix();
      return;
    }
    gun.forceLower(false);
    const canFire=gun.ammo>0&&gun.reloadTimer<=0;
    gun.update(dt,controls,(localDir,maxRange,damage)=>{
      enemies.alert();this.cameraKick=Math.min(.25,this.cameraKick+.029);
      const origin=this.camera.position.clone();const dir=localDir.clone().applyQuaternion(this.camera.quaternion).normalize();
      const ray=new THREE.Ray(origin,dir);
      const terrainRay=new THREE.Raycaster(origin,dir,.07,maxRange);terrainRay.layers.set(1);
      const worldHit=terrainRay.intersectObjects(env.colliders,false)[0];
      const maxDist=worldHit?worldHit.distance:maxRange;
      const hit=enemies.shot(ray,maxDist,damage);
      const target=hit?.point??worldHit?.point??ray.at(maxRange,new THREE.Vector3());
      const muzzle=this.weapon!.muzzleWorld.applyQuaternion(this.camera.quaternion).add(this.camera.position);
      this.effects.tracer(muzzle,target);
      if(hit){this.score+=hit.score;if(hit.killed)this.show('TARGET NEUTRALIZED',.8);}
      else if(worldHit){
        const surface=String(worldHit.object.userData.surface??'').toLowerCase();
        const kind=surface.includes('ground')||surface.includes('dust')?'ground':surface.includes('metal')?'metal':'concrete';
        this.effects.impact(target,kind);this.audio.impact();
      }
      enemies.suppressNear(ray,hit?origin.distanceTo(hit.point):maxDist);
      return hit?{point:target,enemy:true,hit:true,killed:hit.killed,score:hit.score}:{point:target,enemy:false,hit:false,killed:false,score:0};
    });
    // Auto reload on zero ammo; no weapon firing during reload.
    if(gun.ammo<=0&&gun.reserve>0&&!gun.reload)gun.beginReload();
    enemies.update(dt,this.camera.position,(d)=>{
      this.health=Math.max(0,this.health-d);this.suppressed=Math.min(1.5,this.suppressed+.35);
      if(this.health<=0)this.finish('defeat');
    });
    if(enemies.alive===0&&this.clearedTimer<0){this.clearedTimer=1.25;this.score+=300;this.show('SECTOR CLEAR · ADVANCING',1.5);}
    if(this.clearedTimer>=0){this.clearedTimer-=dt;
      if(this.clearedTimer<0){if(this.wave>=env.cover.length-1)this.finish('victory');else{this.advanceTo=this.wave+1;this.path=[];this.moving=true;enemies.deactivate();this.transitTime=0;this.transitSpeed=0;this.targetLocked=false;}}}
    // A tighter world-space field of view is real scope magnification; the
    // separately rendered first-person model keeps its own natural projection.
    this.targetLocked=!!enemies.acquire(new THREE.Ray(this.camera.position.clone(),new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion).normalize()));
    const aim=gun.ads?38:76;
    this.camera.fov=THREE.MathUtils.damp(this.camera.fov,aim,8,dt);this.camera.updateProjectionMatrix();
    this.weaponCamera.fov=76;this.weaponCamera.updateProjectionMatrix();
    this.sway=Math.sin(performance.now()*.0013)*.007;
    this.camera.rotation.z=this.sway*.4;
    this.effects.update(dt);
    if(!canFire&&controls.fire&&gun.reloadTimer>0&&Math.random()<dt*.4)this.show('RELOADING',.35);
  }
  private finish(phase:'victory'|'defeat'){
    if(this.phase!== 'playing')return;
    this.phase=phase;this.controls={...zero};
    if(phase==='victory')this.audio.victory();else this.audio.defeat();this.onFinished?.(phase);this.publish();
  }
  private publish(){if(!this.weapon)return;
    this.camera.updateMatrixWorld(true);
    const enemyMarkers=(this.enemies?.enemies??[]).flatMap((e,id)=>{
      if(!e.alive||this.moving)return [];
      const point=e.head;
      if(this.environment?.obscured(this.camera.position,point))return [];
      const distance=point.distanceTo(this.camera.position);
      const projected=point.clone().project(this.camera);
      if(projected.z<=-1||projected.z>=1||Math.abs(projected.x)>0.92||Math.abs(projected.y)>0.82)return [];
      return [{id,x:(projected.x+1)*50,y:(1-projected.y)*50,distance:Math.round(distance),health:e.hp/e.maxHp,kind:e.kind}];
    });
    const w=this.weapon;const tracked=this.controls.tracked;
    const s:Snapshot={...EMPTY_SNAPSHOT,phase:this.phase,mission:'OPERATION BLACKOUT',waves:this.environment?.cover.length??6,objective:this.moving?'ADVANCING TO NEXT COVER':this.enemies?.hasAlerted?'ELIMINATE ALL HOSTILES':'SCAN AREA · OPEN FIRE TO ENGAGE',
      wave:this.wave+1,targets:this.enemies?.alive??0,health:this.health,ammo:w.ammo,reserve:w.reserve,score:this.score,
      accuracy:w.accuracy,shots:w.shots,hits:w.hits,reloading:w.reload,ads:w.ads,moving:this.moving,suppressed:this.suppressed>.2,targetLocked:this.targetLocked,enemyMarkers,
      tracked,cameraStatus:tracked?'RIGHT HAND TRACKED':'KEYBOARD / MOUSE',progress:w.reloadProgress,
      fps:Math.round(this.fps),message:this.messageTimer>0?this.message:''};
    this.onSnapshot?.(s);
  }
  dispose(){this.destroyed=true;cancelAnimationFrame(this.frameId);window.removeEventListener('resize',this.resize);
    this.enemies?.dispose();this.environment?.dispose();this.effects.dispose();this.weapon?.dispose();this.audio.dispose();this.renderer.dispose();}
}
