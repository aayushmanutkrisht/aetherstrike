/** Replaceable procedural cues, generated in Web Audio with no extra asset models. */
export class AudioManager {
  private ctx?:AudioContext;enabled=true;
  private ambience?:OscillatorNode;private wind?:AudioBufferSourceNode;private ambienceGain?:GainNode;
  unlock(){
    if(!this.ctx){
      const ctx=this.ctx=new AudioContext();
      const mix=this.ambienceGain=ctx.createGain();mix.gain.value=this.enabled?.4:0;
      mix.connect(ctx.destination);
      this.ambience=ctx.createOscillator();this.ambience.type='sine';this.ambience.frequency.value=52;
      const deep=ctx.createGain();deep.gain.value=.007;this.ambience.connect(deep);deep.connect(mix);this.ambience.start();
      const frames=ctx.sampleRate*2,buffer=ctx.createBuffer(1,frames,ctx.sampleRate),channel=buffer.getChannelData(0);
      for(let i=0;i<frames;i++)channel[i]=Math.random()*2-1;
      const wind=this.wind=ctx.createBufferSource();wind.buffer=buffer;wind.loop=true;
      const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=230;
      const wg=ctx.createGain();wg.gain.value=.009;wind.connect(filter);filter.connect(wg);wg.connect(mix);wind.start();
    }
    void this.ctx.resume();
  }
  setEnabled(enabled:boolean){this.enabled=enabled;if(this.ambienceGain)this.ambienceGain.gain.value=enabled?.4:0;}
  private tone(freq:number,duration:number,kind:OscillatorType='sawtooth',vol=.05,endFreq?:number){
    if(!this.ctx||!this.enabled)return;
    const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime;
    o.type=kind;o.frequency.setValueAtTime(freq,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq??freq*.7),t+duration);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+duration+.01);
  }
  private noise(duration:number,vol:number,lowpass=1500){
    if(!this.ctx||!this.enabled)return;
    const ctx=this.ctx,frames=Math.round(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,frames,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<frames;i++)data[i]=(Math.random()*2-1)*(1-i/frames);
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    filter.type='lowpass';filter.frequency.value=lowpass;gain.gain.value=vol;
    src.buffer=buffer;src.connect(filter);filter.connect(gain);gain.connect(ctx.destination);src.start();
  }
  gun(){this.noise(.16,.2,1700);this.tone(86,.14,'sawtooth',.08,42);}
  enemyGun(){this.noise(.11,.07,950);this.tone(120,.09,'square',.022,65);}
  reload(){this.tone(370,.09,'triangle',.035,250);this.noise(.035,.025,1800);}
  hit(){this.noise(.08,.045,1400);}
  impact(){this.noise(.06,.04,2100);}
  explosion(){this.noise(.9,.26,290);this.tone(58,.75,'sawtooth',.1,20);}
  alert(){this.tone(290,.3,'triangle',.045,650);}
  footsteps(){this.noise(.055,.02,350);}
  victory(){[392,523,659,784].forEach((x,i)=>setTimeout(()=>this.tone(x,.32,'sine',.055),i*140));}
  defeat(){this.tone(190,.75,'triangle',.08,70);}
  dispose(){try{this.ambience?.stop();this.wind?.stop();}catch{/* already stopped */}void this.ctx?.close();this.ctx=undefined;}
}
