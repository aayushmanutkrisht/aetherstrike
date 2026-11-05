import * as THREE from 'three';
import {Environment} from './Environment';
import {EffectsManager} from './EffectsManager';
import {AudioManager} from './AudioManager';
import type {EnemyKind, EnemyState} from './types';
import {ENCOUNTERS} from './LevelLayout';

const SPECS:Record<EnemyKind,{hp:number;damage:number;frequency:number;speed:number;score:number}>={
  standard:{hp:100,damage:7,frequency:2.35,speed:1.2,score:100},
  armored:{hp:200,damage:9,frequency:2.7,speed:.9,score:180},
  heavy:{hp:260,damage:12,frequency:1.55,speed:.75,score:260},
  priority:{hp:140,damage:9,frequency:1.8,speed:1.5,score:350}
};

type Pose='idle'|'walk'|'shoot';
const FRAME_COUNT=8;
const frameCache=new Map<string,THREE.Texture>();
const framePromises=new Map<string,Promise<THREE.Texture>>();
const loader=new THREE.TextureLoader();
function frameKey(pose:Pose,variant:number,frame:number){return `${pose}_${variant%2}_${frame%FRAME_COUNT}`;}
function frameURL(key:string){return `${import.meta.env.BASE_URL}assets/enemy_animations/${key}.png`;}
/** Every frame is loaded, decoded and GPU-uploaded BEFORE campaign start. */
function frameTexture(pose:Pose,variant:number,frame:number):THREE.Texture{
  const key=frameKey(pose,variant,frame);
  const texture=frameCache.get(key);
  if(!texture)throw new Error(`Enemy animation ${key} was not preloaded.`);
  return texture;
}
async function preloadSpriteFrames(renderer:THREE.WebGLRenderer,progress?:(done:number,total:number)=>void){
  const keys:string[]=[];
  for(const pose of ['idle','walk','shoot'] as Pose[])
    for(let variant=0;variant<2;variant++)
      for(let frame=0;frame<FRAME_COUNT;frame++)keys.push(frameKey(pose,variant,frame));
  let done=0;
  await Promise.all(keys.map(async key=>{
    if(!framePromises.has(key)){
      framePromises.set(key,loader.loadAsync(frameURL(key)).then(texture=>{
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.minFilter=THREE.LinearMipmapLinearFilter;
        texture.magFilter=THREE.LinearFilter;
        frameCache.set(key,texture);
        return texture;
      }));
    }
    await framePromises.get(key)!;
    progress?.(++done,keys.length);
  }));
  // Upload before gameplay: otherwise the first frame of a new animation pose
  // can synchronously transfer a PNG to the GPU during combat/transit.
  for(let i=0;i<keys.length;i++){
    renderer.initTexture(frameCache.get(keys[i])!);
    if((i+1)%4===0)await nextFrame();
  }
}
function nextFrame():Promise<void>{return new Promise(resolve=>requestAnimationFrame(()=>resolve()));}
let nextVariant=0;

export class Enemy {
  root=new THREE.Group();
  sprite:THREE.Sprite;
  state:EnemyState='guarding';hp:number;maxHp:number;alive=true;alerted=false;suppressed=0;damageFlash=0;
  fireTimer=Math.random()*2.5;stateTimer=0;moveTo?:THREE.Vector3;
  readonly spec;
  lastShot=0;
  radius:number;bodyHeight:number;
  private variant:number;
  private cycle=0;
  private deathTime=0;
  private readonly width:number;
  private readonly height:number;

