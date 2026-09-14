const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const elements = new Map();
  const ctx = new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
  function element() {
    const listeners = {}, classes = new Set();
    return {
      listeners, style:{}, hidden:false, value:'standard', textContent:'', children:[],
      classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle(k,on){on?classes.add(k):classes.delete(k)}},
      set innerHTML(value){this.html=value;this.children=[]},get innerHTML(){return this.html||''},
      querySelector:()=>({textContent:""}),getContext:()=>ctx,addEventListener(type,fn){(listeners[type]||=[]).push(fn)},
      setAttribute(){},setPointerCapture(){},requestPointerLock(){},
      getBoundingClientRect:()=>({left:0,top:0,width:124,height:124}),
      prepend(el){this.children.unshift(el)},get lastChild(){return{remove:()=>this.children.pop()}},
      dispatch(type,extra={}){for(const fn of listeners[type]||[])fn({pointerId:1,clientX:62,clientY:62,preventDefault(){},...extra})}
    };
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},
    querySelector:()=>({textContent:""}),createElement:element,querySelectorAll:()=>[],addEventListener(){},exitPointerLock(){},body:element()};
  const context={performance:{now:()=>1000},document,window:{},matchMedia:()=>({matches:true}),innerWidth:390,innerHeight:844,addEventListener(){},requestAnimationFrame(){},console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../touch.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../maps.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../weapons.js'),'utf8'),context);
  const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
  const exposed=source.replace(/\}\)\(\);\s*$/,`globalThis.game={onlineUpdate,start,update,move,reload,shoot,damage,respawn,pause,menu,render,finish,solid,resize,get units(){return units},get player(){return player},get state(){return state}};})();`);
  assert.notEqual(exposed,source,'test adapter must match closure');
  vm.runInContext(exposed,context);
  return {g:context.game,input:context.window.TriadInput,$:id=>document.getElementById(id),context};
}

