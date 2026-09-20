import * as THREE from './assets/three/three.module.js';

export function createStarlightScene({host,world,jarLabel,onStored,reducedMotion=false}) {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});
  const pixelRatio=Math.min(devicePixelRatio||1,1.75);
  renderer.setPixelRatio(pixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.setClearColor(0x000000,0);renderer.domElement.id='three-scene';renderer.domElement.dataset.renderer=`three.js r${THREE.REVISION}`;
  renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,1,2200);camera.position.z=1000;
  scene.add(new THREE.HemisphereLight(0xffefcf,0x465279,2.1));
  const sun=new THREE.DirectionalLight(0xffe8b4,2.7);sun.position.set(-300,420,700);scene.add(sun);
  const rimLight=new THREE.DirectionalLight(0xc8eaff,1.7);rimLight.position.set(300,100,-200);scene.add(rimLight);
  const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
  let width=1,height=1,mobile=false,time=0,playing=false,stored=0,storedStars=0,storedMoons=0,jarHover=false;
  let detachCount=0;const holds=new Map(),hovers=new Map();
  const skyOffset=new THREE.Vector2(),skyVelocity=new THREE.Vector2(),skyTarget=new THREE.Vector2();
  // Move only the painted sky. A fixed feathered mask keeps the foreground
  // landscape and rabbit untouched while the Milky Way follows the spring.
  const galaxyLayer=document.createElement('div');galaxyLayer.id='galaxy-drift';galaxyLayer.setAttribute('aria-hidden','true');
  const galaxyPicture=world.querySelector('#background').cloneNode(true);galaxyPicture.removeAttribute('id');galaxyPicture.querySelector('img').alt='';galaxyLayer.append(galaxyPicture);world.querySelector('#background').after(galaxyLayer);

  let handX=0,handY=0,parallaxX=0,parallaxY=0;
  let seed=18403;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  const items=[],flights=[],sparks=[];
  const invisible=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const hitGeometry=new THREE.SphereGeometry(1,14,10);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;
  const glowContext=glowCanvas.getContext('2d'),gradient=glowContext.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,249,215,.95)');gradient.addColorStop(.08,'rgba(255,227,151,.8)');gradient.addColorStop(.23,'rgba(255,204,111,.2)');gradient.addColorStop(.55,'rgba(242,207,153,.06)');gradient.addColorStop(1,'rgba(255,223,155,0)');
  glowContext.fillStyle=gradient;glowContext.fillRect(0,0,128,128);
  const glowMap=new THREE.CanvasTexture(glowCanvas);
  const sprite=(opacity=1,color=0xffffff)=>new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));
  const starShape=new THREE.Shape();for(let i=0;i<8;i++){const angle=Math.PI/2+i*Math.PI/4,r=i%2?.2:1;const x=Math.cos(angle)*r,y=Math.sin(angle)*r;if(i===0)starShape.moveTo(x,y);else starShape.lineTo(x,y);}starShape.closePath();
  const starGeometry=new THREE.ExtrudeGeometry(starShape,{depth:.2,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.055,bevelThickness:.09});starGeometry.center();
  const starMaterial=new THREE.MeshStandardMaterial({color:0xffeec2,emissive:0xffce6c,emissiveIntensity:.85,roughness:.3,metalness:.3});
  function makeStar(index){
    const root=new THREE.Group(),mesh=new THREE.Mesh(starGeometry,starMaterial),glow=sprite(.78),hit=new THREE.Mesh(hitGeometry,invisible);
    root.add(mesh,glow);glow.position.z=-3;glow.scale.setScalar(82);scene.add(root,hit);
    const item={id:index,kind:'star',root,mesh,glow,hit,status:'free',nx:0,ny:0,phase:random()*Math.PI*2,size:10+random()*5,depth:30+random()*110};
    hit.userData.item=item;items.push(item);return item;
  }
  for(let i=0;i<30;i++)makeStar(i);

  // Match the touch edition's softly illustrated moon, independent of scene lighting.
  const moonTextureCanvas=document.createElement('canvas');moonTextureCanvas.width=512;moonTextureCanvas.height=512;
  const mc=moonTextureCanvas.getContext('2d'),mx=256,my=256,mr=256;
  const moonGradient=mc.createRadialGradient(mx-mr*.3,my-mr*.35,1,mx,my,mr);
  moonGradient.addColorStop(0,'#fff6da');moonGradient.addColorStop(.72,'#f8e8bd');moonGradient.addColorStop(1,'#eddaa9');
  mc.fillStyle=moonGradient;mc.fillRect(0,0,512,512);
  mc.fillStyle='rgba(169,142,95,.045)';
  [[.4,-.4,.2],[-.5,.05,.18],[.2,.55,.12]].forEach(([x,y,r])=>{mc.beginPath();mc.arc(mx+x*mr,my+y*mr,r*mr,0,Math.PI*2);mc.fill();});
  mc.strokeStyle='rgba(101,69,48,.7)';mc.lineWidth=mr*.035;mc.lineCap='round';
  [-.26,.15].forEach(x=>{mc.beginPath();mc.arc(mx+x*mr,my+mr*.13,mr*.12,.1,Math.PI-.1);mc.stroke();});
  mc.beginPath();mc.arc(mx,my+mr*.30,mr*.06,0,Math.PI);mc.stroke();
  // Feather the disc edge so it blends gently into the wide, low-contrast halo.
  mc.globalCompositeOperation='destination-in';
  const edge=mc.createRadialGradient(mx,my,mr*.975,mx,my,mr);edge.addColorStop(0,'rgba(0,0,0,1)');edge.addColorStop(1,'rgba(0,0,0,0)');mc.fillStyle=edge;mc.fillRect(0,0,512,512);mc.globalCompositeOperation='source-over';
  // Preserve the existing random sequence for the surrounding stars and particles.
  for(let i=0;i<4120;i++)random();
  const moonMap=new THREE.CanvasTexture(moonTextureCanvas);moonMap.colorSpace=THREE.SRGBColorSpace;
  const moonRoot=new THREE.Group(),moonMesh=new THREE.Mesh(new THREE.CircleGeometry(1,96),new THREE.MeshBasicMaterial({map:moonMap,toneMapped:false,transparent:true,side:THREE.DoubleSide}));
  const moonHaloCanvas=document.createElement('canvas');moonHaloCanvas.width=256;moonHaloCanvas.height=256;
  const hc=moonHaloCanvas.getContext('2d'),halo=hc.createRadialGradient(128,128,0,128,128,128);
  halo.addColorStop(0,'rgba(255,237,191,.38)');halo.addColorStop(.4,'rgba(255,237,191,.28)');halo.addColorStop(.62,'rgba(255,237,191,.11)');halo.addColorStop(.82,'rgba(255,237,191,.025)');halo.addColorStop(1,'rgba(255,237,191,0)');hc.fillStyle=halo;hc.fillRect(0,0,256,256);
  const moonHaloMap=new THREE.CanvasTexture(moonHaloCanvas);moonHaloMap.colorSpace=THREE.SRGBColorSpace;
  const moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:moonHaloMap,transparent:true,opacity:.65,depthWrite:false,toneMapped:false}));moonGlow.position.z=-8;moonRoot.add(moonMesh,moonGlow);
  renderer.domElement.dataset.moonStyle='soft-cream';
  const moonHit=new THREE.Mesh(hitGeometry,invisible);scene.add(moonRoot,moonHit);
  const moon={id:'moon',kind:'moon',root:moonRoot,mesh:moonMesh,glow:moonGlow,hit:moonHit,status:'free',nx:.8,ny:.25,phase:1.2,depth:90,size:46};moonHit.userData.item=moon;

  // Fine animated star layers use depth, independent twinkle and subtle drift.
  const pointCount=1250,pointPositions=new Float32Array(pointCount*3),phases=new Float32Array(pointCount),sizes=new Float32Array(pointCount);
  for(let i=0;i<pointCount;i++){pointPositions[i*3]=(random()-.5)*1.14;pointPositions[i*3+1]=(random()-.5)*1.08;pointPositions[i*3+2]=-220+random()*460;phases[i]=random()*6.28;sizes[i]=.5+Math.pow(random(),3)*2.5;}
  const pointGeometry=new THREE.BufferGeometry();pointGeometry.setAttribute('position',new THREE.BufferAttribute(pointPositions,3));pointGeometry.setAttribute('phase',new THREE.BufferAttribute(phases,1));pointGeometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));
  const pointMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uPull:{value:new THREE.Vector2()},uResolution:{value:new THREE.Vector2(1,1)},uParallax:{value:new THREE.Vector2()},uRatio:{value:pixelRatio},uEnergy:{value:0}},vertexShader:`attribute float phase;attribute float size;uniform float uTime;uniform vec2 uResolution;uniform vec2 uPull;uniform vec2 uParallax;uniform float uRatio;uniform float uEnergy;varying float vAlpha;varying float vWarm;void main(){vec3 p=position;p.xy*=uResolution;p.x+=sin(uTime*.04+phase)*4.;p.y+=cos(uTime*.06+phase)*5.;p.x+=sin(position.y*6.+uTime*.12)*7.;p.xy+=uPull*(.45+(p.z+220.)/680.);p.xy+=uParallax*(p.z+260.)*.035;vAlpha=.3+.7*pow(.5+.5*sin(uTime*(.5+size*.1)+phase),2.);vWarm=phase;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=(size+uEnergy*.4)*uRatio*2.3;}`,fragmentShader:`varying float vAlpha;varying float vWarm;void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r),2.2)*vAlpha;vec3 c=mix(vec3(.65,.79,1.),vec3(1.,.86,.57),.5+.5*sin(vWarm));gl_FragColor=vec4(c,a);}`});
  scene.add(new THREE.Points(pointGeometry,pointMaterial));

  // Open glass wishing bottle with three-dimensional rim, reflections and lights.
  const jar=new THREE.Group();scene.add(jar);jar.visible=true;
  const profile=[[0,0],[.55,0],[.72,.08],[.76,.25],[.76,1.25],[.67,1.48],[.42,1.65],[.4,1.84],[.48,1.89],[.48,1.96],[.35,1.96],[.33,1.86],[.33,1.68]];
  const glass=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),64),new THREE.MeshPhysicalMaterial({color:0xd2e3ff,roughness:.08,metalness:.06,clearcoat:1,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false}));jar.add(glass);
  const rimMaterial=new THREE.MeshBasicMaterial({color:0xffecc5,transparent:true,opacity:.72});
  for(const y of [1.91,1.97]){const ring=new THREE.Mesh(new THREE.TorusGeometry(y<1?.61:.46,.012,7,64),rimMaterial);ring.rotation.x=Math.PI/2;ring.position.y=y;jar.add(ring);}
  const rimHalo=new THREE.Mesh(new THREE.TorusGeometry(.48,.027,8,64),new THREE.MeshBasicMaterial({color:0xffd386,transparent:true,opacity:.22}));rimHalo.rotation.x=Math.PI/2;rimHalo.position.y=1.95;jar.add(rimHalo);
  // The opening faces upward and slightly toward the camera, making its inside
  // visibly different from the bottle's closed base.
  const opening=new THREE.Mesh(new THREE.CircleGeometry(.345,64),new THREE.MeshBasicMaterial({color:0x101b36,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false}));opening.rotation.x=-Math.PI/2;opening.position.y=1.935;jar.add(opening);
  const innerRim=new THREE.Mesh(new THREE.TorusGeometry(.345,.012,8,64),new THREE.MeshBasicMaterial({color:0xc9e1f0,transparent:true,opacity:.6}));innerRim.rotation.x=Math.PI/2;innerRim.position.y=1.947;jar.add(innerRim);
  const shineMaterial=new THREE.MeshBasicMaterial({color:0xf1f4ff,transparent:true,opacity:.5});
  for(const sign of [-1,1]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(sign*.49,.1,.43),new THREE.Vector3(sign*.68,.28,.26),new THREE.Vector3(sign*.69,1.1,.25),new THREE.Vector3(sign*.57,1.43,.28),new THREE.Vector3(sign*.34,1.7,.25)]);jar.add(new THREE.Mesh(new THREE.TubeGeometry(curve,32,.012,5,false),shineMaterial));}
  // A closed, softly lit glass foot, with no bright ring resembling a second mouth.
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.65,.59,.075,64),new THREE.MeshPhysicalMaterial({color:0xdceaff,transparent:true,opacity:.2,roughness:.16,depthWrite:false}));foot.position.y=.055;jar.add(foot);
  const footHighlight=new THREE.Mesh(new THREE.TorusGeometry(.63,.014,8,48,Math.PI),new THREE.MeshBasicMaterial({color:0xd7eaff,transparent:true,opacity:.38}));footHighlight.rotation.x=Math.PI/2;footHighlight.position.y=.075;jar.add(footHighlight);
  const baseGlow=sprite(.12);baseGlow.position.set(0,.27,-.3);jar.add(baseGlow);baseGlow.scale.set(1.75,.8,1);
  const contents=new THREE.Group();jar.add(contents);
  let jarScale=58,jarX=0,jarBottom=0,jarMouth=new THREE.Vector3(),jarScreen={x:0,y:0,radius:60,bottom:0};
  function setLayout(){
    mobile=width<=700;jarScale=mobile?(playing?49:39):Math.min(76,height*.09);jarX=width*(mobile?(playing?.51:.77):.76);jarBottom=mobile?(playing?height*.86:Math.min(height*.66,document.getElementById('entry').offsetTop-62)):height*.85;
    jar.position.set(jarX-width/2,height/2-jarBottom,70);jar.scale.setScalar(jarScale);jar.rotation.x=.12;
    jar.updateMatrixWorld(true);jarMouth.copy(jar.localToWorld(new THREE.Vector3(0,1.96,0)));
    const mouthProjection=jarMouth.clone().project(camera);
    jarScreen={x:(mouthProjection.x+1)*width/2,y:(1-mouthProjection.y)*height/2,radius:mobile?64:90,bottom:jarBottom,openingRadius:jarScale*.345};
    jarLabel.style.setProperty('--jar-x',`${jarX}px`);jarLabel.style.setProperty('--jar-label-y',`${jarBottom+7}px`);
    moon.size=mobile?44:Math.min(84,height*.09);
    if(!moon.moved&&moon.status==='free'){
      const worldTop=world.getBoundingClientRect().top;
      const toolbarBottom=document.querySelector('.topbar').getBoundingClientRect().bottom-worldTop;
      const hudBottom=playing?document.getElementById('play-hud').getBoundingClientRect().bottom-worldTop:toolbarBottom;
      moon.ny=Math.max(height*.25,Math.max(toolbarBottom,hudBottom)+moon.size+22)/height;
    }
    const placed=[];
    items.forEach((item,i)=>{
      let candidate=null,best=-1;
      for(let attempt=0;attempt<35;attempt++){
        const nx=.08+random()*.84,ny=.23+random()*.4;
        const distance=placed.length?Math.min(...placed.map(p=>Math.hypot((nx-p.nx)*width,(ny-p.ny)*height))):1e6;
        if(distance>best){best=distance;candidate={nx,ny};}
      }
      item.nx=candidate.nx;item.ny=candidate.ny;placed.push(candidate);
      item.size=mobile?6+random()*5:9+random()*6;item.root.visible=(!mobile||i<20)&&item.status==='free';
    });
  }
  function resize(w,h){width=w;height=h;renderer.setSize(w,h,false);camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();pointMaterial.uniforms.uResolution.value.set(w,h);setLayout();if(holds.size)cancelHold();}
  function normalizedPosition(item){item.root.position.set((item.nx-.5)*width+parallaxX*item.depth*.024,(.5-item.ny)*height+parallaxY*item.depth*.024,item.depth);}
  function screenToWorld(x,y,z=130){ndc.set(x/width*2-1,1-y/height*2);raycaster.setFromCamera(ndc,camera);return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),new THREE.Vector3());}
  function pick(x,y,id=0){
    if(!playing||holds.has(id))return null;ndc.set(x/width*2-1,1-y/height*2);raycaster.setFromCamera(ndc,camera);scene.updateMatrixWorld(true);
    const targets=[...items,moon].filter(item=>['free','held'].includes(item.status)&&item.root.visible).map(item=>item.hit);
    return raycaster.intersectObjects(targets,false)[0]?.object.userData.item??null;
  }
  function setHover(item,id=0){if(item)hovers.set(id,item);else hovers.delete(id);}
  function setHand(x,y){handX=(x/width-.5)*2;handY=(.5-y/height)*2;}
  function burst(position,n=18,color=0xffe5ac){for(let i=0;i<n;i++){const p=sprite(.8,color);p.position.copy(position);p.scale.setScalar(6+random()*9);scene.add(p);sparks.push({sprite:p,velocity:new THREE.Vector3((random()-.5)*100,(random()-.2)*100,(random()-.5)*50),life:.6+random()*.8,total:1.3});}while(sparks.length>180){const p=sparks.shift();scene.remove(p.sprite);p.sprite.material.dispose();}}
  function itemPoint(item){return {x:item.root.position.x+width/2,y:height/2-item.root.position.y};}
  function rebaseGrips(item){const p=itemPoint(item);for(const grip of item.grips.values()){grip.offsetX=p.x-grip.x;grip.offsetY=p.y-grip.y;}}
  function grab(item,x,y,id=0){
    if(!item||!['free','held'].includes(item.status)||holds.has(id))return false;
    if(item.status==='free'){
      item.moved=true;item.status='held';item.detached=false;item.pull=0;item.anchor=item.root.position.clone();item.grips=new Map();item.lastJarContact=-Infinity;item.jarNear=false;
      if(!item.tether){const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);item.tether=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffe0a1,transparent:true,opacity:.5,depthWrite:false}));scene.add(item.tether);}
    }
    const dx=(item.root.position.x-item.anchor.x)/.52,dy=-(item.root.position.y-item.anchor.y)/.52;
    item.grips.set(id,{x,y,originX:x-dx,originY:y-dy,offsetX:0,offsetY:0});holds.set(id,item);
    if(item.grips.size>1)rebaseGrips(item);
    item.root.visible=true;item.hit.visible=true;return true;
  }
  function nearJar(x,y,padding=0){return Math.abs(x-jarScreen.x)<jarScreen.radius+padding&&y>jarScreen.y-62-padding&&y<jarScreen.bottom+18+padding;}
  function drag(x,y,id=0){const item=holds.get(id);if(!item)return false;Object.assign(item.grips.get(id),{x,y});return item.jarNear;}
  function updateHolds(){
    skyTarget.set(0,0);jarHover=false;
    for(const item of new Set(holds.values())){
      const grips=[...item.grips.values()],n=grips.length;
      const x=grips.reduce((s,g)=>s+g.x+g.offsetX,0)/n,y=grips.reduce((s,g)=>s+g.y+g.offsetY,0)/n;
      if(!item.detached){
        const dx=grips.reduce((s,g)=>s+g.x-g.originX,0)/n,dy=grips.reduce((s,g)=>s+g.y-g.originY,0)/n;
        const threshold=(mobile?48:68)*(item.kind==='moon'?1.25:1),distance=Math.hypot(dx,dy);
        item.pull=Math.min(1,distance/threshold);item.root.position.copy(item.anchor).add(new THREE.Vector3(dx*.52,-dy*.52,0));
        const geometry=item.tether.geometry,positions=geometry.attributes.position;
        positions.setXYZ(0,item.anchor.x,item.anchor.y,item.anchor.z);positions.setXYZ(1,item.root.position.x,item.root.position.y,item.root.position.z);positions.needsUpdate=true;geometry.computeBoundingSphere();
        item.tether.visible=!reducedMotion;item.tether.material.opacity=.15+item.pull*.55;
        if(distance<threshold){skyTarget.add(new THREE.Vector2(dx*.16,-dy*.16));continue;}
        item.detached=true;detachCount++;item.tether.visible=false;
        if(!reducedMotion){skyVelocity.add(new THREE.Vector2(-dx/distance*36,dy/distance*36));burst(item.anchor,item.kind==='moon'?20:12);}
        world.dispatchEvent(new CustomEvent('celestialpluck',{detail:{kind:item.kind}}));
      }
      item.nx=x/width;item.ny=y/height;
      const inReach=nearJar(x,y);if(inReach)item.lastJarContact=performance.now();
      item.jarNear=inReach||(item.jarNear&&nearJar(x,y,25));jarHover||=item.jarNear;
      const destination=item.jarNear?jarMouth.clone().add(new THREE.Vector3(0,22,20)):screenToWorld(x,y,150);
      item.root.position.lerp(destination,item.jarNear?.25:.4);
    }
    skyTarget.clampLength(0,14);
  }
  function release(x,y,id=0){
    const item=holds.get(id);if(!item)return null;
    holds.delete(id);item.grips.delete(id);
    if(item.grips.size){rebaseGrips(item);return {stored:false,shared:true,kind:item.kind};}
    item.tether.visible=false;
    if(!item.detached){item.status='free';item.jarNear=false;return {stored:false,attached:true,kind:item.kind};}
    const accept=nearJar(x,y)||performance.now()-item.lastJarContact<650;item.jarNear=false;
    if(accept){
      item.status='flying';const localDestination=item.kind==='moon'?new THREE.Vector3(.16,.71,.1):new THREE.Vector3((random()-.5)*.75,.22+random()*.87,(random()-.5)*.5);
      flights.push({item,start:item.root.position.clone(),startScale:item.mesh.scale.x,startTime:time,localDestination});burst(jarMouth,12);return {stored:true,kind:item.kind};
    }
    item.status='free';item.nx=Math.max(.07,Math.min(.93,x/width));item.ny=Math.max(.16,Math.min(.72,y/height));burst(item.root.position,item.kind==='moon'?15:9);return {stored:false,kind:item.kind};
  }
  function cancelHold(id){
    for(const key of id===undefined?[...holds.keys()]:[id]){
      const item=holds.get(key);hovers.delete(key);if(!item)continue;holds.delete(key);item.grips.delete(key);
      if(item.grips.size){rebaseGrips(item);continue;}
      item.tether.visible=false;item.jarNear=false;item.status='free';item.nx=Math.max(.08,Math.min(.92,item.nx));item.ny=Math.max(.17,Math.min(.68,item.ny));
    }
    if(id===undefined)hovers.clear();if(!holds.size){skyTarget.set(0,0);jarHover=false;}
  }
  function addToJar(item,localDestination){
    stored++;if(item.kind==='moon')storedMoons++;else storedStars++;
    if(item.kind==='moon'||contents.children.length<36){
      const miniature=item.kind==='moon'?moonMesh.clone(true):new THREE.Mesh(starGeometry,starMaterial);
      miniature.scale.setScalar(item.kind==='moon'?.19:.095);miniature.position.copy(localDestination);miniature.rotation.set(0,0,0);miniature.userData={phase:random()*6.28,kind:item.kind};contents.add(miniature);
      const g=item.kind==='moon'?moonGlow.clone():sprite(.8);g.scale.setScalar(item.kind==='moon'?4:5);miniature.add(g);
    }
    baseGlow.material.opacity=Math.min(.7,.1+stored*.045);onStored?.({total:stored,stars:storedStars,moons:storedMoons,kind:item.kind});
    item.status=item.kind==='moon'?'stored':'cooldown';item.coolUntil=time+1.8;item.root.visible=false;
  }
  function setPlaying(value){playing=value;jar.visible=true;setLayout();if(!value)cancelHold();}
  let lastTime=0;
  function render(milliseconds,energy=0){
    time=milliseconds*.001;const dt=Math.min(.05,lastTime?time-lastTime:.016);lastTime=time;const motionTime=reducedMotion?0:time;
    updateHolds();
    if(reducedMotion){skyOffset.set(0,0);skyVelocity.set(0,0);}else{
      skyVelocity.x+=((skyTarget.x-skyOffset.x)*75-skyVelocity.x*9)*dt;
      skyVelocity.y+=((skyTarget.y-skyOffset.y)*75-skyVelocity.y*9)*dt;
      skyOffset.addScaledVector(skyVelocity,dt);
    }
    pointMaterial.uniforms.uPull.value.copy(skyOffset);
    galaxyPicture.style.transform=`translate3d(${skyOffset.x.toFixed(3)}px,${(-skyOffset.y).toFixed(3)}px,0)`;
    galaxyLayer.dataset.displacement=skyOffset.length().toFixed(3);
    parallaxX+=(handX-parallaxX)*.025;parallaxY+=(handY-parallaxY)*.025;
    pointMaterial.uniforms.uTime.value=motionTime;pointMaterial.uniforms.uEnergy.value=energy;pointMaterial.uniforms.uParallax.value.set(parallaxX,parallaxY);
    for(const item of [...items,moon]){
      if(item.status==='cooldown'&&time>=item.coolUntil){item.status='free';item.nx=.1+random()*.8;item.ny=.23+random()*.42;}
      const behindHeadline=!playing&&item.kind==='star'&&(mobile?(item.nx<.85&&item.ny>.27&&item.ny<.48):(item.nx>.13&&item.nx<.52&&item.ny>.26&&item.ny<.57));
      const available=!['cooldown','stored'].includes(item.status)&&!behindHeadline&&(!mobile||item.kind==='moon'||item.id<20);item.root.visible=available;item.hit.visible=playing&&available&&['free','held'].includes(item.status);
      if(!available)continue;
      if(item.status==='free'){normalizedPosition(item);item.root.position.x+=Math.sin(motionTime*.21+item.phase)*4;item.root.position.y+=Math.sin(motionTime*.36+item.phase)*5;item.root.position.x+=skyOffset.x;item.root.position.y+=skyOffset.y;}
      const isMoon=item.kind==='moon';
      let scale=item.size*(item.status==='held'?(item.detached?1.24:1+item.pull*.18):[...hovers.values()].includes(item)?1.13:1);
      if(item.status==='held'&&item.jarNear)scale=Math.min(scale,jarScale*.29);
      if(item.status!=='flying')item.mesh.scale.lerp(new THREE.Vector3(scale,scale,scale),.2);
      if(isMoon){item.mesh.rotation.y=Math.sin(motionTime*.13)*.16+parallaxX*.06;item.mesh.rotation.z=Math.sin(motionTime*.09)*.018;item.glow.scale.setScalar(scale*(4.2+Math.sin(motionTime*.65)*.035));item.glow.material.opacity=.65+energy*.015;}
      else{item.mesh.rotation.set(.12+Math.sin(motionTime*.55+item.phase)*.15,Math.sin(motionTime*.44+item.phase)*.38,Math.sin(motionTime*.2+item.phase)*.12);item.glow.scale.setScalar(scale*(7.5+Math.sin(motionTime*1.3+item.phase)*.7));item.glow.material.opacity=(playing?.76:.56)+Math.sin(motionTime*1.6+item.phase)*.12+energy*.1;}
      item.hit.position.copy(item.root.position);item.hit.scale.setScalar(isMoon?item.size+13:mobile?29:35);
    }
    for(let i=flights.length-1;i>=0;i--){
      const f=flights[i],t=Math.min(1,(time-f.startTime)/1.15),mouthScale=Math.min(f.startScale,jarScale*.25),finalScale=jarScale*(f.item.kind==='moon'?.19:.095);
      const destination=jar.localToWorld(f.localDestination.clone());
      let scale;
      if(t<.42){const p=t/.42,ease=p*p*(3-2*p);f.item.root.position.copy(f.start).lerp(jarMouth,ease);scale=THREE.MathUtils.lerp(f.startScale,mouthScale,ease);}
      else{const p=(t-.42)/.58,ease=1-Math.pow(1-p,2);f.item.root.position.copy(jarMouth).lerp(destination,ease);scale=THREE.MathUtils.lerp(mouthScale,finalScale,ease);}
      f.item.mesh.scale.setScalar(scale);f.item.glow.scale.setScalar(scale*(f.item.kind==='moon'?4.2:5));
      if(t>=1){addToJar(f.item,f.localDestination);flights.splice(i,1);}
    }
    for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.life-=dt;if(p.life<=0){scene.remove(p.sprite);p.sprite.material.dispose();sparks.splice(i,1);continue;}p.sprite.position.addScaledVector(p.velocity,dt);p.velocity.y-=dt*12;p.sprite.material.opacity=Math.min(1,p.life/p.total)*.8;}
    rimHalo.material.opacity=jarHover?.9:.2+Math.sin(motionTime*1.5)*.08;rimHalo.scale.setScalar(jarHover?1.09:1);
    baseGlow.material.opacity=Math.min(.32,.09+stored*.025)+(jarHover?.06:0);contents.children.forEach((c,i)=>{if(c.userData.kind==='moon'){c.rotation.y=Math.sin(motionTime*.25)*.12;}else{c.rotation.z=motionTime*.16+i;c.rotation.y=motionTime*.3+i;}});
    jarLabel.classList.toggle('is-ready',jarHover);
    renderer.render(scene,camera);
    const held=holds.values().next().value;renderer.domElement.dataset.heldCount=String(holds.size);
    renderer.domElement.dataset.detached=String(!!held?.detached);renderer.domElement.dataset.detachCount=String(detachCount);renderer.domElement.dataset.pull=String(held?.pull||0);renderer.domElement.dataset.skyBounce=String(skyOffset.length());renderer.domElement.dataset.held=held?.kind||'';renderer.domElement.dataset.jarCount=String(stored);renderer.domElement.dataset.jarStars=String(storedStars);renderer.domElement.dataset.jarMoons=String(storedMoons);renderer.domElement.dataset.jarReady=String(jarHover);renderer.domElement.dataset.frame=String(Math.floor(milliseconds));
  }
  function capture(){return renderer.domElement;}
  function getLayout(){return {holds:[...holds].map(([id,item])=>({hand:id,item:item.id,kind:item.kind,detached:item.detached,owners:item.grips.size,...itemPoint(item)})),jar:{...jarScreen,openingNormalZ:new THREE.Vector3(0,1,0).transformDirection(jar.matrixWorld).z},stars:items.filter(x=>x.status==='free'&&x.root.visible).map(item=>({id:item.id,x:item.root.position.x+width/2,y:height/2-item.root.position.y})),moon:{x:moon.root.position.x+width/2,y:height/2-moon.root.position.y,status:moon.status,radius:moon.mesh.scale.x},flights:flights.map(f=>({kind:f.item.kind,radius:f.item.mesh.scale.x,y:height/2-f.item.root.position.y})),contents:contents.children.map(c=>({kind:c.userData.kind,radius:c.scale.x*jarScale,y:height/2-jar.localToWorld(c.position.clone()).y}))};}
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelHold();world.dispatchEvent(new CustomEvent('sceneerror',{detail:'星空画面暂时中断，请刷新页面重新进入。'}));});
  resize(world.clientWidth,world.clientHeight);
  return {resize,render,pick,setHover,setHand,grab,drag,release,cancelHold,setPlaying,capture,getLayout,heldFor:id=>holds.get(id),get held(){return holds.values().next().value;},get count(){return stored;},get inventory(){return {stars:storedStars,moons:storedMoons,total:stored};}};
}