  constructor(public kind:EnemyKind,position:THREE.Vector3,private env:Environment,private effects:EffectsManager,private audio:AudioManager,private stage=0){
    const source=SPECS[kind];
    this.spec={...source,hp:Math.round(source.hp*(1+stage*.09)),damage:source.damage*(1+stage*.085),
      speed:source.speed*(1+stage*.045),frequency:Math.max(.85,source.frequency*(1-stage*.065))};
    this.hp=this.maxHp=this.spec.hp;
    // v1.5.6: around 63% shorter than the old 2.25-unit silhouette.
    const scale=kind==='heavy'?1.14:kind==='armored'?1.08:kind==='priority'?1.07:1;
    this.height=.83*scale;
    this.width=.49*scale;
    this.bodyHeight=this.height*.92;
    this.radius=this.width*.48;
    this.variant=(nextVariant++)%2;
    this.sprite=new THREE.Sprite(new THREE.SpriteMaterial({
      map:frameTexture('idle',this.variant,0),
      transparent:true,depthTest:true,depthWrite:false,alphaTest:.035,
      opacity:1,color:0xffffff
    }));
    // The sprite's bottom edge is exactly on the walkable terrain.
    // No root or sprite Y oscillation: walking is a real world-space movement.
    this.sprite.center.set(.5,0);
    this.sprite.scale.set(this.width,this.height,1);
    this.root.add(this.sprite);
    this.root.position.copy(position);
    const floor=this.env.floor(position.x,position.z,position.y);
    if(floor!==null)this.root.position.y=floor+.035;
    this.startPosition=this.root.position.clone();
  }
  private readonly startPosition:THREE.Vector3;
  /** Cheap rearm for replay. Never rebuild the sprite or redo terrain queries. */
  resetForRun(){
    this.hp=this.maxHp;
    this.alive=true;this.alerted=false;this.suppressed=0;this.damageFlash=0;
    this.fireTimer=Math.random()*2.5;this.stateTimer=0;this.moveTo=undefined;
    this.state='guarding';this.lastShot=0;this.cycle=0;this.deathTime=0;
    this.root.position.copy(this.startPosition);this.root.rotation.set(0,0,0);
    this.sprite.visible=true;this.sprite.position.set(0,0,0);
    this.sprite.scale.set(this.width,this.height,1);
    const material=this.sprite.material as THREE.SpriteMaterial;
    material.map=frameTexture('idle',this.variant,0);
    material.color.set(0xffffff);material.rotation=0;material.opacity=1;
  }
  get center(){return this.root.position.clone().add(new THREE.Vector3(0,this.bodyHeight*.52,0));}
  get head(){return this.root.position.clone().add(new THREE.Vector3(0,this.bodyHeight*.95,0));}
  hitBy(ray:THREE.Ray):number|null{
    if(!this.alive)return null;
    const a=this.root.position.clone().add(new THREE.Vector3(-this.radius,.03,-this.radius));
    const b=this.root.position.clone().add(new THREE.Vector3(this.radius,this.bodyHeight,this.radius));
    const hit=ray.intersectBox(new THREE.Box3(a,b),new THREE.Vector3());
    return hit?ray.origin.distanceTo(hit):null;
  }
  damage(amount:number,hitAt:THREE.Vector3){
    if(!this.alive)return false;
    this.hp=Math.max(0,this.hp-amount);
    this.alerted=true;this.damageFlash=.17;
    this.effects.impact(hitAt,'enemy');
    if(this.hp===0){
      this.alive=false;this.state='defeated';this.deathTime=0;this.moveTo=undefined;
      // A single high-visibility red fragment burst replaces the old fade-out.
      this.effects.enemyElimination(this.center);
    }else{
      this.state='hit';this.stateTimer=.27;this.suppressed=Math.max(this.suppressed,.45);
    }
    return !this.alive;
  }
  suppress(strength:number){
    if(!this.alive)return;
    this.suppressed=Math.min(2.8,this.suppressed+strength);
    this.alerted=true;
    if(this.suppressed>.65&&this.state!=='hit')this.state='suppressed';
  }
  private seekCover(){
    const side=Math.random()>.5?1:-1;
    const candidates=[
      new THREE.Vector3(this.root.position.x+side*2.7,0,this.root.position.z+1),
      new THREE.Vector3(this.root.position.x-side*2.2,0,this.root.position.z-1)
    ];
    for(const p of candidates){
      const ground=this.env.floor(p.x,p.z,this.root.position.y);
      if(ground===null)continue;
      p.y=ground+.035;
      if(this.env.walkable(this.root.position,p)){
        this.moveTo=p;
        this.state=this.suppressed>.5?'taking-cover':'repositioning';
        this.stateTimer=2.7;
        return;
      }
    }
    this.moveTo=undefined;this.state='aiming';
  }
  private animate(dt:number){
    // PNG flipbook animation: standing breath / eight-frame leg movement / recoil.
    // Crucially no visual root-height bob, so boots stay grounded.
    let pose:Pose='idle';
    let frame=0;
    if(this.moveTo){
      pose='walk';this.cycle+=dt*12;
      frame=Math.floor(this.cycle)%FRAME_COUNT;
    }else if(this.lastShot>0){
      pose='shoot';
      frame=Math.max(0,Math.min(FRAME_COUNT-1,Math.floor((.32-this.lastShot)*26)));
    }else if(this.alerted&&(this.state==='aiming'||this.state==='shooting'||this.state==='suppressed')){
      pose='shoot';frame=0;
    }else{
      pose='idle';this.cycle+=dt*3;
      frame=Math.floor(this.cycle)%FRAME_COUNT;
    }
    const material=this.sprite.material as THREE.SpriteMaterial;
    material.map=frameTexture(pose,this.variant,frame);
    material.color.set(this.damageFlash>0?0xffd8c8:0xffffff);
    // Fire impulse tilts the rifle artwork slightly, not the whole enemy into the air.
    material.rotation=this.lastShot>0?-.035*Math.sin((.32-this.lastShot)*22):0;
  }
  update(dt:number,player:THREE.Vector3,dealDamage:(amount:number)=>void,combatActive:boolean){
    if(!this.alive){
      this.deathTime+=dt;
      // Short grounded collapse. No opacity fade: the particles do the disappearance.
      if(this.deathTime<.18)this.sprite.scale.y=this.height*(1-this.deathTime/.18);
      else this.sprite.visible=false;
      return;
    }
    this.damageFlash=Math.max(0,this.damageFlash-dt);
    this.suppressed=Math.max(0,this.suppressed-dt*.25);
    this.lastShot=Math.max(0,this.lastShot-dt);
    this.animate(dt);
    if(!combatActive||!this.alerted){this.state='guarding';return;}
    if(this.state==='hit'){
      this.stateTimer-=dt;
      if(this.stateTimer<=0)this.state='alerted';
      return;
    }
    if(this.state==='alerted'||this.state==='guarding')this.seekCover();
    if(this.moveTo){
      const offset=this.moveTo.clone().sub(this.root.position);offset.y=0;
      if(offset.length()<.25||this.stateTimer<0){
        this.moveTo=undefined;this.state='aiming';
      }else{
        const step=Math.min(offset.length(),dt*this.spec.speed);
        const next=this.root.position.clone().addScaledVector(offset.normalize(),step);
        if(!this.env.walkable(this.root.position,next)){
          this.moveTo=undefined;this.state='aiming';return;
        }
        this.root.position.x=next.x;this.root.position.z=next.z;
        const floor=this.env.floor(next.x,next.z,this.root.position.y);
        if(floor!==null)this.root.position.y=THREE.MathUtils.damp(this.root.position.y,floor+.035,12,dt);
        this.stateTimer-=dt;
        return;
      }
    }
    this.fireTimer-=dt*(this.suppressed>.55?.4:1);
    if(this.suppressed>.65&&Math.random()<dt*.45){this.seekCover();return;}
    const eye=this.center.clone().add(new THREE.Vector3(0,.15,0));
    const target=player.clone().add(new THREE.Vector3(0,-.17,0));
    if(this.fireTimer<=0){
      if(!this.env.obscured(eye,target)&&player.distanceTo(this.root.position)<34){
        this.state='shooting';
        this.lastShot=.32;
        this.audio.enemyGun();
        this.effects.enemyMuzzleFlash(this.root.position.clone().add(new THREE.Vector3(this.width*.37,this.height*.54,.025)));
        const miss=Math.random()<Math.max(.25,.62-this.stage*.057+this.suppressed*.12);
        const dest=miss?target.clone().add(new THREE.Vector3((Math.random()-.5)*4,(Math.random()-.5)*2,0)):target;
        this.effects.tracer(eye,dest);
        if(!miss)dealDamage(this.spec.damage);
      }else this.state='searching';
      this.fireTimer=this.spec.frequency*(.7+Math.random()*.65);
      if(Math.random()<.22)this.seekCover();
    }else if(this.state!=='suppressed')this.state='aiming';
  }
  dispose(){
    this.root.parent?.remove(this.root);
    this.sprite.material.dispose();
  }
}

