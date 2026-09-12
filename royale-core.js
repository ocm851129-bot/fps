/* Shared, DOM-free simulation. Coordinates are metres in a 1000 × 1000 arena. */
(function(root){
'use strict';
const weapons={pistol:{name:'P9',damage:22,rate:.36,mag:12,reload:1.4,range:180},smg:{name:'VECTOR',damage:14,rate:.11,mag:30,reload:1.8,range:145},rifle:{name:'AR-30',damage:27,rate:.22,mag:30,reload:2.1,range:260}};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
class Royale{
 constructor(random=Math.random){this.random=random;this.time=0;this.phase='drop';this.over=false;this.winner=null;this.rank=null;this.bullets=[];this.kills=0;this.obstacles=[];this.items=[];this.players=[];this.zone={x:500,y:500,r:710};
  for(let y=150;y<900;y+=190)for(let x=140;x<900;x+=210)this.obstacles.push({x,y,w:45+random()*35,h:35+random()*40});
  const point=()=>{let p;do{p={x:20+random()*960,y:20+random()*960};}while(this.blocked(p.x,p.y,10));return p;};
  for(let i=0;i<100;i++)this.players.push({id:i,...point(),hp:100,armor:0,weapon:null,ammo:0,reserve:0,meds:0,angle:random()*Math.PI*2,cool:0,reloading:0,think:0,dx:0,dy:0});
  for(let i=0;i<340;i++)this.items.push({...point(),kind:i<180?['pistol','smg','rifle'][i%3]:i<260?'ammo':i<305?'med':'armor'});
  this.items.push({x:this.players[0].x+12,y:this.players[0].y,kind:'pistol'});
 }
 blocked(x,y,r=6){return x<r||y<r||x>1000-r||y>1000-r||this.obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
 move(p,dx,dy){if(!this.blocked(p.x+dx,p.y))p.x+=dx;if(!this.blocked(p.x,p.y+dy))p.y+=dy;}
 reload(p){if(p.weapon&&!p.reloading&&p.reserve&&p.ammo<weapons[p.weapon].mag)p.reloading=weapons[p.weapon].reload;}
 heal(p){if(p.meds&&p.hp>0&&p.hp<100){p.meds--;p.hp=Math.min(100,p.hp+40);}}
 pickup(p){for(let i=this.items.length-1;i>=0;i--){const item=this.items[i];if(Math.hypot(p.x-item.x,p.y-item.y)>18)continue;
   if(weapons[item.kind]){if(p.weapon&&weapons[p.weapon].range>=weapons[item.kind].range)continue;p.weapon=item.kind;p.ammo=weapons[item.kind].mag;p.reserve+=60;p.reloading=0;}
   else if(item.kind==='ammo'){if(p.reserve>=180)continue;p.reserve=Math.min(180,p.reserve+30);}
   else if(item.kind==='med'){if(p.meds>=3)continue;p.meds++;}else{if(p.armor>=50)continue;p.armor=50;}
   this.items.splice(i,1);
  }}
 fire(p){if(!p.weapon||p.hp<=0||p.cool>0||p.reloading)return;if(!p.ammo){this.reload(p);return;}const w=weapons[p.weapon];p.ammo--;p.cool=w.rate;this.bullets.push({x:p.x,y:p.y,a:p.angle,owner:p.id,damage:w.damage,left:w.range});}
 hit(p,amount,owner){const absorbed=Math.min(p.armor,amount*.4);p.armor-=absorbed;p.hp=Math.max(0,p.hp-(amount-absorbed));if(p.hp===0){if(owner===0)this.kills++;if(p.id===0)this.rank=this.players.filter(q=>q.hp>0).length+1;this.items.push({x:p.x,y:p.y,kind:'ammo'});}}
 step(dt,input={}){if(this.over)return;dt=clamp(dt,0,.05);this.time+=dt;if(this.time<5)return;this.phase='survival';
  // 30 seconds to loot; shrink continuously over 240 seconds, then close completely.
  this.zone.r=Math.max(0,710*(1-clamp((this.time-35)/240,0,1)));const outsideDamage=2+Math.floor(Math.max(0,this.time-35)/40)*2;
  for(const p of this.players){if(p.hp<=0)continue;p.cool=Math.max(0,p.cool-dt);if(p.reloading){p.reloading=Math.max(0,p.reloading-dt);if(!p.reloading){const n=Math.min(weapons[p.weapon].mag-p.ammo,p.reserve);p.ammo+=n;p.reserve-=n;}}
   let dx=0,dy=0,shoot=false;
   if(p.id===0){dx=input.x||0;dy=input.y||0;if(Number.isFinite(input.angle))p.angle=input.angle;shoot=input.fire;if(input.reload)this.reload(p);if(input.heal)this.heal(p);}
   else{p.think-=dt;if(p.think<=0){p.think=.25+this.random()*.3;let target=null,dist=170;for(const q of this.players){if(q===p||q.hp<=0)continue;const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<dist){dist=d;target=q;}}p.target=target;
     let goal;if(Math.hypot(p.x-500,p.y-500)>Math.max(0,this.zone.r-35))goal={x:500,y:500};else if(!p.weapon)goal=this.items.filter(i=>weapons[i.kind]).reduce((a,b)=>!a||Math.hypot(b.x-p.x,b.y-p.y)<Math.hypot(a.x-p.x,a.y-p.y)?b:a,null);else if(target)goal=target;
     const a=goal?Math.atan2(goal.y-p.y,goal.x-p.x):this.random()*Math.PI*2;p.dx=Math.cos(a);p.dy=Math.sin(a);
    }dx=p.dx;dy=p.dy;if(p.target?.hp>0&&p.weapon){p.angle=Math.atan2(p.target.y-p.y,p.target.x-p.x)+(this.random()-.5)*.24;shoot=true;}if(p.hp<55)this.heal(p);}
   const len=Math.max(1,Math.hypot(dx,dy));const oldX=p.x,oldY=p.y;this.move(p,dx/len*dt*48,dy/len*dt*48);if(p.id&&p.x===oldX&&p.y===oldY){p.dx=-dy;p.dy=dx;p.think=.7;}
   this.pickup(p);if(shoot)this.fire(p);if(p.weapon&&!p.ammo)this.reload(p);if(Math.hypot(p.x-500,p.y-500)>this.zone.r)this.hit(p,outsideDamage*dt,-1);
  }
  // Substeps prevent fast bullets from tunnelling through characters and walls.
  for(let i=this.bullets.length-1;i>=0;i--){const b=this.bullets[i];let remove=false;const n=Math.ceil(360*dt/3);for(let k=0;k<n;k++){const d=360*dt/n;b.x+=Math.cos(b.a)*d;b.y+=Math.sin(b.a)*d;b.left-=d;if(b.left<=0||this.blocked(b.x,b.y,1)){remove=true;break;}const p=this.players.find(p=>p.id!==b.owner&&p.hp>0&&Math.hypot(p.x-b.x,p.y-b.y)<7);if(p){this.hit(p,b.damage,b.owner);remove=true;break;}}if(remove)this.bullets.splice(i,1);}
  const alive=this.players.filter(p=>p.hp>0);if(alive.length<=1){this.over=true;this.winner=alive[0]?.id??null;if(this.winner===0)this.rank=1;}
 }
}
root.RoyaleCore={Royale,weapons};if(typeof module!=='undefined')module.exports=root.RoyaleCore;
})(typeof window!=='undefined'?window:globalThis);
