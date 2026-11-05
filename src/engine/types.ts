export type GraphicsQuality='low'|'medium'|'high';
export type GamePhase='menu'|'training'|'playing'|'paused'|'victory'|'defeat';
export type EnemyKind='standard'|'armored'|'heavy'|'priority';
export type EnemyState='guarding'|'patrolling'|'alerted'|'searching'|'aiming'|'shooting'|'taking-cover'|'repositioning'|'suppressed'|'hit'|'defeated';
export interface Controls {fire:boolean; ads:boolean; turn:number; tilt:number; reload:boolean; tracked:boolean;}
export interface Settings {sensitivity:number;deadzone:number;quality:GraphicsQuality;audio:boolean;invert:boolean;weaponOffset:number;weaponSize:number;}
export interface EnemyMarker {id:number;x:number;y:number;distance:number;health:number;kind:EnemyKind;}
export interface Snapshot {phase:GamePhase;mission:string;objective:string;wave:number;waves:number;targets:number;health:number;ammo:number;reserve:number;score:number;accuracy:number;shots:number;hits:number;reloading:boolean;ads:boolean;moving:boolean;suppressed:boolean;targetLocked:boolean;enemyMarkers:EnemyMarker[];tracked:boolean;cameraStatus:string;progress:number;message:string;fps:number;}
export const DEFAULT_SETTINGS: Settings={sensitivity:1.35,deadzone:.0025,quality:'medium',audio:true,invert:false,weaponOffset:0,weaponSize:1};
export const EMPTY_SNAPSHOT:Snapshot={phase:'menu',mission:'OPERATION BLACKOUT',objective:'Awaiting deployment',wave:0,waves:6,targets:0,health:100,ammo:80,reserve:480,score:0,accuracy:100,shots:0,hits:0,reloading:false,ads:false,moving:false,suppressed:false,targetLocked:false,enemyMarkers:[],tracked:false,cameraStatus:'OFFLINE',progress:0,message:'',fps:0};
