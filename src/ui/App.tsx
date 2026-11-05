import {useCallback,useEffect,useRef,useState} from 'react';
import {Activity,ArrowLeft,AudioLines,Camera,Check,ChevronRight,CircleHelp,Crosshair,Hand,Keyboard,Menu,Pause,Play,RotateCcw,Settings2,ShieldAlert,ShieldCheck,Target,Trophy,UserRound,Volume2,VolumeX,Wifi,WifiOff,X} from 'lucide-react';
import {GameEngine} from '../engine/GameEngine';
import {LeaderboardPanel} from './LeaderboardPanel';
import {addScore,clearScores,normalizeName,readName,readScores,saveName,scoresToCSV,topPlayers,validName} from '../leaderboard/Leaderboard';
import {HandTracker,type TrackerStatus} from '../tracking/HandTracker';
import {DEFAULT_SETTINGS,EMPTY_SNAPSHOT,type Settings,type Snapshot} from '../engine/types';
import type {GestureFrame} from '../tracking/GestureDetector';
import type {NormalizedLandmark} from '@mediapipe/tasks-vision';

type Panel='settings'|'calibration'|'credits'|'guide'|'leaderboard'|null;
const DEFAULT_FRAME:GestureFrame={gesture:'unknown',turn:0,tilt:0,fire:false,ads:false,reload:false,tracked:false,confidence:0};
const pad=(n:number)=>String(Math.max(0,Math.floor(n))).padStart(2,'0');