/**
 * The entire campaign is assembled on the LOADING screen. Each sector owns an
 * invisible Group. Only the active sector can animate, attack, take damage or
 * appear on the HUD. Advancing to cover never builds new objects or raycasts
 * for placements, so health/ammo resupply stays independent of loading.
 */
export class EnemyManager {
  enemies:Enemy[]=[];hasAlerted=false;
  private readonly sectors:THREE.Group[]=[];
  private readonly sectorEnemies:Enemy[][]=[];
  private activeSector=-1;
  private isPrepared=false;
  private disposed=false;
  constructor(private scene:THREE.Scene,private env:Environment,private fx:EffectsManager,private audio:AudioManager){}

  async prepareAll(renderer:THREE.WebGLRenderer,onProgress?:(message:string)=>void){
    if(this.isPrepared)return;
    onProgress?.('LOADING ALL ENEMY ANIMATION FRAMES');
    await preloadSpriteFrames(renderer,(done,total)=>onProgress?.(`ENEMY SPRITES ${done}/${total} LOADED`));
    if(this.disposed)return;
    const total=ENCOUNTERS.reduce((sum,placements)=>sum+placements.length,0);
    let prepared=0;
    try{
      for(let wave=0;wave<ENCOUNTERS.length;wave++){
        const cover=this.env.cover[wave].position;
        const eye=cover.clone().add(new THREE.Vector3(0,1.03,0));
        const occupied:THREE.Vector3[]=[];
        const group=new THREE.Group();
        group.visible=false;
        group.name=`INACTIVE_ENCOUNTER_${wave+1}`;
        this.sectors.push(group);
        this.sectorEnemies.push([]);
        this.scene.add(group);
        for(const {x,z,kind} of ENCOUNTERS[wave]){
          const position=await this.findSpawnPosition(x,z,cover,eye,occupied);
          if(this.disposed)return;
          if(position){
            occupied.push(position);
            const enemy=new Enemy(kind,position,this.env,this.fx,this.audio,wave);
            group.add(enemy.root);
            this.sectorEnemies[wave].push(enemy);
          }else{
            console.warn(`Sector ${wave+1}: no valid visible floor for ${kind} near ${x}, ${z}.`);
          }
          prepared++;
          onProgress?.(`PREPARING SECTOR ${wave+1}/${ENCOUNTERS.length} · ${prepared}/${total} ENEMIES`);
          // Keep render loop and the loading overlay responsive at startup.
          await nextFrame();
        }
      }
      this.isPrepared=true;
      console.info('AETHER STRIKE: All six enemy sectors prepared before campaign start',
        this.sectorEnemies.map((group,i)=>({sector:i+1,enemies:group.length})));
    }catch(error){this.dispose();throw error;}
  }

