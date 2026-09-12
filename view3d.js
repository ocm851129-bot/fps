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
    if(kind==='camo'){g.fillStyle='#c5c9b1';g.fillRect(0,0,256,256);for(let i=0;i<110;i++){g.fillStyle=['#697057','#889375','#414e43'][i%3];g.beginPath();const x=random()*256,y=random()*256;g.moveTo(x,y);for(let j=0;j<7;j++)g.lineTo(x+random()*48-24,y+random()*38-19);g.fill();}}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
  }
  sign(text,color='#d5b257',width=3) {
    const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle='#17272b';g.fillRect(0,0,512,128);g.strokeStyle=color;g.lineWidth=8;g.strokeRect(8,8,496,112);g.fillStyle=color;g.font='bold 58px sans-serif';g.textAlign='center';g.fillText(text,256,85);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));
  }
  build(grid,agents,mapId) {
    if(this.world){const retained=new Set(Object.values(this.materials));const materials=new Set();this.world.traverse(o=>{o.geometry?.dispose();if(o.material&&!retained.has(o.material))materials.add(o.material);});for(const m of materials){m.map?.dispose();m.dispose();}this.scene.remove(this.world);}
    this.world=new THREE.Group();this.scene.add(this.world);this.mapId=mapId;
    const indoors=mapId==='warehouse';
    this.scene.background.set(indoors?'#758993':'#a7bdc5');this.scene.fog.color.copy(this.scene.background);
    const groundTex=this.texture('ground');groundTex.repeat.set(20,20);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({map:groundTex,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(30,-.015,30);ground.receiveShadow=true;this.world.add(ground);
    const wallTex=this.texture('wall');const concrete=new THREE.MeshStandardMaterial({map:wallTex,roughness:.97,color:'#c3c2b7'});
    const containerColors=['#385c69','#a17149','#637359'];
    for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++){
      const type=+grid[y][x];if(!type)continue;const px=(x+.5)*S,pz=(y+.5)*S;
      const boundary=x===0||y===0||x===19||y===19;
      if(boundary){
        const h=6+(Math.floor(x/4)+Math.floor(y/4))%3*1.7;this.box(this.world,px,h/2,pz,3,h,3,concrete);
        this.box(this.world,px,h+.12,pz,3.08,.24,3.08,'#52615f');
        if((x+y)%2===0){const windowMat=this.material('#294451',.6,.25);const z=y===0?pz+1.52:y===19?pz-1.52:pz;const xx=x===0?px+1.52:x===19?px-1.52:px;this.box(this.world,xx,4,z,x===0||x===19?.04:1.6,1.5,y===0||y===19?.04:1.6,windowMat,false);}
      }else if(type===2||type===3){
        const h=2.8,col=containerColors[type-2];this.box(this.world,px,h/2,pz,2.98,h,2.98,col);
        for(let j=-1.3;j<1.5;j+=.3){this.box(this.world,px+j,1.4,pz+1.505,.06,2.6,.045,col,false);this.box(this.world,px+j,1.4,pz-1.505,.06,2.6,.045,col,false);}
        for(const sign of[-1,1]){this.box(this.world,px+sign*1.51,1.4,pz,.055,2.7,2.8,col,false);this.box(this.world,px,2.77,pz+sign*1.51,3,.13,.1,'#263d44');this.box(this.world,px,.15,pz+sign*1.51,3,.2,.1,'#263d44');}
        if((x+y)%3===0){const label=this.sign(type===2?'TRIAD / 07':'CARGO 03','#cdd6bf',1.6);label.position.set(px,1.7,pz+1.55);this.world.add(label);}
      }else{
        const wallHeight=indoors?6.4:3.2;this.box(this.world,px,wallHeight/2,pz,3,wallHeight,3,concrete);this.box(this.world,px,wallHeight+.02,pz,3.08,.12,3.08,'#636d64');
        this.box(this.world,px,1.1,pz+1.51,2.9,.24,.025,'#c1a556');
        for(let j=-1.2;j<1.4;j+=.45){const stripe=this.box(this.world,px+j,1.1,pz+1.53,.18,.25,.018,'#263133',false);stripe.rotation.z=-.35;}
      }
    }
    // Facade details stay inside existing solid cells so cover matches collision.
    for(const x of[4,8,12,16]){
      const px=(x+.5)*S;this.box(this.world,px,1.65,3.015,2.4,3.2,.025,'#657575');
      for(let k=0;k<12;k++)this.box(this.world,px,.2+k*.25,3.055,2.35,.025,.025,'#8b9992',false);
      const plaque=this.sign('BAY '+String(x/4).padStart(2,'0'),'#e2cf9d',2.4);plaque.position.set(px,3.75,3.06);this.world.add(plaque);
      this.box(this.world,px,4.15,3.1,2.85,.14,.6,'#3c5055');
    }
    for(const z of[12,27,42]){this.cylinder(this.world,3.06,3.8,z,.075,7,'#6f776e');this.box(this.world,3.08,2.2,z+.35,.13,.7,.6,'#394d51');}
    const zone=this.sign('B  /  LOADING','#82bbca',4);zone.position.set(55.45,4.1,43);zone.rotation.y=-Math.PI/2;this.world.add(zone);
    if(indoors){
      // Roof and beams sit above every player's line of fire. The courtyard remains open.
      for(const [x,z,w,d]of[[22.5,13.5,3,3],[37.5,13.5,3,3],[22.5,46.5,3,3],[37.5,46.5,3,3],[13.5,25.5,3,3],[13.5,34.5,3,3],[46.5,25.5,3,3],[46.5,34.5,3,3]])this.box(this.world,x,4.7,z,w,3.4,d,concrete);
      const roof=this.material('#3c4d50',.25);this.box(this.world,30,6.4,30,36,.18,36,roof);
      for(const z of[13.5,22.5,31.5,40.5,46.5]){this.box(this.world,30,5.8,z,36,.22,.2,'#26383d');for(const x of[14,46])this.box(this.world,x,4.45,z,.22,2.5,.22,'#26383d');}
      for(const [x,z]of[[22,22],[38,22],[22,38],[38,38]]){
        this.box(this.world,x,5.65,z,3,.07,.3,new THREE.MeshBasicMaterial({color:'#cfe8f3'}),false);
        const fill=new THREE.PointLight('#cee5f1',8,20,1.5);fill.position.set(x,4.8,z);this.world.add(fill);
      }
      for(const [label,x,z,angle]of[['A / ACCESS',22.5,11.9,Math.PI],['B / LOADING',37.5,48.1,0]]){const sign=this.sign(label,'#e7c378',4);sign.position.set(x,3.8,z);sign.rotation.y=angle;this.world.add(sign);}
    }
    // Ground markings and scenery outside the collision boundary.
    for(const x of[7.5,31.5,52.5]){this.box(this.world,x,.012,30,.14,.015,51,'#c7b366',false);}
    const sector=this.sign('SECTOR 07','#edca77',8);sector.position.set(30,5.3,4.52);this.world.add(sector);
    const arrow=this.sign('A  >','#dfbd67',2);arrow.position.set(25,2.4,19.52);this.world.add(arrow);
    for(let i=0;i<12;i++){const xx=-8+i*7;const h=10+(i*7)%11;this.box(this.world,xx,h/2,-12,5,h,7,this.material(i%2?'#748b8f':'#8a9998'),false);}
    for(const [x,z]of[[6,6],[54,6],[6,54],[54,54]]){this.cylinder(this.world,x,4.5,z,.07,9,'#405457');const lamp=this.box(this.world,x+.45,8.8,z,1.2,.15,.42,'#243638');this.box(this.world,x+.45,8.71,z,.85,.02,.3,new THREE.MeshBasicMaterial({color:'#fff0b1'}),false);}
    if(this.built)return;
    this.unitModels=agents.map((a,i)=>this.soldier(a.color,i));
    this.preview=this.soldier(agents[0].color,0);this.scene.remove(this.preview.group);
    this.previewScene=new THREE.Scene();this.previewScene.add(this.preview.group);
    this.previewScene.add(new THREE.HemisphereLight('#e6efff','#30332b',3));
    const portraitLight=new THREE.DirectionalLight('#ffdab0',4);portraitLight.position.set(-3,4,4);this.previewScene.add(portraitLight);
    const rim=new THREE.DirectionalLight('#80c6ed',3);rim.position.set(3,2,-2);this.previewScene.add(rim);
    this.previewCamera=new THREE.PerspectiveCamera(36,1,.1,20);this.previewCamera.position.set(0,1.2,3.5);this.previewCamera.lookAt(0,1,0);
    this.previewId=0;this.built=true;
  }
  gear(parent,x,y,z,w,h,d,material){
    const radius=Math.min(w,h,d)*.17,shape=new THREE.Shape();
    shape.moveTo(radius,0);shape.lineTo(w-radius,0);shape.quadraticCurveTo(w,0,w,radius);shape.lineTo(w,h-radius);shape.quadraticCurveTo(w,h,w-radius,h);shape.lineTo(radius,h);shape.quadraticCurveTo(0,h,0,h-radius);shape.lineTo(0,radius);shape.quadraticCurveTo(0,0,radius,0);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:d-radius*2,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:radius,bevelThickness:radius,curveSegments:3});geo.translate(-w/2,-h/2,-d/2+radius);
    const mesh=new THREE.Mesh(geo,typeof material==='string'?this.material(material):material);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  limb(parent,x,y,z,w,h,d,material){
    const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(1,1.5,4,8),material);mesh.scale.set(w/2,h/3.5,d/2);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  soldier(color,id=0) {
    const group=new THREE.Group();this.scene.add(group);
    const palette=[['#626c50','#30392f'],['#45525e','#202c36'],['#9b9171','#474837']][id];
    const camo=this.texture('camo');const uniform=new THREE.MeshStandardMaterial({map:camo,color:palette[0],roughness:1}),armor=this.material(palette[1]),skin=this.material('#bd9980');
    this.limb(group,0,1.19,0,.5,.66,.36,uniform);this.gear(group,0,1.24,.17,.45,.4,.12,armor);
    for(let x=-.14;x<=.15;x+=.14)this.gear(group,x,1.18,.25,.105,.18,.07,'#697464');
    this.gear(group,0,1.05,-.23,.38,.48,.18,'#3c4840');
    const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),skin);head.position.y=1.72;head.castShadow=true;group.add(head);
    const helmet=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8,0,Math.PI*2,0,Math.PI*.58),armor);helmet.position.set(0,1.78,0);group.add(helmet);
    const goggles=new THREE.Mesh(new THREE.SphereGeometry(.165,16,12),this.material('#243e45',.7,.2));goggles.scale.set(1,.32,.34);goggles.position.set(0,1.755,.135);group.add(goggles);
    const mask=new THREE.Mesh(new THREE.SphereGeometry(.153,16,12),armor);mask.scale.set(.93,.57,.68);mask.position.set(0,1.655,.055);group.add(mask);
    for(const x of[-.18,.18]){this.gear(group,x,1.74,0,.045,.15,.12,palette[1]);this.gear(group,x,1.5,-.11,.06,.28,.07,armor);}
    this.gear(group,.19,1.39,-.21,.07,.19,.06,'#1b2424');this.cylinder(group,.19,1.61,-.21,.009,.28,'#222c2c');
    this.gear(group,0,.97,.02,.49,.08,.34,armor);
    for(const x of[-.24,.24])this.gear(group,x,.96,.02,.1,.18,.16,palette[0]);
    if(id===0){this.gear(group,0,1.86,.16,.09,.09,.08,'#252e2a');this.gear(group,0,1.25,.26,.12,.08,.02,color);}
    if(id===1){helmet.scale.set(1,.82,1);this.gear(group,.24,.7,.04,.1,.25,.15,'#27333a');}
    if(id===2){this.gear(group,0,1.47,-.12,.58,.14,.39,palette[0]);for(let i=0;i<9;i++){const strip=this.gear(group,(i-4)*.063,1.34,-.26,.055,.33+(i%3)*.07,.07,i%2?'#6f7656':'#8c8861');strip.rotation.z=(i-4)*.055;}}
    this.gear(group,-.32,1.4,0,.055,.14,.21,color);
    const legs=[];for(const x of[-.145,.145]){const leg=new THREE.Group();leg.position.set(x,.91,0);group.add(leg);this.limb(leg,0,-.22,0,.23,.5,.26,uniform);this.limb(leg,0,-.6,.025,.2,.43,.23,uniform);this.gear(leg,0,-.83,.075,.2,.16,.32,'#28302c');this.gear(leg,0,-.46,.115,.18,.16,.075,armor);legs.push(leg);}
    const arm=this.limb(group,-.3,1.15,.13,.19,.51,.22,uniform);arm.rotation.x=-.5;
    const arm2=this.limb(group,.3,1.25,.19,.19,.49,.22,uniform);arm2.rotation.x=-1.1;
    const gun=this.gear(group,.22,1.3,.5,.09,.12,.68,'#1c272b');this.cylinder(group,.22,1.3,.86,.025,id===2?.4:.12,'#1d2223').rotation.x=Math.PI/2;
    this.gear(group,.22,1.17,.43,.07,.2,.12,'#323b36');this.gear(group,.22,1.3,.09,.11,.12,.19,'#414a40');this.gear(group,.22,1.38,.48,.07,.035,.36,'#4b5653');for(let k=0;k<5;k++)this.gear(group,.22,1.405,.35+k*.05,.08,.015,.015,'#111d20');
    if(id===2)this.cylinder(group,.22,1.42,.55,.045,.24,'#192527').rotation.x=Math.PI/2;
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
    if(!this.built||this.mapId!==data.mapId)this.build(data.grid,data.agents,data.mapId);
    const {player,units,state,step,flash,shots,dt}=data;
    const key=innerWidth+':'+innerHeight+':'+window.TriadInput.enabled;
    if(key!==this.lastSize){this.lastSize=key;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,window.TriadInput.enabled?1.25:1.6));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=!window.TriadInput.enabled;this.camera.aspect=this.gunCamera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.gunCamera.updateProjectionMatrix();}
    const inMenu=state==='menu', p=player;
    if(inMenu){const t=performance.now()*.000035;this.camera.position.set(30+Math.sin(t)*8,5.8,47);this.camera.lookAt(30,1.3,22);}
    else{this.camera.position.set(p.x*S,1.6+Math.sin(step)*.013,p.y*S);this.camera.lookAt(p.x*S+Math.cos(p.a),1.6+Math.sin(step)*.013+Math.tan(p.pitch||0),p.y*S+Math.sin(p.a));}
    const aiming=!inMenu&&p.hp>0&&data.aim&&p.reload<=0;
    this.ads=THREE.MathUtils.damp(this.ads,aiming?1:0,14,dt);
    this.camera.fov=75-this.ads*(p?.id===2?43:29);this.camera.updateProjectionMatrix();
    this.unitModels.forEach((m,i)=>{const u=units[i];m.group.visible=!inMenu&&!!u&&u.hp>0&&u!==p;if(!u)return;const movement=Math.hypot(u.x-m.lastX,u.y-m.lastZ);m.walk+=Math.min(movement,.2)*9;m.legs[0].rotation.x=Math.sin(m.walk)*.5;m.legs[1].rotation.x=-Math.sin(m.walk)*.5;m.lastX=u.x;m.lastZ=u.y;const next=new THREE.Vector3(u.x*S,0,u.y*S);if(m.group.position.distanceTo(next)>5)m.group.position.copy(next);else m.group.position.lerp(next,1-Math.exp(-18*dt));m.group.rotation.y=Math.PI/2-u.a;});
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
    if(inMenu&&innerWidth>700){
      const selected=data.selected||0;
      if(selected!==this.previewId){
        const old=this.preview.group;this.previewScene.remove(old);
        const custom=new Set();old.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material?.map)custom.add(o.material);});for(const m of custom){m.map.dispose();m.dispose();}
        this.preview=this.soldier(data.agents[selected].color,selected);
        this.scene.remove(this.preview.group);this.previewScene.add(this.preview.group);this.previewId=selected;
      }
      this.preview.group.rotation.y=.55+Math.sin(performance.now()*.0004)*.12;
      const w=Math.floor(innerWidth*.34),h=Math.floor(innerHeight*.8);
      this.previewCamera.aspect=w/h;this.previewCamera.updateProjectionMatrix();
      this.renderer.setViewport(innerWidth-w-20,Math.floor(innerHeight*.08),w,h);
      this.renderer.clearDepth();this.renderer.autoClear=false;this.renderer.render(this.previewScene,this.previewCamera);
      this.renderer.setViewport(0,0,innerWidth,innerHeight);
    }
    return true;
  }
}
try { window.Triad3D = new ArenaView(); }
catch(error) { console.warn('3D unavailable; using compatible renderer.',error.message); }
