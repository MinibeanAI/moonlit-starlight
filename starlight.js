import {createStarlightHand} from './starlight-hand.js?v=20';
import {createBunnyInteraction} from './bunny-interaction.js?v=20';
import {createStarlightScene} from './starlight-scene.js?v=23';
import {createHandController} from './hand-controller.js?v=20';

const $=id=>document.getElementById(id),world=$('world');
const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
let state='home',loading=false,scene=null,toastTimer=0,energy=0;
const secondCursor=document.createElement('div');secondCursor.id='hand-cursor-2';secondCursor.className='hand-cursor';secondCursor.hidden=true;secondCursor.innerHTML='<span></span>';world.append(secondCursor);
const hands=[$('hand-cursor'),secondCursor].map((cursor,id)=>({id,cursor,label:cursor.querySelector('span'),visual:createStarlightHand(cursor,{reducedMotion}),wasPinched:false,lastSeen:0,point:null,wrist:null,side:null}));
const bunny=createBunnyInteraction({world,background:$('background').querySelector('img'),response:$('bunny-response'),reducedMotion});
let audioContext=null,analyser=null,bins=null,source=null,audioURL=null,effects=true;
const defaultMusic='assets/starfall.m4a';
const audio=new Audio();audio.preload='none';audio.src=defaultMusic;audio.loop=true;audio.volume=.55;
let musicMuted=false,musicName='星球坠落',musicRequest=0;