export function App(){
  const canvas=useRef<HTMLCanvasElement>(null);
  const engine=useRef<GameEngine|null>(null);
  const tracker=useRef<HandTracker|null>(null);
  const cameraView=useRef<HTMLVideoElement>(null);
  const cameraOverlay=useRef<HTMLCanvasElement>(null);
  const [trackingLabel,setTrackingLabel]=useState('Left');
  const settingsRef=useRef<Settings>({...DEFAULT_SETTINGS});
  const [settings,setSettings]=useState<Settings>({...DEFAULT_SETTINGS});
  const [snapshot,setSnapshot]=useState<Snapshot>({...EMPTY_SNAPSHOT});
  const [loaded,setLoaded]=useState(false);
  const [loadText,setLoadText]=useState('INITIALIZING ENGINE');
  const [error,setError]=useState('');
  const [panel,setPanel]=useState<Panel>(null);
  const [status,setStatus]=useState<TrackerStatus>('OFFLINE');
  const [gesture,setGesture]=useState<GestureFrame>(DEFAULT_FRAME);
  const [training,setTraining]=useState(false);
  const [camBusy,setCamBusy]=useState(false);
  const [playerName,setPlayerName]=useState(()=>readName());
  const [nameError,setNameError]=useState('');
  const [leaderboard,setLeaderboard]=useState(()=>readScores());
  const [scoreNotice,setScoreNotice]=useState('');
  const playerNameInput=useRef<HTMLInputElement>(null);
  const runRef=useRef<{name:string;training:boolean;logged:boolean}|null>(null);


  useEffect(()=>{
    if(!canvas.current)return;
    const game=new GameEngine(canvas.current);engine.current=game;
    game.onSnapshot=setSnapshot;
    game.onLoaded=(done,message)=>{setLoaded(done);setLoadText(message);};
    game.load().catch(e=>setError(e instanceof Error?e.message:String(e)));
    const hand=new HandTracker();tracker.current=hand;
    hand.onStatus=(v)=>setStatus(prev=>prev===v?prev:v);
    // Overlay exact 21 tracked landmarks over the mirrored video preview.
    // This makes lighting/framing/which-hand problems observable during calibration.
    hand.onLandmarks=(points:NormalizedLandmark[]|null)=>{
      const canvas=cameraOverlay.current,ctx=canvas?.getContext('2d');
      if(!canvas||!ctx)return;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(!points)return;
      const chains=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],
        [9,13,14,15,16],[13,17,18,19,20],[0,17]];
      ctx.strokeStyle='rgba(184,249,146,.85)';ctx.lineWidth=2.6;
      for(const chain of chains){ctx.beginPath();chain.forEach((index,i)=>{
        const p=points[index];if(i===0)ctx.moveTo(p.x*640,p.y*480);else ctx.lineTo(p.x*640,p.y*480);
      });ctx.stroke();}
      points.forEach((point,i)=>{
        ctx.beginPath();ctx.arc(point.x*640,point.y*480,i===4||i===8?7:3.4,0,Math.PI*2);
        ctx.fillStyle=i===4||i===8?'#ffa06e':'#d5ffb6';ctx.fill();
      });
    };
    hand.onError=(message)=>setError(message);
    hand.onFrame=(v)=>{
      game.setGesture({fire:v.fire,ads:v.ads,turn:v.turn,tilt:v.tilt,reload:v.reload,tracked:v.tracked});
      setGesture(old=>old.gesture===v.gesture&&old.tracked===v.tracked&&old.reload===v.reload&&Math.abs(old.turn-v.turn)<.08&&Math.abs(old.tilt-v.tilt)<.08&&Math.abs((old.pinchRatio??0)-(v.pinchRatio??0))<.05&&old.curledFingers===v.curledFingers?old:v);
    };
    return ()=>{hand.stop();game.dispose();if(engine.current===game)engine.current=null;if(tracker.current===hand)tracker.current=null;};
  },[]);

  useEffect(()=>{settingsRef.current=settings;engine.current?.setSettings(settings);if(tracker.current)tracker.current.deadzone=settings.deadzone;},[settings]);
  useEffect(()=>{
    if(cameraView.current){cameraView.current.srcObject=tracker.current?.video.srcObject??null;
      if(cameraView.current.srcObject)void cameraView.current.play().catch(()=>{});
    }
  },[panel,status]);

  useEffect(()=>{
    const held={left:false,right:false,fire:false,ads:false};
    const sync=()=>engine.current?.setKeyboard({turn:(Number(held.right)-Number(held.left))*.055,fire:held.fire,ads:held.ads});
    const keyDown=(e:KeyboardEvent)=>{
      if(e.code==='Escape'){if(panel){setPanel(null);return;}engine.current?.pause();return;}
      if((e.target as HTMLElement)?.matches('input,select,textarea'))return;
      if(e.repeat&&e.code==='KeyR')return;
      if(e.code==='KeyR'){engine.current?.reload();return;}
      if(e.code==='KeyA'||e.code==='ArrowLeft')held.left=true;
      if(e.code==='KeyD'||e.code==='ArrowRight')held.right=true;
      if(e.code==='Space')held.fire=true;
      if(e.code==='ShiftLeft'||e.code==='ShiftRight')held.ads=true;
      if(['ArrowRight','ArrowLeft','Space'].includes(e.code))e.preventDefault();
      sync();
    };
    const keyUp=(e:KeyboardEvent)=>{
      if(e.code==='KeyA'||e.code==='ArrowLeft')held.left=false;
      if(e.code==='KeyD'||e.code==='ArrowRight')held.right=false;
      if(e.code==='Space')held.fire=false;
      if(e.code==='ShiftLeft'||e.code==='ShiftRight')held.ads=false;
      sync();
    };
    const down=(e:MouseEvent)=>{
      if(e.target!==canvas.current||engine.current?.currentPhase!=='playing')return;
      if(e.button===0){held.fire=true;sync();}
      if(e.button===2){held.ads=true;sync();}
      if(document.pointerLockElement!==canvas.current)void Promise.resolve(canvas.current?.requestPointerLock?.()).catch(()=>{});
    };
    const up=(e:MouseEvent)=>{if(e.button===0)held.fire=false;if(e.button===2)held.ads=false;sync();};
    const move=(e:MouseEvent)=>{
      if(engine.current?.currentPhase!=='playing')return;
      if(document.pointerLockElement===canvas.current || (e.buttons&1)===1)engine.current?.nudgeMouse(e.movementX,e.movementY);
    };
    const blur=()=>{held.left=false;held.right=false;held.ads=false;held.fire=false;sync();};
    const context=(e:MouseEvent)=>{if(e.target===canvas.current)e.preventDefault();};
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);
    window.addEventListener('mousedown',down);window.addEventListener('mouseup',up);
    window.addEventListener('mousemove',move);window.addEventListener('blur',blur);
    window.addEventListener('contextmenu',context);
    return ()=>{window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);
      window.removeEventListener('mousedown',down);window.removeEventListener('mouseup',up);
      window.removeEventListener('mousemove',move);window.removeEventListener('blur',blur);
      window.removeEventListener('contextmenu',context);};
  },[panel]);

  const start=useCallback((isTraining=false)=>{
    if(!loaded)return;
    const name=normalizeName(playerName);
    if(!isTraining&&!validName(name)){
      setPanel(null);setNameError('Enter a player name (at least 2 characters) to start your campaign.');
      playerNameInput.current?.focus();
      return;
    }
    if(validName(name))saveName(name);
    runRef.current={name:isTraining?(validName(name)?name:'TRAINEE'):name,training:isTraining,logged:false};
    setNameError('');setScoreNotice('');setTraining(isTraining);setPanel(null);
    engine.current?.start(isTraining);
  },[loaded,playerName]);
  // GameEngine publishes an end-state snapshot once a mission is finished.
  // Guard by run identity to prevent duplicate localStorage writes on later frames.
  useEffect(()=>{
    if(snapshot.phase!=='victory'&&snapshot.phase!=='defeat')return;
    const run=runRef.current;
    if(!run||run.logged)return;
    run.logged=true;
    if(run.training){setScoreNotice('TRAINING COMPLETE · UNRANKED');return;}
    const result=addScore({player:run.name,score:snapshot.score,accuracy:snapshot.accuracy,
      shots:snapshot.shots,hits:snapshot.hits,sectors:snapshot.wave,totalSectors:snapshot.waves,
      result:snapshot.phase});
    setLeaderboard(result.entries);
    setScoreNotice(result.saved?`RUN RECORDED FOR ${run.name.toUpperCase()}`:'RUN RECORDED FOR THIS SESSION · BROWSER STORAGE UNAVAILABLE');
  },[snapshot.phase,snapshot.score,snapshot.accuracy,snapshot.shots,snapshot.hits,snapshot.wave,snapshot.waves]);
  const exportLeaderboard=()=>{
    if(!leaderboard.length)return;
    const blob=new Blob(['\uFEFF',scoresToCSV(leaderboard)],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='aether-strike-leaderboard.csv';document.body.appendChild(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const clearLeaderboard=()=>{clearScores();setLeaderboard([]);};
  const toMenu=()=>{engine.current?.reset(false);setPanel(null);setTraining(false);if(document.pointerLockElement)void document.exitPointerLock();};
  const toggleWebcam=async()=>{
    if(!tracker.current)return;
    if(status!=='OFFLINE'&&status!=='ERROR'&&status!=='VISION ERROR'){
      tracker.current.stop();setGesture(DEFAULT_FRAME);return;
    }
    setCamBusy(true);setError('');
    try{await tracker.current.start();}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setCamBusy(false);}
  };
  const saveSetting=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(prev=>({...prev,[key]:value}));
  const playing=snapshot.phase==='playing';
  const end=snapshot.phase==='victory'||snapshot.phase==='defeat';
  const paused=snapshot.phase==='paused';
  const menu=snapshot.phase==='menu';
  const modalPanel=panel!==null;
  const personalBest=topPlayers(leaderboard,150).find(row=>row.player.toLocaleLowerCase()===normalizeName(playerName).toLocaleLowerCase());

  return <div className={`aether-app ${playing?'in-game':''}`}>
    <canvas className="game-canvas" ref={canvas} aria-label="Aether Strike 3D game scene"/>
    <div className="vignette" aria-hidden="true"/>
    <div className="grain" aria-hidden="true"/>

    {playing && <>
      <div className="game-topbar">
        <div className="mission-stack"><div className="eyebrow"><span className="indicator green"/> LIVE OPERATION / {pad(snapshot.wave)}</div>
          <strong>{snapshot.mission}</strong><span className="mission-label">{snapshot.objective}</span></div>
        <div className="top-stats"><div><span>SECTOR</span><b>{pad(snapshot.wave)} / {pad(snapshot.waves)}</b></div>
          <div><span>THREATS</span><b className="danger-number">{pad(snapshot.targets)}</b></div>
          <div><span>SCORE</span><b>{snapshot.score.toLocaleString()}</b></div>
          <button className="icon-button" title="Pause game" onClick={()=>engine.current?.pause()}><Pause size={20}/></button></div>
      </div>
      {snapshot.ads&&!snapshot.moving&&<div className="scope-view" aria-hidden="true"><div className="scope-lens"/></div>}
      <div className={`crosshair ${snapshot.ads?'sighted':''} ${snapshot.targetLocked?'hostile-lock':''} ${snapshot.reloading?'inactive':''}`} aria-hidden="true"><i/><i/><i/><i/><span/></div>
      {snapshot.enemyMarkers.map(marker=><div key={marker.id} className="hostile-marker" style={{left:`${marker.x}%`,top:`${marker.y}%`}} aria-hidden="true"><div className="hostile-diamond"/><div className="hostile-label">{marker.kind.toUpperCase()} · {marker.distance}M</div><div className="hostile-health"><span style={{width:`${marker.health*100}%`}}/></div></div>)}
      {snapshot.message&&<div className="status-message"><span className="indicator green"/>{snapshot.message}</div>}
      {snapshot.suppressed&&<div className="suppression-text"><ShieldAlert size={17}/> INCOMING FIRE — SUPPRESSED</div>}
      <div className="combat-bottom">
        <div className="health-card"><span className="subcap"><Activity size={15}/> OPERATIVE STATUS</span>
          <div className="health-row"><strong>{Math.round(snapshot.health)}<small>%</small></strong><span>{snapshot.health>65?'COMBAT READY':snapshot.health>25?'WOUNDED':'CRITICAL'}</span></div>
          <div className="meter"><div className={snapshot.health<30?'critical':''} style={{width:`${snapshot.health}%`}}/></div>
          <div className="mini-details"><span>ACCURACY {snapshot.accuracy}%</span><span>{snapshot.fps} FPS</span></div>
        </div>
        <div className="ammo-card"><span className="subcap"><Crosshair size={15}/> PRIMARY / LMG</span>
          <div className="ammo-row"><strong>{pad(snapshot.ammo)}</strong><span>/ {snapshot.reserve}</span></div>
          <div className="ammo-bottom"><span>{snapshot.reloading?'RELOADING':snapshot.ads?'AIMING DOWN SIGHTS':'AUTOMATIC FIRE'}</span><span>{snapshot.reloading?`${Math.round(snapshot.progress*100)}%`:'FULL AUTO'}</span></div>
          {snapshot.reloading&&<div className="meter thin"><div style={{width:`${snapshot.progress*100}%`}}/></div>}</div>
      </div>
      <div className="tracker-hud"><span className={`indicator ${gesture.tracked?'green':'amber'}`}/>
        <span>{gesture.tracked?`RIGHT HAND · ${gesture.gesture.toUpperCase()}`:'CAMERA INPUT · '+status}</span>
        <button title="Open webcam calibration" onClick={()=>{engine.current?.pause();setPanel('calibration');}}><Settings2 size={16}/></button></div>
      {snapshot.moving&&<div className="advance-overlay"><span className="eyebrow">AUTONOMOUS TRANSIT</span><h2>ADVANCING TO COVER</h2><p>Weapon lowered. Stay alert.</p></div>}
      {training&&<div className="training-hint"><b>TRAINING</b><span>Move hand ↔ / ↕ to look · Fist to lock aim · Pinch to fire while scoped · Open hand to exit ADS · Double-pinch to reload</span></div>}
    </>}

    {(menu||paused||end||modalPanel)&&<div className="ui-layer">
      {menu&&!modalPanel&&<main className="main-menu">
        <header className="menu-nav"><div className="brandmark"><Crosshair size={19}/><span>AS / COMMAND SYSTEM</span></div>
          <div className="nav-right"><span className="indicator green"/> SYSTEM READY <span className="nav-divider">/</span> BUILD 1.5.9</div></header>
        <section className="hero"><div className="eyebrow hero-kicker"><span className="indicator red"/> TACTICAL FIRST-PERSON COMBAT // OPERATIONAL SIMULATION</div>
          <h1>AETHER<br/><em>STRIKE</em><span className="title-dot">.</span></h1>
          <div className="hero-line"/><p>SIX SECTORS. ONE DIRECTIVE.<br/>ELIMINATE EVERY THREAT.</p>
          <div className="player-identity">
            <label htmlFor="player-callsign"><UserRound size={16}/> PLAYER NAME</label>
            <div className="player-input-row"><input id="player-callsign" ref={playerNameInput} type="text" autoComplete="nickname" maxLength={20}
              value={playerName} placeholder="ENTER YOUR NAME" aria-invalid={!!nameError}
              onChange={e=>{setPlayerName(e.target.value);setNameError('');if(validName(e.target.value))saveName(e.target.value);}}
              onKeyDown={e=>{if(e.key==='Enter')start(false);}}/>
              <span>{personalBest?`PERSONAL BEST  ${personalBest.score.toLocaleString()}`:'READY FOR DEPLOYMENT'}</span></div>
            {nameError&&<div className="name-warning" role="alert">{nameError}</div>}
          </div>
          <div className="menu-actions"><button disabled={!loaded} className="primary-button" onClick={()=>start(false)}><Play size={18} fill="currentColor"/> START CAMPAIGN <ChevronRight size={18}/></button>
            <button disabled={!loaded} className="secondary-button" onClick={()=>start(true)}><Target size={18}/> TRAINING RANGE</button></div>
          <div className="menu-links"><button onClick={()=>setPanel('leaderboard')}><Trophy size={17}/> LEADERBOARD</button><button onClick={()=>setPanel('calibration')}><Camera size={17}/> WEBCAM CALIBRATION</button>
            <button onClick={()=>setPanel('settings')}><Settings2 size={17}/> SETTINGS</button>
            <button onClick={()=>setPanel('guide')}><CircleHelp size={17}/> CONTROLS</button>
            <button onClick={()=>setPanel('credits')}>CREDITS</button></div>
          <div className="load-status"><span className={`indicator ${loaded?'green':'amber'}`}/>{error||loadText}</div></section>
        <footer className="menu-footer"><span>DESKTOP / WEBGL / RIGHT-HAND TRACKING</span><span>BUILT WITH ORIGINAL SUPPLIED 3D ASSETS</span></footer>
      </main>}

      {paused&&!modalPanel&&<div className="modal centered end-screen"><span className="eyebrow">OPERATION INTERRUPTED</span><h2>PAUSED</h2><p>Combat systems standing by.</p>
        <button className="primary-button" onClick={()=>engine.current?.pause()}><Play size={18}/> RESUME OPERATION</button>
        <button className="secondary-button" onClick={()=>setPanel('settings')}><Settings2 size={18}/> SETTINGS</button>
        <button className="text-button" onClick={toMenu}><Menu size={16}/> RETURN TO MAIN MENU</button></div>}

      {end&&!modalPanel&&<div className="modal centered end-screen"><span className="eyebrow">AFTER ACTION REPORT</span>
        {snapshot.phase==='victory'?<ShieldCheck className="result-icon" size={46}/>:<ShieldAlert className="result-icon failure" size={46}/>}
        <h2>{snapshot.phase==='victory'?'MISSION COMPLETE':'MISSION FAILED'}</h2>
        <p>{snapshot.phase==='victory'?'All six sectors secured. Operation Blackout accomplished.':'The operative has fallen. Regroup and redeploy.'}</p>
        <div className="report-grid"><div><span>SCORE</span><b>{snapshot.score.toLocaleString()}</b></div><div><span>ACCURACY</span><b>{snapshot.accuracy}%</b></div><div><span>SECTORS</span><b>{snapshot.wave}/{snapshot.waves}</b></div></div>
        <div className="score-saved-line" aria-live="polite"><Trophy size={15}/> {scoreNotice||'FINISHING AFTER ACTION REPORT...'}</div>
        <button className="primary-button" onClick={()=>setPanel('leaderboard')}><Trophy size={18}/> VIEW LEADERBOARD</button>
        <button className="secondary-button" onClick={()=>start(false)}><RotateCcw size={18}/> REDEPLOY</button>
        <button className="text-button" onClick={toMenu}><Menu size={16}/> MAIN MENU</button></div>}

      {modalPanel&&<div className="settings-backdrop"><div className={`modal settings-panel ${panel==='leaderboard'?'leaderboard-panel':''}`}>
        <div className="modal-heading"><div><span className="eyebrow">AETHER COMMAND / CONFIGURATION</span><h2>{panel==='settings'?'SYSTEM SETTINGS':panel==='calibration'?'HAND CALIBRATION':panel==='credits'?'CREDITS':panel==='leaderboard'?'LEADERBOARD':'CONTROL GUIDE'}</h2></div>
          <button className="icon-button" aria-label="Close menu" onClick={()=>{setPanel(null);}}><X size={21}/></button></div>
        {panel==='leaderboard'&&<LeaderboardPanel entries={leaderboard} player={normalizeName(playerName)} onClear={clearLeaderboard} onExport={exportLeaderboard}/>}
        {panel==='settings'&&<div className="modal-body settings-body">
          <div className="section-heading"><Settings2 size={18}/> INPUT & CAMERA</div>
          <label className="setting"><span>Camera sensitivity <b>{settings.sensitivity.toFixed(1)}×</b></span><input type="range" min="0.3" max="3.5" step="0.1" value={settings.sensitivity} onChange={e=>saveSetting('sensitivity',Number(e.target.value))}/></label>
          <label className="setting"><span>Hand movement dead zone <b>{(settings.deadzone*1000).toFixed(1)} normalized</b></span><input type="range" min="0.001" max="0.015" step="0.0005" value={settings.deadzone} onChange={e=>saveSetting('deadzone',Number(e.target.value))}/></label>
          <label className="setting"><span>Weapon framing height <b>{settings.weaponOffset>=0?'+':''}{settings.weaponOffset.toFixed(2)}</b></span><input type="range" min="-0.22" max="0.26" step="0.01" value={settings.weaponOffset} onChange={e=>saveSetting('weaponOffset',Number(e.target.value))}/></label>
          <label className="setting"><span>Weapon / hands size <b>{Math.round(settings.weaponSize*100)}%</b></span><input type="range" min="0.85" max="1.25" step="0.01" value={settings.weaponSize} onChange={e=>saveSetting('weaponSize',Number(e.target.value))}/></label>
          <p className="footnote">The weapon is larger and closer by default. Adjust framing height or size if needed. ADS keeps the scope visible while you switch from a fist to a pinch; open your hand to exit ADS.</p>
          <button className="setting-toggle" onClick={()=>saveSetting('invert',!settings.invert)}><span>Invert horizontal gesture direction</span><span className={settings.invert?'toggle on':'toggle'} /></button>
          <div className="section-heading"><Activity size={18}/> VIDEO & AUDIO</div>
          <div className="quality-buttons" role="group" aria-label="Graphics quality">{(['low','medium','high'] as const).map(q=><button key={q} className={settings.quality===q?'selected':''} onClick={()=>saveSetting('quality',q)}>{q.toUpperCase()}</button>)}</div>
          <button className="setting-toggle" onClick={()=>saveSetting('audio',!settings.audio)}><span>{settings.audio?<Volume2 size={18}/>:<VolumeX size={18}/>} Audio effects</span><span className={settings.audio?'toggle on':'toggle'} /></button>
          <p className="footnote">Changes apply immediately. Graphics settings adjust render resolution; textures and materials from your models remain unchanged.</p>
        </div>}
        {panel==='calibration'&&<div className="modal-body">
          <div className="camera-preview"><video ref={cameraView} autoPlay playsInline muted/><canvas ref={cameraOverlay} className="landmark-overlay" width={640} height={480}/><div className="camera-guides"><span className="camera-corner top-left"/><span className="camera-corner top-right"/><span className="camera-corner bottom-left"/><span className="camera-corner bottom-right"/></div>
            {status==='OFFLINE'&&<div className="camera-placeholder"><Camera size={35}/><span>CAMERA OFFLINE</span></div>}
            <div className="camera-tag"><span className={`indicator ${gesture.tracked?'green':'amber'}`}/>{status}</div></div>
          <div className="tracking-detail"><div><span>DETECTED GESTURE</span><strong>{gesture.tracked?gesture.gesture.toUpperCase():'NO RIGHT HAND'}</strong></div>
            <div><span>PINCH GAP / PALM</span><strong>{gesture.tracked?(gesture.pinchRatio??0).toFixed(2):'—'}</strong></div>
            <div><span>FINGERS FOLDED</span><strong>{gesture.tracked?(gesture.curledFingers??0)+'/4':'—'}</strong></div>
            <div><span>LOOK LEFT / RIGHT</span><strong>{gesture.tracked?Math.round(gesture.turn*180/Math.PI)+'°/s':'—'}</strong></div>
            <div><span>LOOK UP / DOWN</span><strong>{gesture.tracked?Math.round(gesture.tilt*180/Math.PI)+'°/s':'—'}</strong></div></div>
          <p className="camera-instructions">Hold your <b>right hand</b> clearly within the frame. The green hand skeleton must follow your hand. Open your fingers, move left/right AND up/down to look, close all four fingers once to latch ADS, then pinch to fire without losing the scope. Open your hand deliberately to exit ADS. For reload, make two quick, separate pinches. Your camera is processed locally by MediaPipe; no video upload is implemented.</p>
          <div className="modal-actions"><button disabled={camBusy} className="primary-button" onClick={()=>void toggleWebcam()}>{status==='OFFLINE'||status==='ERROR'||status==='VISION ERROR'?<Camera size={17}/>:<WifiOff size={17}/>} {camBusy?'STARTING CAMERA':status==='VISION ERROR'?'RESTART TRACKING':status==='OFFLINE'||status==='ERROR'?'ENABLE WEBCAM':'DISABLE WEBCAM'}</button>
            <button className="secondary-button" onClick={()=>tracker.current?.calibrate()}><Check size={17}/> RESET TRACKING</button>
            <button className="secondary-button" onClick={()=>{const label=tracker.current?.toggleHandedness();if(label)setTrackingLabel(label);}}><Hand size={17}/> MEDIAPIPE LABEL: {trackingLabel.toUpperCase()} (TOGGLE IF NEEDED)</button></div>
          {error&&<p className="error-note">{error}</p>}
          <p className="footnote">Webcam requires HTTPS or localhost; plain HTTP public URLs cannot access it. Video is mirrored for intuitive controls, so the physical right hand typically appears as Left to the model. If MediaPipe loading fails, live preview stays open while you troubleshoot network access. Keyboard/mouse can always be used as fallback.</p>
        </div>}
        {panel==='guide'&&<div className="modal-body">
          <div className="section-heading"><Hand size={18}/> RIGHT HAND / WEBCAM</div>
          <div className="guide-grid"><div><b>01</b><strong>MOVE LEFT / RIGHT / UP / DOWN</strong><span>Rotate view horizontally and vertically</span></div><div><b>02</b><strong>MAKE A FIST</strong><span>Lock scope until you open your hand</span></div><div><b>03</b><strong>HOLD A PINCH</strong><span>Fire while staying scoped</span></div><div><b>04</b><strong>DOUBLE PINCH</strong><span>Reload the magazine</span></div></div>
          <div className="section-heading"><Keyboard size={18}/> DESKTOP FALLBACK</div>
          <div className="keymap"><span>A / D or ← / →</span><strong>ROTATE</strong><span>MOUSE MOVE X / Y</span><strong>LOOK / AIM</strong><span>LEFT MOUSE / SPACE</span><strong>FIRE</strong><span>RIGHT MOUSE / SHIFT</span><strong>ADS</strong><span>R</span><strong>RELOAD</strong><span>ESC</span><strong>PAUSE</strong></div>
          <p className="footnote">Movement between cover positions is automatic. Fire once to alert enemy squads, then eliminate all threats to advance. Initial pinch is briefly delayed to distinguish a double-pinch reload.</p>
        </div>}
        {panel==='credits'&&<div className="modal-body credits"><Crosshair size={40}/><p>AETHER STRIKE is a browser-based tactical first-person prototype using the three original GLB files provided for this project.</p>
          <div><strong>RENDERING</strong> Three.js / WebGL</div><div><strong>FRAMEWORK</strong> React / TypeScript / Vite</div><div><strong>VISION</strong> MediaPipe Hand Landmarker</div><div><strong>ASSETS</strong> User-supplied environment, enemy soldier, first-person arms and weapon</div>
          <p className="footnote">Procedural visual effects and synthesized sound are used where no animation or audio was supplied.</p></div>}
        <button className="back-link" onClick={()=>{setPanel(null);}}><ArrowLeft size={17}/> BACK</button>
      </div></div>}
    </div>}
    {!playing&&!menu&&!paused&&!end&&!modalPanel&&<button className="floating-back" onClick={toMenu}><ArrowLeft size={17}/> MENU</button>}
    <div className="corner-cue" aria-hidden="true"><Wifi size={15}/><span>AS-NET / LOCAL</span><AudioLines size={17}/></div>
  </div>;
}