test('all three operators spawn in walkable, separate positions',()=>{
  const {g}=setup();g.start();assert.equal(g.units.length,3);
  assert.equal(new Set(g.units.map(u=>`${u.x},${u.y}`)).size,3);
  for(const u of g.units)assert.equal(g.solid(u.x,u.y),false);
});
test('collision, reload and aimed shot respect arena walls',()=>{
  const {g}=setup();g.start();const p=g.player,e=g.units[1];
  p.x=p.y=1.25;g.move(p,-.2,0);assert.equal(p.x,1.25);
  p.safe=100;p.ammo=1;g.reload(p);for(let i=0;i<45;i++)g.update(.04);assert.equal(p.ammo,30);
  p.x=2.5;p.y=3.5;p.a=0;p.cool=0;p.reload=0;p.hp=110;
  e.x=8.5;e.y=3.5;e.hp=95;e.safe=0;g.units[2].x=17.5;g.units[2].y=17.5;
  g.shoot(p);assert.equal(e.hp,95,'wall prevents hit');
  p.y=e.y=2.5;e.x=4.5;p.cool=0;g.shoot(p);assert.equal(e.hp,71,'clear aimed shot uses M4A1 damage');
  assert.equal(p.ammo,28);
});
test('death scores once; respawn restores health and gives temporary protection',()=>{
  const {g}=setup();g.start();const p=g.player,e=g.units[1];e.safe=0;
  g.damage(e,p,999);g.damage(e,p,999);assert.equal(p.score,1);assert.equal(e.deaths,1);
  g.respawn(e);assert.equal(e.hp,95);g.damage(e,p,999);assert.equal(e.hp,95);
});
test('multitouch supports move, aim and fire together and clears canceled pointers',()=>{
  const {input,$}=setup();input.setActive(true);
  $('joystick').dispatch('pointerdown',{pointerId:10,clientX:102,clientY:62});
  $('look-zone').dispatch('pointerdown',{pointerId:11,clientX:220});
  $('look-zone').dispatch('pointermove',{pointerId:11,clientX:260});
  $('touch-fire').dispatch('pointerdown',{pointerId:12});
  assert.equal(input.x,1);assert(input.look>0);assert.equal(input.fire,true);
  $('touch-fire').dispatch('pointercancel',{pointerId:12});assert.equal(input.fire,false);assert.equal(input.x,1);
  $('joystick').dispatch('lostpointercapture',{pointerId:10});assert.equal(input.x,0);
  input.setActive(false);assert.equal(input.look,0);assert.equal($('touch-controls').hidden,true);
});
test('touch moves player, shoots, auto-reloads; pause clears held actions',()=>{
  const {g,input,$}=setup();g.start();const p=g.player;
  p.x=p.y=2.5;p.a=0;p.cool=0;p.safe=100;input.y=1;
  const oldX=p.x;g.update(.04);assert(p.x>oldX);
  p.ammo=1;input.fire=true;g.update(.04);assert.equal(p.ammo,0);assert(p.reload>0);
  g.pause();assert.equal(g.state,'paused');assert.equal(input.fire,false);assert.equal(input.y,0);
  assert.equal($('touch-controls').hidden,true);
});
test('a quick fire tap survives pointerup before the next animation frame',()=>{
  const {g,input,$}=setup();g.start();g.player.cool=0;
  $('touch-fire').dispatch('pointerdown');$('touch-fire').dispatch('pointerup');
  assert.equal(input.fire,false);assert.equal(input.fireTap,true);
  g.update(.016);assert.equal(g.player.ammo,29);assert.equal(input.fireTap,false);
});
test('portrait/landscape keep render aspect ratio and complete matches',()=>{
  const {g,$,context}=setup();g.start();g.render();
  assert.equal($('game').width,390);assert.equal($('game').height,844);
  context.innerWidth=844;context.innerHeight=390;g.resize();g.render();
  assert.equal($('game').width,844);assert.equal($('game').height,390);
  for(let i=0;i<4600&&g.state==='playing';i++)g.update(.04);
  assert.equal(g.state,'finished');assert.equal($('result').hidden,false);g.render();
});
test('selected match limit ends match and exact ties produce a draw',()=>{
  const {g,$}=setup();$('match-limit').value='15';g.start();g.player.score=14;const e=g.units[1];e.safe=0;g.damage(e,g.player,999);
  assert.equal(g.state,'finished');assert.match($('winner').textContent,/승리/);
  g.start();g.finish();assert.equal($('winner').textContent,'무승부');
});
test('vertical aim rejects shots above the enemy and awards headshot damage',()=>{
  const {g}=setup();g.start();const p=g.player,e=g.units[1];
  p.x=p.y=2.5;p.a=0;p.cool=0;p.pitch=.4;e.x=4.5;e.y=2.5;e.safe=0;
  g.units[2].x=g.units[2].y=17.5;g.shoot(p);assert.equal(e.hp,95);
  p.cool=0;p.pitch=Math.atan((1.8-1.6)/6);g.shoot(p);assert.equal(e.hp,51.8);
  assert(p.pitch>Math.atan((1.8-1.6)/6),'shot adds recoil');
});
test('touch vertical look and ADS toggle reset on pause',()=>{
  const {g,input,$}=setup();g.start();
  $('look-zone').dispatch('pointerdown',{clientY:100});
  $('look-zone').dispatch('pointermove',{clientY:80});assert(input.lookY>0);
  $('touch-aim').dispatch('pointerdown',{pointerId:2});assert.equal(input.aim,true);
  g.update(.016);assert(g.player.pitch>0);g.pause();assert.equal(input.aim,false);assert.equal(input.lookY,0);
});