  private async findSpawnPosition(x:number,z:number,cover:THREE.Vector3,eye:THREE.Vector3,occupied:THREE.Vector3[]){
    const possibilities:{pos:THREE.Vector3;score:number}[]=[];
    let lastYield=performance.now();
    // Same authored anchors and collision/visibility filters as v1.5.7.
    // Only their calculation TIME changes: it happens before the Start button enables.
    for(let n=0;n<80;n++){
      const px=n===0?x:n<33?x+Math.cos(n*2.39996)*(.35+.43*Math.sqrt(n)):cover.x+Math.sin(n*2.4)*(1.4+(n%5)*.63);
      const pz=n===0?z:n<33?z+Math.sin(n*2.39996)*(.35+.43*Math.sqrt(n)):cover.z-(3+(n%8)*1.02);
      const candidate=this.env.findStanding(px,pz);
      if(candidate){
        const delta=candidate.clone().sub(cover);const dist=Math.hypot(delta.x,delta.z);
        if(dist>=4.8&&dist<=18&&delta.z<=-.95){
          const bearing=Math.atan2(-delta.x,-delta.z);
          if(Math.abs(bearing)<=.98&&Math.abs(candidate.y-cover.y)<=1.25&&
             !occupied.some(other=>other.distanceTo(candidate)<1.4)&&
             !this.env.obscured(eye,candidate.clone().add(new THREE.Vector3(0,.5,0)))){
            const score=Math.hypot(candidate.x-x,candidate.z-z)+Math.abs(bearing)*.8+Math.abs(candidate.y-cover.y)*.35;
            // The authored anchor is always preferable if it is valid. This
            // skips the expensive spiral search for the usual case.
            if(n===0)return candidate;
            possibilities.push({pos:candidate,score});
          }
        }
      }
      if(n>12&&possibilities.length>=6)break;
      // Cap bursts of expensive raycasts; no preparation work occurs in gameplay.
      if(performance.now()-lastYield>3){await nextFrame();lastYield=performance.now();}
    }
    possibilities.sort((a,b)=>a.score-b.score);
    return possibilities[0]?.pos??null;
  }

