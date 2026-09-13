(() => {
'use strict';
const defaults={primary:'0',armor:'standard',magazine:'standard',camo:'woodland'};
const choices={primary:Object.fromEntries(window.TriadWeapons.map(w=>[String(w.id),`${w.name} · ${w.type}`])),armor:{standard:'표준 / 균형',light:'경량 / HP −15 · 속도 +12%',heavy:'중장갑 / HP +20 · 속도 −12%'},magazine:{standard:'표준 탄창',extended:'확장 / 장탄 +30% · 재장전 +25%',quick:'퀵 체인지 / 장탄 −20% · 재장전 −25%'},camo:{woodland:'우드랜드',urban:'어반 그레이',desert:'데저트 샌드'}};
const clean=value=>Object.fromEntries(Object.keys(defaults).map(k=>[k,Object.hasOwn(choices[k],value?.[k])?value[k]:defaults[k]]));
let saved={};try{saved=JSON.parse(localStorage.getItem('triad-career-v1'))||{};}catch{}
let xp=Number.isSafeInteger(saved.xp)&&saved.xp>=0?Math.min(saved.xp,100000000):0;
const kits=[0,1,2].map(i=>clean({...saved.kits?.[i],primary:String(saved.kits?.[i]?.primary??i)}));
const ranks=['훈련병','이병','일병','상병','병장','하사','중사','상사','소위'];
const thresholds=[0,200,500,1000,1800,3000,4800,7200,10000];
const persist=()=>{try{localStorage.setItem('triad-career-v1',JSON.stringify({xp,kits}));}catch{}};
function rank(){let i=thresholds.findLastIndex(n=>xp>=n);return {name:ranks[i],xp,next:thresholds[i+1]||null,base:thresholds[i]};}
function stats(base,kit){const k=clean(kit);return {...base,primary:Number(k.primary),hp:base.hp+(k.armor==='heavy'?20:k.armor==='light'?-15:0),speed:base.speed*(k.armor==='heavy'?.88:k.armor==='light'?1.12:1),mag:Math.round(base.mag*(k.magazine==='extended'?1.3:k.magazine==='quick'?.8:1)),reload:base.reload*(k.magazine==='extended'?1.25:k.magazine==='quick'?.75:1),camo:k.camo};}
function drawRank(){const el=document.getElementById('career-rank');if(!el)return;const r=rank();el.textContent=`◆ ${r.name} · ${xp.toLocaleString()} XP${r.next?' / 다음 계급 '+r.next.toLocaleString()+' XP':' · 최고 계급'}`;}
function reward(kills,win){const earned=60+Math.max(0,Math.min(5,kills))*30+(win?100:0);xp=Math.min(100000000,xp+earned);persist();drawRank();return earned;}
window.TriadCareer={clean,stats,rank,reward,kit:i=>({...kits[i]}),mount(base,onChange){
const $=id=>document.getElementById(id);let selected=0;
function draw(){drawRank();$('armory-name').textContent=base[selected].name+' / '+base[selected].role;for(const k of Object.keys(choices))$('kit-'+k).value=kits[selected][k];const s=stats(base[selected],kits[selected]),w=window.TriadWeapons[s.primary];$('kit-stats').textContent=`${w.name} · 피해 ${w.damage} · ${w.mag}발 | HP ${s.hp} · 이동 ${s.speed.toFixed(2)}`;}
for(const k of Object.keys(choices)){const el=$('kit-'+k);el.innerHTML=Object.entries(choices[k]).map(([v,label])=>`<option value="${v}">${label}</option>`).join('');el.onchange=()=>{kits[selected]=clean({...kits[selected],[k]:el.value});persist();onChange();draw();};}
const maps=$('map-cards');maps.innerHTML=Object.entries(window.TriadMaps).map(([id,m])=>`<button type="button" class="map-card" data-map="${id}" aria-pressed="${id==='yard'}"><svg viewBox="0 0 100 100" aria-hidden="true">${m.grid.flatMap((row,y)=>[...row].map((v,x)=>v==='0'?'':`<rect x="${x*5}" y="${y*5}" width="4" height="4" fill="${v==='1'?'#7c8f94':'#c5c98d'}"/>`)).join('')}</svg><strong>${m.name}</strong><small>${m.description}</small></button>`).join('');
for(const b of maps.querySelectorAll('button'))b.onclick=()=>{if($('map-choice').disabled)return;window.TriadGame.setMap(b.dataset.map);};
draw();return {select(i){selected=i;draw();}};
}};
})();