test('all arena maps connect every spawn and support an entire practice match',()=>{
 const {g,context}=setup();
 assert.equal(Object.keys(context.window.TriadMaps).length,6);
 for(const id of Object.keys(context.window.TriadMaps)){
  context.window.TriadGame.setMap(id);g.start();
  const grid=context.window.TriadMaps[id].grid,queue=[[2,2]],visited=new Set(['2,2']);
  while(queue.length){const [x,y]=queue.shift();for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;if(grid[ny]?.[nx]==='0'&&!visited.has(key)){visited.add(key);queue.push([nx,ny]);}}}
  for(const u of g.units)assert(visited.has(`${Math.floor(u.x)},${Math.floor(u.y)}`));
  for(let i=0;i<5000&&g.state==='playing';i++)g.update(.04);
  assert.equal(g.state,'finished');g.menu();
 }
});
test('host accepts bounded movement and authoritative remote fire, with no absent bots',()=>{
 const {g,context}=setup(),api=context.window.TriadGame;api.beginOnline([{id:'host',slot:0},{id:'guest',slot:1}],0,true);
 const p=g.units[0],r=g.units[1];Object.assign(p,{x:4.5,y:2.5,safe:0,hp:110});Object.assign(r,{x:2.5,y:2.5,a:0,pitch:0,cool:0,safe:0});
 api.remoteInput(1,{a:0,pitch:0,f:0,s:0,fire:true});g.onlineUpdate(.04);
 assert.equal(p.hp,79,'remote AK-47 shot uses the same full damage as local shot');assert.equal(r.ammo,29);assert.equal(g.units[2].hp,0);
 api.remoteInput(1,{a:0,pitch:0,f:9999,s:0});const before=r.x;g.onlineUpdate(.04);assert(r.x-before<.15,'remote speed is clamped');
 api.remoteInput(1,{a:NaN,pitch:0,f:1,s:0});assert(Number.isFinite(r.x));
 api.setMembers([{id:'host',slot:0}]);g.onlineUpdate(.04);assert.equal(r.hp,0);
});
test('guest shots only queue commands; host snapshot determines damage and ammunition',()=>{
 const {g,context}=setup(),api=context.window.TriadGame;api.beginOnline([{id:'host',slot:0},{id:'guest',slot:1}],1,false);
 g.player.cool=0;const original=g.player.ammo;g.shoot(g.player);assert.equal(g.player.ammo,original);assert.equal(api.readInput().fire,true);
 const snap=api.snapshot();snap.units[1].ammo=39;snap.units[1].hp=50;snap.units[1].shots=1;api.applySnapshot(snap);assert.equal(g.player.hp,50);assert.equal(g.player.ammo,39);
 snap.units[1].x=Infinity;api.applySnapshot(snap);assert(Number.isFinite(g.player.x));
});
test('online host keeps simulation running while pause menu is open',()=>{
 const {g,context}=setup(),api=context.window.TriadGame;api.beginOnline([{id:'host',slot:0},{id:'guest',slot:1}],0,true);g.pause();const before=api.snapshot().elapsed;g.onlineUpdate(.04);assert(api.snapshot().elapsed>before);assert.equal(g.state,'paused');
});

test('death waits five seconds and selected gun replaces the next-life loadout',()=>{const {g,$}=setup();g.start();const p=g.player;const enemy=g.units.find(u=>u!==p);p.safe=0;g.damage(p,enemy,999);assert.equal(p.dead,5);$('respawn-gun').onchange({target:{value:'5'}});g.update(.04);assert.equal(p.hp,0);assert.ok(p.dead>4.9);for(let i=0;i<130;i++)g.update(.04);assert.ok(p.hp>0);assert.equal(p.gunId,5);assert.equal(p.ammo,5);assert.equal(p.grenades,3);});
test('knife is range limited and grenades consume finite stock',()=>{const {g}=setup();g.start();const p=g.player,e=g.units.find(u=>u!==p);p.x=2.5;p.y=2.5;p.a=0;p.safe=0;p.cool=0;e.x=3;e.y=2.5;e.safe=0;e.hp=100;p.slot=2;g.shoot(p);assert.equal(e.hp,45);p.cool=0;p.slot=1;g.shoot(p);assert.equal(p.grenades,2);assert.equal(e.hp,45);});

