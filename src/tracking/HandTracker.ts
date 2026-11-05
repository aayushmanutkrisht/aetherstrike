import {FilesetResolver,HandLandmarker,type NormalizedLandmark} from '@mediapipe/tasks-vision';
import {GestureDetector,type GestureFrame} from './GestureDetector';
import {hasPlausibleLocalHandModel,modelCandidates} from './ModelBundle';

export type TrackerStatus='OFFLINE'|'REQUESTING CAMERA'|'LOADING AI'|'CAMERA READY'|'TRACKING'|'HAND LOST'|'VISION ERROR'|'ERROR';

/** Camera and AI have separate lifetimes: an AI download/GPU error must NEVER kill a working camera feed. */
export class HandTracker {
  readonly video=document.createElement('video');
  private inputCanvas=document.createElement('canvas');
  private context=this.inputCanvas.getContext('2d',{alpha:false});
  private hand?:HandLandmarker;private stream?:MediaStream;
  private detector=new GestureDetector();private task?:number;private lastTime=-1;
  private active=false;private session=0;private latestStatus:TrackerStatus='OFFLINE';
  onFrame?:(frame:GestureFrame)=>void;
  onLandmarks?:(landmarks:NormalizedLandmark[]|null)=>void;
  /** Most webcams are unmirrored; the processing canvas is mirrored for intuitive steering. */
  private selectedLabel:'Left'|'Right'='Left';
  private lastSeenAt=0;private lastDetectionAt=0;
  readonly webcamFPS=30;
  onStatus?:(s:TrackerStatus)=>void;
  onError?:(message:string)=>void;
  deadzone=.0025;
  toggleHandedness(){this.selectedLabel=this.selectedLabel==='Left'?'Right':'Left';this.calibrate();return this.selectedLabel;}
  get trackingLabel(){return this.selectedLabel;}
  constructor(){this.video.autoplay=true;this.video.playsInline=true;this.video.muted=true;this.inputCanvas.width=640;this.inputCanvas.height=480;}
  private status(value:TrackerStatus){if(value!==this.latestStatus){this.latestStatus=value;this.onStatus?.(value);}}
  private describe(error:unknown):string {
    if(error instanceof DOMException){
      if(error.name==='NotAllowedError'||error.name==='PermissionDeniedError')return 'Camera permission denied. Allow this website to use the camera in browser site settings.';
      if(error.name==='NotFoundError'||error.name==='DevicesNotFoundError')return 'No webcam was found. Connect a webcam and try again.';
      if(error.name==='NotReadableError'||error.name==='TrackStartError')return 'Webcam is busy or blocked by another app. Close other camera applications and retry.';
      if(error.name==='OverconstrainedError')return 'Camera does not support the requested video settings.';
      if(error.name==='SecurityError')return 'Camera access was blocked by browser security settings.';
    }
    if(error instanceof Error)return `${error.name}: ${error.message}`;
    if(typeof error==='object'&&error!==null){const obj=error as {message?:unknown;type?:unknown};return String(obj.message??obj.type??'Unknown browser media error');}
    return String(error);
  }
  async start():Promise<void>{
    this.stop(false);const session=++this.session;this.active=true;this.status('REQUESTING CAMERA');this.onError?.('');
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
      const message='Webcam requires HTTPS or http://localhost (not a plain HTTP public link or file:// page). Open the deployed game over HTTPS and allow camera permission.';
      this.status('ERROR');this.active=false;this.onError?.(message);throw new Error(message);
    }
    try{
      // Avoid strict facingMode/resolution constraints on external desktop webcams.
      try{this.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:24}}});}
      catch(error){if(error instanceof DOMException&&error.name==='OverconstrainedError')this.stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});else throw error;}
      if(!this.active||this.session!==session){this.stream?.getTracks().forEach(t=>t.stop());return;}
      if(!this.stream)throw new Error('Browser returned no video stream');
      this.video.srcObject=this.stream;
      this.video.onloadedmetadata=null;
      // Wait for metadata without assuming video.play() always resolves immediately.
      await this.video.play();
      if(!this.active||this.session!==session)return;
      this.stream.getVideoTracks()[0]?.addEventListener('ended',()=>{
        if(this.active&&this.session===session){this.onError?.('Camera stream ended. Check camera permissions or device connection.');this.stop();}
      },{once:true});
      this.status('CAMERA READY');
      this.schedule(session); // preview and lost-hand safety are active before AI loads
      void this.initVision(session);
    }catch(error){const message=this.describe(error);this.onError?.(message);this.stop(false);this.status('ERROR');throw new Error(message);}
  }
  private async initVision(session:number){
    this.status('LOADING AI');
    try{
      const base=import.meta.env.BASE_URL;
      const localWasm=`${base}mediapipe`;
      const localModel=`${base}mediapipe/hand_landmarker.task`;
      // v1.4 used modelAssetPath successfully. Restore that path-based API:
      // custom ZIP parsing in v1.5.1 incorrectly rejected official models.
      const localModelPresent=await hasPlausibleLocalHandModel(localModel);
      if(!this.active||session!==this.session)return;
      // WASM must be binary, not a SPA HTML fallback either. Prefer the
      // versioned CDN when local runtime files weren't copied on install.
      let hasWasm=false;
      try {
        const response=await fetch(`${localWasm}/vision_wasm_internal.wasm`,{cache:'no-store'});
        if(response.ok){
          const reader=response.body?.getReader();
          if(reader){
            const first=await reader.read();
            await reader.cancel();
            const data=first.value;
            hasWasm=!!data&&data.length>=4&&data[0]===0&&data[1]===97&&data[2]===115&&data[3]===109;
          }
        }
      }catch{ /* Use pinned CDN fallback below. */ }
      const resolver=await FilesetResolver.forVisionTasks(hasWasm?localWasm:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
      if(!this.active||session!==this.session)return;
      const options={runningMode:'VIDEO' as const,numHands:2,minHandDetectionConfidence:.47,minHandPresenceConfidence:.46,minTrackingConfidence:.45};
      let newHand:HandLandmarker|undefined;
      const failures:string[]=[];
      // MediaPipe validates the real model contents. If a local copy is corrupt,
      // automatically retry the official model rather than disabling tracking.
      for(const modelAssetPath of modelCandidates(localModel,localModelPresent)){
        for(const delegate of ['GPU','CPU'] as const){
          if(!this.active||session!==this.session)return;
          try {
            newHand=await HandLandmarker.createFromOptions(resolver,{
              ...options,baseOptions:{modelAssetPath,delegate}
            });
            break;
          } catch(error){
            failures.push(`${modelAssetPath===localModel?'local':'official'} / ${delegate}: ${this.describe(error)}`);
          }
        }
        if(newHand)break;
      }
      if(!newHand)throw new Error(`Hand Landmarker initialization failed. ${failures.join(' | ')}`);
      if(!this.active||session!==this.session){newHand.close();return;}
      this.hand=newHand;this.status('HAND LOST');
    }catch(error){
      if(this.active&&session===this.session){
        this.onError?.(`Webcam works, but MediaPipe hand tracking could not initialize: ${this.describe(error)}. The webcam stays open. Try npm.cmd run prepare:vision or add the official .task to public/mediapipe/, then restart tracking.`);
        this.status('VISION ERROR');
      }
    }
  }
  private schedule(session:number){
    const step=(now:number)=>{
      if(!this.active||session!==this.session)return;
      // Never perform synchronous vision inference at 60+ FPS, and never keep a stale
      // pinch active if the webcam stalls or stops delivering fresh frames.
      const fresh=this.video.readyState>=2&&this.lastTime!==this.video.currentTime;
      if(this.hand&&fresh&&now-this.lastDetectionAt>=1000/this.webcamFPS){
        this.lastTime=this.video.currentTime;this.lastDetectionAt=now;
        try{
          if(!this.context)throw new Error('Webcam processing canvas unavailable');
          const ctx=this.context;
          ctx.save();
          try{ctx.setTransform(-1,0,0,1,640,0);ctx.drawImage(this.video,0,0,640,480);}
          finally{ctx.restore();}
          const result=this.hand.detectForVideo(this.inputCanvas,now);
          // MediaPipe's handedness labels assume mirrored/selfie imagery. Our
          // input is mirrored; on hardware-mirrored devices toggle the label.
          const selected=result.handednesses?.findIndex(h=>h[0]?.categoryName===this.selectedLabel)??-1;
          const landmarks=selected>=0?result.landmarks[selected]:undefined;
          if(landmarks){
            this.lastSeenAt=now;this.status('TRACKING');
            this.onLandmarks?.(landmarks);
            this.onFrame?.(this.detector.evaluate(landmarks,now,this.deadzone));
          }else{
            this.lastSeenAt=0;this.status('HAND LOST');
            this.onLandmarks?.(null);
            this.onFrame?.(this.detector.lost(now));
          }
        }catch(error){
          this.lastSeenAt=0;this.onLandmarks?.(null);
          this.onFrame?.(this.detector.lost(now));
          this.onError?.(`Hand processing interrupted: ${this.describe(error)}`);
          this.status('VISION ERROR');
        }
      }else if(this.hand&&this.lastSeenAt>0&&now-this.lastSeenAt>220){
        this.lastSeenAt=0;this.status('HAND LOST');this.onLandmarks?.(null);
        this.onFrame?.(this.detector.lost(now));
      }else if(!this.hand && this.lastSeenAt>0){
        this.lastSeenAt=0;this.onLandmarks?.(null);this.onFrame?.(this.detector.lost(now));
      }
      this.task=requestAnimationFrame(step);
    };
    this.task=requestAnimationFrame(step);
  }
  calibrate(){this.detector.reset();this.lastSeenAt=0;this.onLandmarks?.(null);this.onFrame?.(this.detector.lost(performance.now()));}
  stop(changeStatus=true){
    this.active=false;this.session++;if(this.task!==undefined)cancelAnimationFrame(this.task);this.task=undefined;
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;
    this.video.pause();this.video.srcObject=null;this.hand?.close();this.hand=undefined;
    this.lastTime=-1;this.lastDetectionAt=0;this.lastSeenAt=0;this.onLandmarks?.(null);this.detector.reset();this.onFrame?.(this.detector.lost(performance.now()));
    if(changeStatus)this.status('OFFLINE');
  }
}