function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
function initAudio(){try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
function chime(frequency=740,gain=.065){if(!effects)return;initAudio();if(!audioContext)return;const t=audioContext.currentTime,osc=audioContext.createOscillator(),volume=audioContext.createGain();osc.frequency.value=frequency;osc.type='sine';volume.gain.setValueAtTime(0,t);volume.gain.linearRampToValueAtTime(gain,t+.018);volume.gain.exponentialRampToValueAtTime(.001,t+1);osc.connect(volume);volume.connect(audioContext.destination);osc.start();osc.stop(t+1.1);}
function stored({total,stars,moons,kind}){$('jar-count').textContent=`${stars} 颗星星 · ${moons} 个月亮`;$('jar-label').dataset.count=String(total);chime(660+(total%5)*80);if(kind==='moon')toast('把月亮也装进愿望里。');else if(total===1)toast('第一颗星光，替你守住一个愿望。');else if(total%5===0)toast('小小的瓶子，正在装满温柔。');}
function setConnecting(value){loading=value;$('entry').classList.toggle('is-loading',value);$('start-button').disabled=value;$('start-button').querySelector('span').textContent=value?'正在连接摄像头…':'开启摄像头';$('cancel-camera').hidden=!value;}

try{scene=createStarlightScene({host:$('scene-host'),world,jarLabel:$('jar-label'),onStored:stored,reducedMotion});$('jar-label').hidden=false;}
catch(error){console.error('Scene initialization failed',error);$('start-button').disabled=true;toast('当前浏览器暂时无法显示三维星空，请用 Chrome 或 Safari 打开。');}
function setState(next){
  state=next;world.dataset.state=next;const active=next==='playing';
  $('welcome').hidden=active;$('entry').hidden=active;$('music-link').hidden=active;
  $('play-hud').hidden=!active;$('gesture-guide').hidden=!active;$('camera-preview').hidden=!active;$('save-button').hidden=!active;
  $('jar-label').hidden=!scene;scene?.setPlaying(active);
  if(!active)cancelGrab();
}
function cancelGrab(){bunny.reset();for(const slot of hands){slot.wasPinched=false;slot.point=null;slot.wrist=null;slot.cursor.hidden=true;}scene?.cancelHold();scene?.setHover(null);}
function cameraMessage(error){
  if(error.message==='INSECURE_CONTEXT')return '摄像头需要安全地址。电脑请打开 localhost，手机请使用 HTTPS 页面。';
  if(error.name==='NotAllowedError')return '摄像头尚未获得权限。请允许当前浏览器使用摄像头后重试；应用内浏览器未弹出提示时，可在 Chrome 或 Safari 中打开。';
  if(error.name==='NotFoundError')return '没有找到摄像头，请连接摄像头后重试。';
  if(error.name==='NotReadableError')return 'Chrome 没有成功启动当前摄像头，暂时不能确定是否被占用。可以在下方改选内置摄像头后重试。';
  if(error.message==='CAMERA_ENDED')return '镜头连接已中断。重新开启摄像头，就可以继续摘星。';
  if(error.message==='VIDEO_TIMEOUT')return '摄像头已连接，但画面没有开始播放。请重新开启摄像头，或检查浏览器的摄像头权限。';
  if(error.message==='MODEL_TIMEOUT')return '手势识别准备超时，请稍后重试。';
  return '手势识别暂时没能准备好，请重试。也可以用 Chrome 或 Safari 打开当前页面。';
}
async function refreshCameras(){
  try{
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'),select=$('camera-device'),previous=select.value;
    select.replaceChildren(new Option('浏览器默认摄像头',''));
    devices.forEach((d,i)=>select.add(new Option(d.label||`摄像头 ${i+1}`,d.deviceId)));
    if([...select.options].some(o=>o.value===previous))select.value=previous;
    $('camera-device-status').textContent=devices.length?`检测到 ${devices.length} 个镜头；若有内置摄像头，可优先选择。`:'浏览器未列出可用镜头，请检查系统摄像头权限。';
  }catch{$('camera-device-status').textContent='暂时无法读取镜头列表。';}
}
function failCamera(error){
  if(error.name==='AbortError'&&!loading)return;
  setConnecting(false);controller.stop();setState('home');$('setup-camera').hidden=true;$('camera-placeholder').hidden=false;
  $('camera-debug').textContent=`${error.name||'Error'}: ${error.message||'未知错误'}`;console.error('Camera startup failed',error.name,error.message);refreshCameras();
  $('setup-status').textContent='镜头尚未准备好';$('camera-error').textContent=cameraMessage(error);$('retry-camera').hidden=false;
  if(!$('camera-dialog').open)$('camera-dialog').showModal();
}
function updateStatus(status){
  if(status==='released'){setConnecting(false);setState('home');toast('摄像头已交给另一个星空页面。');return;}
  if(status==='loading'){$('camera-preview').hidden=false;$('camera-status').textContent='正在准备手势识别…';}
  if(status==='ready')$('camera-status').textContent='请伸出一只手';
}
const controller=createHandController({video:$('camera'),setupVideo:$('setup-camera'),canvas:$('hand-landmarks'),onFrame:processHand,onStatus:updateStatus,onError:failCamera});
async function beginCamera(){
  if(loading||!scene)return;
  if($('camera-dialog').open)$('camera-dialog').close();
  setConnecting(true);initAudio();if(!musicMuted)playMusic();cancelGrab();$('camera-error').textContent='';$('retry-camera').hidden=true;
  try{await controller.start($('camera-device').value);setConnecting(false);setState('playing');$('tracking-status').textContent='摄像头已开启';$('gesture-hint').textContent='捏合摘星 · 带到瓶口 · 张开收藏';}
  catch(error){failCamera(error);}
}

function processHand(landmarks,videoSize,categories){
  if(state!=='playing'||document.querySelector('dialog[open]'))return;
  const now=performance.now(),width=world.clientWidth,height=world.clientHeight,clamp=v=>Math.max(0,Math.min(1,v));
  const detections=landmarks.slice(0,2).map((hand,i)=>({hand,category:categories[i]?.[0]}));
  // Match to persistent slots using wrist proximity plus handedness. Detector
  // array ordering may reverse; it must not transfer either held object.
  function cost(slot,d){if(!slot.wrist||now-slot.lastSeen>1100)return .9;return Math.hypot(slot.wrist.x-d.hand[0].x,slot.wrist.y-d.hand[0].y)+(slot.side&&d.category?.score>.7&&slot.side!==d.category.categoryName? .35:0);}
  let assignments=[];
  if(detections.length===2){const straight=cost(hands[0],detections[0])+cost(hands[1],detections[1]),reverse=cost(hands[1],detections[0])+cost(hands[0],detections[1]);assignments=reverse<straight?[[hands[1],detections[0]],[hands[0],detections[1]]]:[[hands[0],detections[0]],[hands[1],detections[1]]];}
  else if(detections.length)assignments=[[cost(hands[1],detections[0])<cost(hands[0],detections[0])?hands[1]:hands[0],detections[0]]];
  const seen=new Set(assignments.map(([slot])=>slot.id));
  for(const slot of hands){if(!seen.has(slot.id)){if(now-slot.lastSeen>450){slot.cursor.hidden=true;scene.setHover(null,slot.id);}if(now-slot.lastSeen>1100){scene.cancelHold(slot.id);slot.wasPinched=false;slot.point=null;slot.wrist=null;}}}
  let petPoint=null;
  for(const [slot,{hand,category}] of assignments){
    slot.lastSeen=now;slot.wrist={...hand[0]};
    const x=clamp((1-(hand[4].x+hand[8].x)/2-.1)/.8)*width,y=clamp(((hand[4].y+hand[8].y)/2-.08)/.84)*height;
    if(!slot.point)slot.point={x,y};else{slot.point.x+=(x-slot.point.x)*.48;slot.point.y+=(y-slot.point.y)*.48;}
    const distance=(a,b)=>Math.hypot((a.x-b.x)*videoSize.width,(a.y-b.y)*videoSize.height);
    const ratio=distance(hand[4],hand[8])/Math.max(1,distance(hand[0],hand[9]));
    const pinched=ratio<(slot.wasPinched?.48:.28),px=slot.point.x,py=slot.point.y;
    const candidate=scene.pick(px,py,slot.id);scene.setHover(candidate,slot.id);
    const cursor=slot.cursor;cursor.hidden=false;cursor.style.left=px+'px';cursor.style.top=py+'px';cursor.classList.toggle('pinched',pinched);slot.visual.handedness(category);slot.side=cursor.dataset.handedness||slot.side;slot.visual.pose(pinched);
    cursor.style.setProperty('--label-x',`${Math.max(55,Math.min(width-65,px-26))-px}px`);cursor.classList.toggle('targeted',!!candidate&&!pinched);
    if(pinched&&!slot.wasPinched&&candidate){scene.grab(candidate,px,py,slot.id);chime(candidate.kind==='moon'?392:784,.035);}
    let held=scene.heldFor(slot.id);
    if(pinched&&held){scene.drag(px,py,slot.id);slot.label.textContent=held.grips.size>1?'一起轻轻拉':!held.detached?'轻轻拉一拉':held.jarNear?'张开手，放进瓶里':'带到许愿瓶';}
    else if(!pinched&&slot.wasPinched&&held){scene.release(px,py,slot.id);slot.label.textContent='';}
    else slot.label.textContent=candidate?(candidate.status==='held'?'捏合，一起抓住':candidate.kind==='moon'?'捏合，抓住月亮':'捏合，摘下星星'):'';
    held=scene.heldFor(slot.id);
    const extended=[12,16,20].filter(i=>distance(hand[i],hand[0])>distance(hand[i-2],hand[0])*1.1).length>=2;
    if(!pinched&&extended&&!held){const b=bunny.getLayout(),d=Math.hypot((px-b.x)/b.rx,(py-b.y)/b.ry);if(!petPoint||d<petPoint.d)petPoint={x:px,y:py,d,slot};}
    slot.wasPinched=pinched;
  }
  if(assignments.length){scene.setHand(assignments.reduce((sum,[s])=>sum+s.point.x,0)/assignments.length,assignments.reduce((sum,[s])=>sum+s.point.y,0)/assignments.length);}
  const petting=petPoint?bunny.hand(petPoint.x,petPoint.y,true):bunny.hand(0,0,false);
  if(petting)petPoint.slot.label.textContent='轻轻摸摸';
  const heldItems=hands.map(s=>scene.heldFor(s.id)).filter(Boolean),shared=heldItems.some(item=>item.grips.size>1);
  $('tracking-status').textContent=assignments.length===2?'双手已看见':assignments.length?'摄像头已开启':'请把手放进镜头';
  $('camera-status').textContent=heldItems.some(item=>item.detached)?'已摘到':heldItems.length?'轻拉摘下':assignments.length===2?'已看见双手':assignments.length?'已看见你的手':'请伸出手';
  $('gesture-hint').textContent=shared?'双手一起带走星光 · 都张开后放下':heldItems.some(i=>i.jarNear)?'瓶口亮了，张开手就能收藏':heldItems.some(i=>!i.detached)?'保持捏合 · 轻轻拉远一点':petting?'小兔子喜欢你的温柔 ♡':'双手都能摘星 · 带到瓶口 · 张开收藏';
}
world.addEventListener('celestialpluck',event=>{$('camera-status').textContent='已摘到';chime(event.detail.kind==='moon'?392:880,.055);});
$('start-button').addEventListener('click',beginCamera);$('retry-camera').addEventListener('click',beginCamera);
$('stop-button').addEventListener('click',()=>{controller.stop();audio.pause();setState('home');});
$('cancel-camera').addEventListener('click',()=>{controller.stop();setConnecting(false);setState('home');});
function openDialog(id){cancelGrab();$(id).showModal();}
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
$('music-button').addEventListener('click',()=>openDialog('music-dialog'));
$('music-link').addEventListener('click',()=>openDialog('music-dialog'));
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));
$('effects-toggle').addEventListener('change',event=>effects=event.target.checked);
function updateMusic(){document.querySelector('.record').classList.toggle('playing',!audio.paused);$('music-play').textContent=audio.paused?'播放音乐':'暂停音乐';}
function setupMusic(){
  initAudio();
  if(audioContext&&!source){source=audioContext.createMediaElementSource(audio);analyser=audioContext.createAnalyser();analyser.fftSize=128;bins=new Uint8Array(analyser.frequencyBinCount);source.connect(analyser);analyser.connect(audioContext.destination);}
}
async function playMusic(){
  const request=++musicRequest;
  try{setupMusic();await audio.play();if(request===musicRequest)$('music-status').textContent=`正在播放：${musicName}`;}
  catch(error){if(request!==musicRequest||error.name==='AbortError')return;$('music-status').textContent='音乐暂时无法播放，可点击播放重试或更换音频。';}
}
function selectMusic(file){
  ++musicRequest;audio.pause();if(audioURL)URL.revokeObjectURL(audioURL);
  audioURL=file?URL.createObjectURL(file):null;audio.src=audioURL||defaultMusic;
  musicName=file?file.name:'星球坠落';musicMuted=false;
  $('track-title').textContent=musicName;$('track-artist').textContent=file?'你的专属星空配乐':'艾热 AIR · 李佳隆 JelloRio';
  $('track-label').textContent=file?'本地音频 · 仅在本机播放':'默认配乐';$('music-reset').hidden=!file;
  $('music-link').textContent=`♫ 今夜想听 · ${musicName}`;
  playMusic();
}
audio.addEventListener('play',updateMusic);audio.addEventListener('pause',updateMusic);
$('music-file').addEventListener('change',event=>{const file=event.target.files[0];if(file)selectMusic(file);event.target.value='';});
$('music-reset').addEventListener('click',()=>selectMusic(null));
$('music-play').addEventListener('click',()=>{if(audio.paused){musicMuted=false;playMusic();}else{musicMuted=true;++musicRequest;audio.pause();$('music-status').textContent=`已暂停：${musicName}`;}});
let lastRender=0;
function animate(now){
  requestAnimationFrame(animate);if(document.hidden||!scene||now-lastRender<24)return;lastRender=now;
  if(analyser&&!audio.paused){analyser.getByteFrequencyData(bins);let sum=0;for(let i=1;i<22;i++)sum+=bins[i];energy+=(sum/21/255-energy)*.13;}else energy*=.95;
  scene.render(now,energy);bunny.render(now);hands.forEach(slot=>slot.visual.render());
}
requestAnimationFrame(animate);
window.addEventListener('resize',()=>{cancelGrab();scene?.resize(world.clientWidth,world.clientHeight);bunny.resize();});
world.addEventListener('sceneerror',event=>{controller.stop();setState('home');$('start-button').disabled=true;toast(event.detail);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelGrab();audio.pause();if(state==='playing'||loading){controller.stop();setConnecting(false);setState('home');}}});
window.addEventListener('pagehide',()=>{controller.stop();audio.pause();});

