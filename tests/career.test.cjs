const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');
function setup(raw){const storage={value:raw};const c={window:{},document:{getElementById:()=>null},localStorage:{getItem:()=>storage.value,setItem:(_,v)=>storage.value=v}};vm.createContext(c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../weapons.js'),'utf8'),c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../career.js'),'utf8'),c);return {career:c.window.TriadCareer,storage};}
test('invalid stored profile falls back safely; progression survives reload',()=>{const {career,storage}=setup('{bad');assert.equal(career.rank().xp,0);assert.equal(career.reward(5,true),310);assert.equal(career.rank().name,'이병');assert.equal(setup(storage.value).career.rank().xp,310);});
test('equipment uses catalog IDs rather than peer-supplied combat stats',()=>{const {career}=setup();const base={hp:100,speed:3,mag:30,reload:2};const heavy=career.stats(base,{armor:'heavy',magazine:'extended',hp:9999});assert.equal(heavy.hp,120);assert.equal(heavy.mag,39);assert.equal(heavy.reload,2.5);assert.ok(heavy.speed<base.speed);assert.equal(career.stats(base,{armor:'__proto__'}).hp,100);assert.equal(base.hp,100);});

