import type {NormalizedLandmark} from '@mediapipe/tasks-vision';

export type Gesture = 'open' | 'fist' | 'pinch' | 'unknown';
/** Positive turn = palm moving right. Positive tilt = palm moving upward. Both are radians/second. */
export interface GestureFrame {
  gesture:Gesture;
  turn:number;
  tilt:number;
  fire:boolean;
  ads:boolean;
  reload:boolean;
  tracked:boolean;
  confidence:number;
  pinchRatio?:number;
  curledFingers?:number;
}
const distance=(a:NormalizedLandmark,b:NormalizedLandmark)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));

/** Camera-relative, two-axis pointing with temporally gated pinch/fist controls. */
export class GestureDetector {
  private lastX:number|null=null;
  private lastY:number|null=null;
  private lastFrame=0;
  private filteredTurn=0;
  private filteredTilt=0;
  private pinchDown=false;
  private pinchSince=0;
  private pendingTapAt=-Infinity;
  private reloadPinch=false;
  private fistFrames=0;
  private releaseOpenFrames=0;
  private adsActive=false;
  private pinchFrames=0;

  reset(){
    this.lastX=null;this.lastY=null;this.lastFrame=0;
    this.filteredTurn=0;this.filteredTilt=0;
    this.pinchDown=false;this.pinchSince=0;this.pendingTapAt=-Infinity;
    this.reloadPinch=false;this.fistFrames=0;this.releaseOpenFrames=0;
    this.adsActive=false;this.pinchFrames=0;
  }
  lost(_now:number):GestureFrame{
    this.reset();
    return {gesture:'unknown',turn:0,tilt:0,fire:false,ads:false,reload:false,tracked:false,confidence:0};
  }
  evaluate(l:NormalizedLandmark[],now:number,deadzone=.0025):GestureFrame{
    if(l.length!==21||l.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return this.lost(now);
    if(this.lastFrame&&now-this.lastFrame>260)this.reset();

    const palm=Math.max(.045,distance(l[5],l[17]),distance(l[0],l[9])*.73);
    const pinchRatio=distance(l[4],l[8])/palm;
    const fingers=[8,12,16,20];
    const folded=fingers.map(tip=>distance(l[tip],l[0])<distance(l[tip-2],l[0])*.94);
    const curled=folded.filter(Boolean).length;
    const fullFist=curled===4;
    const fistCandidate=fullFist||(curled>=3&&pinchRatio>.65);
    const pinchCandidate=!fullFist&&curled<=3&&pinchRatio<(this.pinchDown?.61:.43);
    const releaseCandidate=fullFist||pinchRatio>.65||!pinchCandidate;

    let reload=false;
    if(!this.pinchDown){
      this.pinchFrames=pinchCandidate?this.pinchFrames+1:0;
      if(this.pinchFrames>=2){
        this.pinchDown=true;this.pinchSince=now;
        this.reloadPinch=(now-this.pendingTapAt>=65&&now-this.pendingTapAt<445);
        if(this.reloadPinch){reload=true;this.pendingTapAt=-Infinity;}
        this.pinchFrames=0;
      }
    }else if(releaseCandidate){
      const held=now-this.pinchSince;
      if(held<=220&&!this.reloadPinch)this.pendingTapAt=now;
      else this.pendingTapAt=-Infinity;
      this.pinchDown=false;this.reloadPinch=false;this.pinchFrames=0;
    }
    if(now-this.pendingTapAt>445)this.pendingTapAt=-Infinity;

    // ADS is latched by a deliberate fist and remains engaged during a pinch.
    // Only a stable *open* hand releases it; intermediate frames while changing
    // from fist to pinch must not cancel aiming. Lost tracking resets the latch.
    if(fistCandidate&&!this.pinchDown){this.fistFrames++;this.releaseOpenFrames=0;}
    else this.fistFrames=0;
    if(this.fistFrames>=2)this.adsActive=true;
    const deliberateOpen=!this.pinchDown&&!fistCandidate&&curled<=1&&pinchRatio>.70;
    if(deliberateOpen)this.releaseOpenFrames++;
    else this.releaseOpenFrames=0;
    if(this.releaseOpenFrames>=4)this.adsActive=false;
    const fire=this.pinchDown&&!this.reloadPinch&&now-this.pinchSince>=100;
    const gesture:Gesture=this.pinchDown?'pinch':this.adsActive?'fist':curled<=2?'open':'unknown';

    // Only the wrist and stable palm knuckles determine steering. Excluding fingertips
    // prevents aim jumping when the hand changes between a fist and a pinch.
    const cx=(l[0].x+l[5].x+l[9].x+l[13].x+l[17].x)/5;
    const cy=(l[0].y+l[5].y+l[9].y+l[13].y+l[17].y)/5;
    const dt=this.lastFrame?clamp((now-this.lastFrame)/1000,.014,.13):.033;
    let targetX=0,targetY=0;
    if(this.lastX!==null&&this.lastY!==null&&this.lastFrame>0){
      const dx=cx-this.lastX;
      const dy=this.lastY-cy; // image Y increases downwards; hand UP => aim UP
      const zone=Math.max(.0004,deadzone);
      const response=(delta:number)=>Math.sign(delta)*clamp(Math.max(0,Math.abs(delta)-zone)/dt*4.5,0,6.5);
      targetX=response(dx);
      targetY=response(dy);
    }
    this.lastX=cx;this.lastY=cy;this.lastFrame=now;
    const alpha=1-Math.exp(-dt*22);
    this.filteredTurn+=(targetX-this.filteredTurn)*alpha;
    this.filteredTilt+=(targetY-this.filteredTilt)*alpha;
    if(Math.abs(this.filteredTurn)<.025)this.filteredTurn=0;
    if(Math.abs(this.filteredTilt)<.025)this.filteredTilt=0;

    const separation=Math.abs(pinchRatio-(this.pinchDown?.43:.65));
    const confidence=clamp(.50+separation*.34+(this.adsActive||this.pinchDown?.10:0),.50,.99);
    return {gesture,turn:this.filteredTurn,tilt:this.filteredTilt,fire,ads:this.adsActive,
      reload,tracked:true,confidence,pinchRatio,curledFingers:curled};
  }
}
