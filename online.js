import {createClient} from '@supabase/supabase-js';
const $=id=>document.getElementById(id);
const names=['레이븐','바이퍼','고스트'];
const config=window.TriadOnlineConfig;
const client=createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:30}}});
const self=crypto.randomUUID();
let roomMap='yard';
let channel=null,room='',host='',members=[],running=false,subscribed=false,epoch='',seq=0,lastSeq=-1,lastHost=0,lastInput=0,lastSnapshot=0,joinTimer=0;
const status=text=>{$('online-status').textContent=text;};
const isHost=()=>host===self;
function send(event,payload){if(subscribed&&channel?.state==='joined')channel.send({type:'broadcast',event,payload:{...payload,from:self}});}
function renderLobby(){
  $('online-lobby').hidden=!channel;$('online-create').disabled=!!channel;$('online-join').disabled=!!channel;
  $('online-map').textContent=window.TriadMaps[roomMap].name;
  $('online-members').textContent=members.map(m=>`${names[m.slot]}${m.id===self?' (나)':''}${m.id===host?' · 방장':''}`).join(' / ');
  $('online-launch').hidden=!isHost();$('online-launch').disabled=members.length<2||running;
  document.querySelectorAll('.armory select, [data-map], .character').forEach(el=>el.disabled=!!channel);$('start').disabled=!!channel;$('map-choice').disabled=!!channel;
  $('online-count').textContent=`${members.length} / 3`;
}
function roster(){send('roster',{members,running,epoch,mapId:roomMap});renderLobby();}
function validMembers(list){return Array.isArray(list)&&list.length<=3&&list.every(m=>m&&typeof m.id==='string'&&Number.isInteger(m.slot)&&m.slot>=0&&m.slot<3)&&new Set(list.map(m=>m.slot)).size===list.length&&new Set(list.map(m=>m.id)).size===list.length;}
function begin(){
  const me=members.find(m=>m.id===self);if(!me)return;
  window.TriadGame.setMap(roomMap);running=true;lastSeq=-1;lastHost=performance.now();window.TriadGame.beginOnline(members,me.slot,isHost());renderLobby();status('온라인 전투 진행 중');
}
async function leave(message='방에서 나왔습니다.'){
  clearTimeout(joinTimer);if(channel){send('leave',{});const old=channel;channel=null;subscribed=false;await client.removeChannel(old);}
  if(running)window.TriadGame.endOnline();running=false;members=[];room='';host='';epoch='';renderLobby();status(message);
}
async function connect(create,token,owner){
  if(channel)return;
  if(!create&&(!/^[a-f0-9-]{36}$/.test(token)||!/^[a-f0-9-]{36}$/.test(owner))){status('유효한 초대 링크를 입력하세요.');return;}
  roomMap=window.TriadGame.map();room=create?crypto.randomUUID():token;host=create?self:owner;
  members=create?[{id:self,slot:window.TriadGame.selected(),kit:window.TriadCareer.kit(window.TriadGame.selected())}]:[];
  status('서울 서버 연결 중…');lastHost=performance.now();
  channel=client.channel('triad-v1:'+room,{config:{broadcast:{self:false},presence:{key:self}}});
  channel.on('broadcast',{event:'hello'},({payload:p})=>{
    if(!isHost()||typeof p.from!=='string')return;
    if(members.some(m=>m.id===p.from)){roster();return;}
    if(running||members.length>=3){send('reject',{to:p.from,reason:running?'이미 전투 중인 방입니다.':'방이 가득 찼습니다.'});return;}
    const free=[0,1,2].filter(slot=>!members.some(m=>m.slot===slot));
    members.push({id:p.from,slot:free.includes(p.slot)?p.slot:free[0],kit:window.TriadCareer.clean(p.kit)});roster();
  });
  channel.on('broadcast',{event:'roster'},({payload:p})=>{
    if(isHost()||p.from!==host||!validMembers(p.members))return;
    members=p.members;if(running)window.TriadGame.setMembers(members);roomMap=window.TriadMaps[p.mapId]?p.mapId:'yard';lastHost=performance.now();renderLobby();
    if(members.some(m=>m.id===self)){clearTimeout(joinTimer);status('입장 완료 · 방장의 전투 시작을 기다리세요.');}
  });
  channel.on('broadcast',{event:'reject'},({payload:p})=>{if(p.from===host&&p.to===self)leave(p.reason);});
  channel.on('broadcast',{event:'start'},({payload:p})=>{if(!isHost()&&p.from===host&&validMembers(p.members)&&typeof p.epoch==='string'){members=p.members;roomMap=window.TriadMaps[p.mapId]?p.mapId:'yard';epoch=p.epoch;begin();}});
  channel.on('broadcast',{event:'input'},({payload:p})=>{
    if(!isHost()||!running||p.epoch!==epoch)return;const member=members.find(m=>m.id===p.from);if(member)window.TriadGame.remoteInput(member.slot,p.input);
  });
  channel.on('broadcast',{event:'snapshot'},({payload:p})=>{
    if(isHost()||!running||p.from!==host||p.epoch!==epoch||!Number.isInteger(p.seq)||p.seq<=lastSeq)return;
    lastSeq=p.seq;lastHost=performance.now();window.TriadGame.applySnapshot(p.data);
  });
  channel.on('broadcast',{event:'leave'},({payload:p})=>{
    if(p.from===host&&!isHost()){leave('방장이 나가 대전이 종료되었습니다.');return;}
    if(isHost()){members=members.filter(m=>m.id!==p.from);window.TriadGame.setMembers(members);roster();}
  });
  channel.on('presence',{event:'sync'},()=>{
    if(!isHost())return;const present=Object.keys(channel.presenceState());
    const removed=members.filter(m=>m.id!==self&&!present.includes(m.id));
    if(removed.length){members=members.filter(m=>!removed.includes(m));window.TriadGame.setMembers(members);roster();}
  });
  const connection=channel;
  channel.subscribe(async state=>{
    if(channel!==connection)return;
    if(state==='SUBSCRIBED'){
      subscribed=true;await connection.track({online:true});if(channel!==connection)return;
      if(create){status('방이 준비되었습니다. 초대 링크를 친구에게 공유하세요.');roster();}
      else{send('hello',{slot:window.TriadGame.selected(),kit:window.TriadCareer.kit(window.TriadGame.selected())});joinTimer=setTimeout(()=>{if(!members.some(m=>m.id===self))leave('방을 찾지 못했습니다. 방장이 연결되어 있는지 확인하세요.');},12000);}
      renderLobby();
    }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(state)){leave('서버 연결이 끊겼습니다. 방에 다시 입장하세요.');}
  });
  renderLobby();
}
$('online-create').onclick=()=>connect(true);
$('online-join').onclick=()=>{try{const url=new URL($('online-invite').value.trim());const q=new URLSearchParams(url.hash.slice(1));connect(false,q.get('room')||'',q.get('host')||'');}catch{status('전체 초대 링크를 입력하세요.');}};
$('online-copy').onclick=async()=>{const url=new URL(location.href);url.hash=new URLSearchParams({room,host}).toString();$('online-invite').value=url.href;try{await navigator.clipboard.writeText(url.href);status('초대 링크를 복사했습니다.');}catch{status('입력란의 초대 링크를 길게 눌러 복사하세요.');}};
$('online-leave').onclick=()=>leave();
$('online-launch').onclick=()=>{if(!isHost()||members.length<2||running)return;epoch=crypto.randomUUID();seq=0;send('start',{members,epoch,mapId:roomMap});begin();};
$('online-back').onclick=()=>leave();
$('online-tab').onclick=()=>{$('online-panel').hidden=false;};
$('online-close').onclick=()=>{$('online-panel').hidden=true;};
const invite=new URLSearchParams(location.hash.slice(1));if(invite.has('room')){$('online-panel').hidden=false;$('online-invite').value=location.href;}
setInterval(()=>{
  if(!channel||!subscribed)return;const now=performance.now();
  if(isHost()){
    if(running&&now-lastSnapshot>=66){lastSnapshot=now;send('snapshot',{data:window.TriadGame.snapshot(),seq:++seq,epoch});}
    else if(!running&&now-lastSnapshot>=2000){lastSnapshot=now;roster();}
  }else{
    if(running&&now-lastInput>=50){lastInput=now;send('input',{input:window.TriadGame.readInput(),epoch});}
    if(members.length&&now-lastHost>10000)leave('방장 연결이 끊겼습니다. 새 방에서 다시 만나세요.');
  }
},33);
window.TriadOnline={leave};
status('서울 서버 · 최대 3인 초대 대전');

