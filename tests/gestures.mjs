import assert from 'node:assert/strict';
import {GestureDetector} from '../src/tracking/GestureDetector.ts';

const make=(gesture='open',offset=0)=>{
  const p=Array.from({length:21},()=>({x:.5+offset,y:.64,z:0}));
  p[0]={x:.5+offset,y:.9,z:0};p[9]={x:.5+offset,y:.6,z:0};
  for (const [mcp,pip,tip,x] of [[5,6,8,.44],[9,10,12,.5],[13,14,16,.55],[17,18,20,.6]]){
    p[mcp]={x:x+offset,y:.65,z:0};p[pip]={x:x+offset,y:gesture==='fist'?.7:.46,z:0};
    p[tip]={x:x+offset,y:gesture==='fist'?.81:.25,z:0};
  }
  p[4]={x:(gesture==='pinch'?.45:.21)+offset,y:gesture==='pinch'?.25:.50,z:0};
  return p;
};
const classify=(g,gesture,times,offset=0)=>{let frame;for(const t of times)frame=g.evaluate(make(gesture,offset),t);return frame;};
let g=new GestureDetector();
let a=classify(g,'fist',[100,133,166]);
assert.equal(a.ads,true,'fist must activate ADS after stable frames');
assert.equal(a.fire,false,'fist must never shoot');
assert.equal(a.reload,false,'fist must never reload');

// Pinch needs 2 good frames + 100ms hold: fewer false positives than instant fire.
g.reset();a=classify(g,'pinch',[100,133,166,199,232,265]);
assert.equal(a.fire,true,'held pinch should fire');
assert.equal(a.ads,false,'pinch must not trigger ADS');
assert.equal(g.lost(269).fire,false,'lost hand must immediately cease fire');
assert.equal(g.evaluate(make('pinch'),295).fire,false,'reacquisition must not resume stale firing');

// Deliberate double-tap pinches start a reload without firing.
g.reset();classify(g,'pinch',[100,133]);classify(g,'open',[175,208]);
a=classify(g,'pinch',[280,313]);
assert.equal(a.reload,true,'two quick distinct pinches should reload');
assert.equal(a.fire,false,'second reload pinch must not fire');
assert.equal(classify(g,'pinch',[346,410,510]).fire,false,'holding second pinch must not fire after reload');

// A genuine sustained pinch should not be treated as a first reload tap.
g.reset();classify(g,'pinch',[100,133,250,410]);classify(g,'open',[460,493]);
a=classify(g,'pinch',[560,593,760]);
assert.equal(a.fire,true,'a sustained first pinch must not arm a reload');
assert.equal(a.reload,false);

// Rightward displacement should rotate right; stable hand should settle near zero.
g.reset();g.evaluate(make('open',0),100);a=g.evaluate(make('open',.08),133);
assert.ok(a.turn>1,'a moderate right-hand motion should produce responsive rotation');
a=classify(g,'open',[166,199,232,265,298,331],.08);
assert.ok(Math.abs(a.turn)<.2,'stationary hand should not drift');
g.lost(400);a=g.evaluate(make('open',.18),430);
assert.equal(a.turn,0,'reacquisition should not cause a camera jump');

// Fist, pinch, and open gestures must be distinct.
g.reset();classify(g,'fist',[100,133,166]);a=classify(g,'pinch',[199,232,265,298,365]);
assert.equal(a.ads,true,'fist-latched ADS must persist while pinching and firing');
assert.equal(a.fire,true,'pinch should fire without breaking a previously latched ADS');
a=classify(g,'open',[398,431]);
assert.equal(a.ads,true,'brief open transition must not immediately end ADS');
a=classify(g,'open',[464,497,530]);
assert.equal(a.ads,false,'deliberate open hand must release the ADS latch');
assert.equal(a.fire,false,'open hand must stop firing');
// Lost tracking must release ADS as well as fire, not leave the scope stuck.
g.reset();classify(g,'fist',[100,133,166]);
assert.equal(g.lost(180).ads,false,'hand loss cancels ADS latch');
// Vertical steering: raise hand in camera frame => aim upwards; lower => down.
const movedVertical=(distance)=>make('open').map(p=>({...p,y:p.y+distance}));
g.reset();g.evaluate(movedVertical(0),100);a=g.evaluate(movedVertical(-.075),133);
assert.ok(a.tilt>1,'moving hand up should give positive vertical pitch velocity');
a=g.evaluate(movedVertical(.01),166);
assert.ok(a.tilt<0,'moving hand down should give negative pitch velocity');
a=g.lost(199);
assert.equal(a.tilt,0,'lost hand must immediately cancel vertical steering');
g.reset();g.evaluate(make('open'),100);a=g.evaluate(make('open',.08),133);
assert.ok(Math.abs(a.tilt)<.001,'horizontal movement alone must not move aim vertically');
console.log('PASS: fist-latched ADS during pinch, release on open, pinch fire, double pinch reload, lost hand safety, two-axis steering and no drift');
