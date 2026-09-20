export function createHandController({video,setupVideo,canvas,onFrame,onStatus,onError}) {
  let worker=null,stream=null,token=0,timer=0,loadingReject=null,loadTimer=0,starting=false;
  const links=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
  const cameraChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('starlight-camera-owner'):null;
  cameraChannel?.addEventListener('message',({data})=>{if(data==='request-camera'&&(stream||starting)){stop();onStatus('released');}});
  function clearDrawing(){canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
  function syncAspect(){
    const sourceWidth=video.videoWidth||640,sourceHeight=video.videoHeight||480;
    video.parentElement.style.setProperty('--camera-aspect',`${sourceWidth} / ${sourceHeight}`);
    const targetWidth=320,targetHeight=Math.round(targetWidth*sourceHeight/sourceWidth);
    if(canvas.width!==targetWidth||canvas.height!==targetHeight){canvas.width=targetWidth;canvas.height=targetHeight;}
  }
  video.addEventListener('loadedmetadata',syncAspect);video.addEventListener('resize',syncAspect);
  function draw(hands){
    syncAspect();const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    for(const hand of hands){if(!hand)continue;const point=p=>[(1-p.x)*canvas.width,p.y*canvas.height];
    ctx.lineWidth=1.5;ctx.strokeStyle='rgba(165,224,228,.85)';
    for(const [a,b] of links){ctx.beginPath();ctx.moveTo(...point(hand[a]));ctx.lineTo(...point(hand[b]));ctx.stroke();}
    for(const [index,p] of hand.entries()){ctx.beginPath();ctx.arc(...point(p),index===4||index===8?3:2,0,Math.PI*2);ctx.fillStyle=index===4||index===8?'#ffe4a0':'#cff2e8';ctx.fill();}
  }
  }
  function stop(){starting=false;token++;clearTimeout(timer);clearTimeout(loadTimer);if(loadingReject){loadingReject(new DOMException('Camera cancelled','AbortError'));loadingReject=null;}worker?.terminate();worker=null;stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;setupVideo.srcObject=null;clearDrawing();}
  async function frame(currentToken){
    if(currentToken!==token||!worker)return;
    if(document.hidden){timer=setTimeout(()=>frame(currentToken),250);return;}
    if(video.readyState<2||!video.videoWidth||!video.videoHeight){timer=setTimeout(()=>frame(currentToken),100);return;}
    try{const bitmap=await createImageBitmap(video);if(currentToken!==token||!worker){bitmap.close();return;}worker.postMessage({type:'frame',bitmap,timestamp:performance.now()},[bitmap]);}catch(error){if(currentToken===token){stop();onError(error);}}
  }
  async function start(deviceId=""){
    stop();starting=true;const currentToken=token;cameraChannel?.postMessage('request-camera');
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('INSECURE_CONTEXT');
    onStatus('permission');
    let nextStream;
    try{nextStream=await navigator.mediaDevices.getUserMedia({video:{...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:'user'}),width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});}
    catch(error){
      if(!['NotReadableError','OverconstrainedError'].includes(error.name))throw error;
      // Allow another tab to finish releasing its track, then use minimal constraints.
      await new Promise(resolve=>setTimeout(resolve,350));
      if(currentToken!==token)throw new DOMException('Camera cancelled','AbortError');
      nextStream=await navigator.mediaDevices.getUserMedia({video:deviceId?{deviceId:{exact:deviceId}}:true,audio:false});
    }
    if(currentToken!==token){nextStream.getTracks().forEach(track=>track.stop());throw new DOMException('Camera cancelled','AbortError');}
    stream=nextStream;video.srcObject=stream;
    // Only play the visible inline preview. Awaiting a second video inside a
    // closed dialog can stall playback in browsers that suspend hidden media.
    onStatus('loading');video.muted=true;video.playsInline=true;
    let playbackTimer;
    try{await Promise.race([video.play(),new Promise((_,reject)=>{playbackTimer=setTimeout(()=>reject(new Error('VIDEO_TIMEOUT')),12000);})]);}finally{clearTimeout(playbackTimer);}
    syncAspect();
    if(currentToken!==token)throw new DOMException('Camera cancelled','AbortError');
    onStatus('loading');
    worker=new Worker(new URL('./hand-worker.js?v=18',import.meta.url),{type:'module'});
    await new Promise((resolve,reject)=>{
      loadingReject=reject;loadTimer=setTimeout(()=>reject(new Error('MODEL_TIMEOUT')),25000);
      worker.onerror=event=>reject(new Error(event.message));
      worker.onmessage=({data})=>{if(data.type==='ready')resolve();else if(data.type==='error')reject(new Error(data.message));};
      worker.postMessage({type:'init'});
    }).finally(()=>{clearTimeout(loadTimer);loadingReject=null;});
    if(currentToken!==token)throw new DOMException('Camera cancelled','AbortError');
    worker.onmessage=({data})=>{if(currentToken!==token)return;if(data.type==='result'){draw(data.landmarks);onFrame(data.landmarks,{width:video.videoWidth,height:video.videoHeight},data.handedness||[]);timer=setTimeout(()=>frame(currentToken),60);}else if(data.type==='error'){stop();onError(new Error(data.message));}};
    worker.onerror=event=>{stop();onError(new Error(event.message));};
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(currentToken===token){stop();onError(new Error('CAMERA_ENDED'));}});
    starting=false;onStatus('ready');frame(currentToken);
  }
  return {start,stop};
}