let cardURL=null;
$('save-button').addEventListener('click',async()=>{
  cancelGrab();const button=$('save-button');button.disabled=true;
  try{
    const background=$('background').querySelector('img');await background.decode();
    const width=world.clientWidth,height=world.clientHeight,canvas=document.createElement('canvas');canvas.width=1080;canvas.height=Math.round(1080*height/width);const ctx=canvas.getContext('2d');
    const scale=Math.max(canvas.width/background.naturalWidth,canvas.height/background.naturalHeight);ctx.drawImage(background,(canvas.width-background.naturalWidth*scale)/2,(canvas.height-background.naturalHeight*scale)/2,background.naturalWidth*scale,background.naturalHeight*scale);
    scene.render(performance.now(),energy);ctx.drawImage(scene.capture(),0,0,canvas.width,canvas.height);
    const shade=ctx.createLinearGradient(0,canvas.height*.7,0,canvas.height);shade.addColorStop(0,'#0b132600');shade.addColorStop(1,'#0b1326dc');ctx.fillStyle=shade;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.textAlign='center';ctx.fillStyle='#fff0ce';ctx.shadowColor='#0b1128';ctx.shadowBlur=14;ctx.font='46px "Songti SC",serif';ctx.fillText('把愿望，交给星光。',540,canvas.height-180);ctx.font='27px "Songti SC",serif';ctx.fillText(`许愿瓶里，${scene.inventory.stars} 颗星星 · ${scene.inventory.moons} 个月亮`,540,canvas.height-120);ctx.fillStyle='#c9c9d0';ctx.font='18px sans-serif';ctx.fillText('愿你所念，皆有所应',540,canvas.height-65);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('export');if(cardURL)URL.revokeObjectURL(cardURL);cardURL=URL.createObjectURL(blob);$('saved-image').src=cardURL;$('download-link').href=cardURL;openDialog('save-dialog');
  }catch{toast('图片暂时没能保存，请稍后再试。');}finally{button.disabled=false;}
});

// Read-only scene coordinates let browser checks exercise the same hand-input
// and raycasting path without recording or depending on a real person's hand.
export function getSceneLayout(){return {...scene?.getLayout(),bunny:bunny.getLayout(),hands:hands.map(s=>({id:s.id,side:s.side,visible:!s.cursor.hidden}))};}