  /** Does not allocate objects, search terrain, or fetch any image. */
  activate(wave:number){
    if(!this.isPrepared)throw new Error('Enemy sectors are not ready; wait for the loading screen.');
    if(wave<0||wave>=this.sectors.length)throw new RangeError(`Unknown sector ${wave}`);
    if(this.activeSector===wave)return;
    if(this.activeSector>=0)this.sectors[this.activeSector].visible=false;
    this.activeSector=wave;
    this.enemies=this.sectorEnemies[wave];
    this.hasAlerted=false;
    this.sectors[wave].visible=true;
  }
  /** Hide EVERYTHING during transit, including previous corpses. */
  deactivate(){
    if(this.activeSector>=0)this.sectors[this.activeSector].visible=false;
    this.activeSector=-1;this.enemies=[];this.hasAlerted=false;
  }
  /** Reset all six prepared sectors for a new campaign, without respawning. */
  resetCampaign(){
    if(!this.isPrepared)throw new Error('The enemy preload is incomplete.');
    this.deactivate();
    for(const wave of this.sectorEnemies)for(const enemy of wave)enemy.resetForRun();
  }
  acquire(ray:THREE.Ray,maxDistance=90):Enemy|null{
    if(this.activeSector<0)return null;
    let selected:Enemy|null=null,range=maxDistance;
    for(const e of this.enemies){
      const distance=e.hitBy(ray);if(distance===null||distance>=range)continue;
      const point=ray.at(distance,new THREE.Vector3());
      if(this.env.obscured(ray.origin,point))continue;
      range=distance;selected=e;
    }
    return selected;
  }
  alert(){
    if(this.activeSector<0||this.hasAlerted)return;
    this.hasAlerted=true;this.audio.alert();
    for(const e of this.enemies){e.alerted=true;e.state='alerted';}
  }
  update(dt:number,player:THREE.Vector3,dealDamage:(amount:number)=>void){
    if(this.activeSector<0)return;
    for(const e of this.enemies)e.update(dt,player,dealDamage,this.hasAlerted);
  }
  shot(ray:THREE.Ray,maxLength:number,damage:number){
    if(this.activeSector<0)return null;
    let enemy:Enemy|undefined,range=maxLength;
    for(const e of this.enemies){const d=e.hitBy(ray);if(d!==null&&d<range){range=d;enemy=e;}}
    if(!enemy)return null;
    const point=ray.at(range,new THREE.Vector3());const killed=enemy.damage(damage,point);
    this.audio.hit();return{enemy,point,killed,score:killed?enemy.spec.score:15};
  }
  suppressNear(ray:THREE.Ray,hitDistance:number){
    if(this.activeSector<0)return;
    for(const e of this.enemies){
      if(!e.alive)continue;
      const t=ray.direction.dot(e.center.clone().sub(ray.origin));if(t<0||t>hitDistance+2)continue;
      const min=ray.at(t,new THREE.Vector3()).distanceTo(e.center);
      if(min<2.2)e.suppress(min<1?.16:.065);
    }
  }
  get alive(){return this.enemies.filter(e=>e.alive).length;}
  get preparedCount(){return this.sectorEnemies.reduce((sum,group)=>sum+group.length,0);}
  get sectorCounts(){return this.sectorEnemies.map(group=>group.length);}
  dispose(){
    this.disposed=true;this.deactivate();
    for(const wave of this.sectorEnemies)for(const e of wave)e.dispose();
    for(const group of this.sectors)group.parent?.remove(group);
    this.sectors.length=0;this.sectorEnemies.length=0;this.isPrepared=false;
  }
}
