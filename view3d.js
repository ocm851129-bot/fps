import * as THREE from './vendor/three.module.js';

// The simulation remains independent of WebGL. A device without WebGL keeps the canvas renderer.
const S = 3;
class ArenaView {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.domElement.id = 'world3d';
    this.renderer.domElement.setAttribute('aria-hidden','true');
    document.body.prepend(this.renderer.domElement);
    this.renderer.shadowMap.enabled = !window.TriadInput.enabled;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a7bdc5');
    this.scene.fog = new THREE.Fog('#a7bdc5',42,115);
    this.camera = new THREE.PerspectiveCamera(75,1,.035,200);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight('#e4f2ff','#6c6751',2.2));
    const sun = new THREE.DirectionalLight('#ffe3ae',3.2);
    sun.position.set(-15,45,15);sun.target.position.set(30,0,30);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,far:130});sun.shadow.bias=-.001;
    this.scene.add(sun,sun.target);
    this.unitModels=[];this.traces=[];this.lastShot=0;this.ads=0;this.recoil=0;
    this.materials={};
    this.weaponScene=new THREE.Scene();this.weaponScene.add(new THREE.HemisphereLight('#e6f4ff','#3d4037',2.5));
    this.weaponScene.add(new THREE.AmbientLight('#c8d4dd',.8));
    const gunLight=new THREE.DirectionalLight('#fff1d6',3);gunLight.position.set(-2,4,3);this.weaponScene.add(gunLight);
    this.gunCamera=new THREE.PerspectiveCamera(65,1,.01,20);
    this.gunRoot=new THREE.Group();this.weaponScene.add(this.gunRoot);
    this.gunId=-1;
    this.lastSize='';
    document.body.classList.add('webgl-ready');
    this.renderer.domElement.addEventListener('webglcontextlost', e=>{e.preventDefault();document.body.classList.remove('webgl-ready');this.lost=true;});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.lost=false;document.body.classList.add('webgl-ready');});
  }
  material(color,metalness=0,roughness=.85) {
    const key=color+':'+metalness;return this.materials[key] ||= new THREE.MeshStandardMaterial({color,metalness,roughness});
  }
  box(parent,x,y,z,w,h,d,material,shadow=true) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof material==='string'?this.material(material):material);
    mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  cylinder(parent,x,y,z,r,h,color) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),this.material(color,.25));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  texture(kind) {
    const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
    let seed=71;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    g.fillStyle=kind==='ground'?'#7c7d70':kind==='wall'?'#b8b4a1':'#657b71';g.fillRect(0,0,256,256);
    for(let i=0;i<12000;i++){const v=Math.floor(random()*90);g.fillStyle=`rgba(${v},${v},${v},.08)`;g.fillRect(random()*256,random()*256,random()*3+1,random()*3+1);}
    if(kind==='wall'){g.strokeStyle='#6b71664d';g.lineWidth=2;for(let y=0;y<256;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();for(let x=(y%128?0:64);x<256;x+=128){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+64);g.stroke();}}}
    if(kind==='ground'){g.strokeStyle='#aaa99b55';g.lineWidth=2;g.strokeRect(1,1,254,254);for(let i=0;i<4;i++){g.beginPath();g.moveTo(random()*256,random()*256);g.lineTo(random()*256,random()*256);g.stroke();}}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
  }
  sign(text,color='#d5b257',width=3) {
    const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle='#17272b';g.fillRect(0,0,512,128);g.strokeStyle=color;g.lineWidth=8;g.strokeRect(8,8,496,112);g.fillStyle=color;g.font='bold 58px sans-serif';g.textAlign='center';g.fillText(text,256,85);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));
  }
  build(grid,agents) {
    const groundTex=this.texture('ground');groundTex.repeat.set(20,20);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({map:groundTex,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(30,-.015,30);ground.receiveShadow=true;this.scene.add(ground);
    const wallTex=this.texture('wall');const concrete=new THREE.MeshStandardMaterial({map:wallTex,roughness:.97,color:'#c3c2b7'});
    const containerColors=['#385c69','#a17149','#637359'];
    for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++){
      const type=+grid[y][x];if(!type)continue;const px=(x+.5)*S,pz=(y+.5)*S;
      const boundary=x===0||y===0||x===19||y===19;
      if(boundary){
        const h=6+(Math.floor(x/4)+Math.floor(y/4))%3*1.7;this.box(this.scene,px,h/2,pz,3,h,3,concrete);
        this.box(this.scene,px,h+.12,pz,3.08,.24,3.08,'#52615f');
        if((x+y)%2===0){const windowMat=this.material('#294451',.6,.25);const z=y===0?pz+1.52:y===19?pz-1.52:pz;const xx=x===0?px+1.52:x===19?px-1.52:px;this.box(this.scene,xx,4,z,x===0||x===19?.04:1.6,1.5,y===0||y===19?.04:1.6,windowMat,false);}
      }else if(type===2||type===3){
        const h=2.8,col=containerColors[type-2];this.box(this.scene,px,h/2,pz,2.98,h,2.98,col);
        for(let j=-1.3;j<1.5;j+=.3){this.box(this.scene,px+j,1.4,pz+1.505,.06,2.6,.045,col,false);this.box(this.scene,px+j,1.4,pz-1.505,.06,2.6,.045,col,false);}
        for(const sign of[-1,1]){this.box(this.scene,px+sign*1.51,1.4,pz,.055,2.7,2.8,col,false);this.box(this.scene,px,2.77,pz+sign*1.51,3,.13,.1,'#263d44');this.box(this.scene,px,.15,pz+sign*1.51,3,.2,.1,'#263d44');}
        if((x+y)%3===0){const label=this.sign(type===2?'TRIAD / 07':'CARGO 03','#cdd6bf',1.6);label.position.set(px,1.7,pz+1.55);this.scene.add(label);}
      }else{
        this.box(this.scene,px,1.6,pz,3,3.2,3,concrete);this.box(this.scene,px,3.22,pz,3.08,.12,3.08,'#636d64');
        this.box(this.scene,px,1.1,pz+1.51,2.9,.24,.025,'#c1a556');
        for(let j=-1.2;j<1.4;j+=.45){const stripe=this.box(this.scene,px+j,1.1,pz+1.53,.18,.25,.018,'#263133',false);stripe.rotation.z=-.35;}
      }
    }
    // Ground markings and scenery outside the collision boundary.
    for(const x of[7.5,31.5,52.5]){this.box(this.scene,x,.012,30,.14,.015,51,'#c7b366',false);}
    const sector=this.sign('SECTOR 07','#edca77',8);sector.position.set(30,5.3,4.52);this.scene.add(sector);
    const arrow=this.sign('A  >','#dfbd67',2);arrow.position.set(25,2.4,19.52);this.scene.add(arrow);
    for(let i=0;i<12;i++){const xx=-8+i*7;const h=10+(i*7)%11;this.box(this.scene,xx,h/2,-12,5,h,7,this.material(i%2?'#748b8f':'#8a9998'),false);}
    for(const [x,z]of[[6,6],[54,6],[6,54],[54,54]]){this.cylinder(this.scene,x,4.5,z,.07,9,'#405457');const lamp=this.box(this.scene,x+.45,8.8,z,1.2,.15,.42,'#243638');this.box(this.scene,x+.45,8.71,z,.85,.02,.3,new THREE.MeshBasicMaterial({color:'#fff0b1'}),false);}
    this.unitModels=agents.map(a=>this.soldier(a.color));this.built=true;
  }
  soldier(color) {
    const group=new THREE.Group();this.scene.add(group);
    const uniform=this.material('#526054'),armor=this.material('#2d3736'),skin=this.material('#bd9980');
    this.box(group,0,1.19,0,.48,.58,.3,uniform);this.box(group,0,1.24,.17,.45,.4,.12,armor);
    for(let x=-.14;x<=.15;x+=.14)this.box(group,x,1.18,.25,.105,.18,.07,'#697464');
    this.box(group,0,1.05,-.23,.38,.48,.18,'#3c4840');
    const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),skin);head.position.y=1.72;head.castShadow=true;group.add(head);
    const helmet=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8,0,Math.PI*2,0,Math.PI*.58),armor);helmet.position.set(0,1.78,0);group.add(helmet);
    this.box(group,0,1.74,.148,.29,.055,.045,'#172b30');
    this.box(group,-.31,1.4,0,.14,.2,.29,color);
    const legs=[];for(const x of[-.145,.145]){const leg=new THREE.Group();leg.position.set(x,.91,0);group.add(leg);this.box(leg,0,-.22,0,.2,.43,.22,uniform);this.box(leg,0,-.6,.025,.17,.37,.19,uniform);this.box(leg,0,-.83,.075,.2,.16,.32,'#28302c');this.box(leg,0,-.46,.115,.18,.16,.075,armor);legs.push(leg);}
    const arm=this.box(group,-.3,1.15,.13,.16,.48,.18,uniform);arm.rotation.x=-.5;
    const arm2=this.box(group,.3,1.25,.19,.16,.44,.18,uniform);arm2.rotation.x=-1.1;
    const gun=this.box(group,.22,1.3,.5,.09,.12,.68,'#1c272b');this.cylinder(group,.22,1.3,.86,.025,.12,'#1d2223').rotation.x=Math.PI/2;
    const name=this.sign('',color,.65);name.visible=false;group.add(name);
    return {group,legs,gun,lastX:0,lastZ:0,walk:0};
  }
  weapon(id) {
    while(this.gunRoot.children.length){const child=this.gunRoot.children[0];child.traverse(o=>{if(o.geometry)o.geometry.dispose();});this.gunRoot.remove(child);}
    const gun=new THREE.Group();this.gunRoot.add(gun);this.gun=gun;this.gunId=id;
    const steel=this.material('#414b50',.55,.48),black=this.material('#151d22',.4,.55),tan=this.material(id===2?'#7b8061':'#5e675d',.25,.6);
    this.box(gun,0,0,-.27,.12,.14,.4,steel);
    this.box(gun,0,.07,-.58,.1,.08,id===1?.22:.4,tan);
    this.box(gun,0,.13,-.36,.09,.03,.55,black);
    for(let i=0;i<9;i++)this.box(gun,0,.151,-.13-i*.052,.11,.013,.015,steel,false);
    for(const x of[-.06,.06])for(let j=0;j<5;j++)this.box(gun,x,.055,-.43-j*.038,.012,.028,.018,black,false);
    const barrel=this.cylinder(gun,0,.06,id===2?-.97:-.83,.022,id===2?.38:.22,'#202b30');barrel.rotation.x=Math.PI/2;
    this.box(gun,0,-.13,-.23,.08,.2,.11,tan).rotation.x=-.2;
    this.box(gun,.006,-.17,-.05,.075,.2,.09,black).rotation.x=-.27;
    this.box(gun,0,-.005,.13,.105,.1,.28,tan);this.box(gun,0,-.02,.29,.12,.2,.06,black);
    this.box(gun,.072,.025,-.23,.018,.06,.12,'#667377');this.box(gun,.082,.023,-.12,.06,.024,.018,steel);
    if(id===2){const scope=this.cylinder(gun,0,.21,-.35,.058,.36,'#1a2429');scope.rotation.x=Math.PI/2;}
    else{this.box(gun,-.045,.19,-.29,.015,.1,.02,black);this.box(gun,.045,.19,-.29,.015,.1,.02,black);this.box(gun,0,.24,-.29,.1,.015,.02,black);}
    // Gloved hands and sleeves frame the weapon.
    this.box(gun,-.025,-.17,.02,.12,.15,.15,'#38483e').rotation.x=-.3;
    this.box(gun,-.12,-.18,-.48,.14,.14,.22,'#38483e').rotation.z=-.4;
    const sleeve=this.box(gun,.045,-.35,.19,.19,.35,.28,'#667460');sleeve.rotation.x=-.5;
    const sleeve2=this.box(gun,-.19,-.29,-.3,.18,.3,.25,'#667460');sleeve2.rotation.x=.8;sleeve2.rotation.z=-.3;
    const flashMat=new THREE.MeshBasicMaterial({color:'#fff2b4',transparent:true,opacity:.9,depthTest:false});
    this.flashMesh=new THREE.Mesh(new THREE.ConeGeometry(.085,.32,7),flashMat);this.flashMesh.rotation.x=-Math.PI/2;this.flashMesh.position.set(0,.06,id===2?-1.19:-1.02);gun.add(this.flashMesh);
  }
  render(data) {
    if(this.lost)return false;
    if(!this.built)this.build(data.grid,data.agents);
    const {player,units,state,step,flash,shots,dt}=data;
    const key=innerWidth+':'+innerHeight+':'+window.TriadInput.enabled;
    if(key!==this.lastSize){this.lastSize=key;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,window.TriadInput.enabled?1.25:1.6));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=!window.TriadInput.enabled;this.camera.aspect=this.gunCamera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.gunCamera.updateProjectionMatrix();}
    const inMenu=state==='menu', p=player;
    if(inMenu){const t=performance.now()*.000035;this.camera.position.set(30+Math.sin(t)*8,5.8,47);this.camera.lookAt(30,1.3,22);}
    else{this.camera.position.set(p.x*S,1.6+Math.sin(step)*.013,p.y*S);this.camera.lookAt(p.x*S+Math.cos(p.a),1.6+Math.sin(step)*.013+Math.tan(p.pitch||0),p.y*S+Math.sin(p.a));}
    const aiming=!inMenu&&p.hp>0&&data.aim&&p.reload<=0;
    this.ads=THREE.MathUtils.damp(this.ads,aiming?1:0,14,dt);
    this.camera.fov=75-this.ads*(p?.id===2?43:29);this.camera.updateProjectionMatrix();
    this.unitModels.forEach((m,i)=>{const u=units[i];m.group.visible=!inMenu&&!!u&&u.hp>0&&u!==p;if(!u)return;const movement=Math.hypot(u.x-m.lastX,u.y-m.lastZ);m.walk+=Math.min(movement,.2)*9;m.legs[0].rotation.x=Math.sin(m.walk)*.5;m.legs[1].rotation.x=-Math.sin(m.walk)*.5;m.lastX=u.x;m.lastZ=u.y;m.group.position.set(u.x*S,0,u.y*S);m.group.rotation.y=Math.PI/2-u.a;});
    if(!inMenu&&shots!==this.lastShot){this.lastShot=shots;this.recoil=.05;}
    this.recoil=THREE.MathUtils.damp(this.recoil,0,18,dt);
    this.renderer.autoClear=true;this.renderer.render(this.scene,this.camera);
    if(!inMenu&&p.hp>0){
      if(p.id!==this.gunId)this.weapon(p.id);
      const reloadPhase=p.reload>0?Math.sin(Math.PI*p.reload/data.agents[p.id].reload):0;
      this.gunRoot.position.set(.24*(1-this.ads),-.25+.04*this.ads-reloadPhase*.23,-.76+.16*this.ads+this.recoil);
      this.gunRoot.rotation.set(this.recoil*1.4-reloadPhase*.25,.035*(1-this.ads),reloadPhase*-.45+Math.sin(step)*.008);
      this.flashMesh.visible=flash>0;this.flashMesh.rotation.z=performance.now()*.01;
      this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.weaponScene,this.gunCamera);
    }
    return true;
  }
}
try { window.Triad3D = new ArenaView(); }
catch(error) { console.warn('3D unavailable; using compatible renderer.',error.message); }
