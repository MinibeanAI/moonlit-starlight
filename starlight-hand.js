export function createStarlightHand(host,{reducedMotion=false}={}){
  // Both silhouettes share anatomical control points, so fingers bend instead
  // of swapping two icons. Thumb/index contact stays at the picking origin.
  const open=[[14,127],[27,97],[29,79],[18,61],[14,47],[18,42],[24,45],[38,63],[32,36],[33,24],[38,21],[44,26],[50,54],[50,18],[53,10],[59,10],[64,17],[63,49],[72,15],[78,9],[83,12],[85,19],[78,56],[92,70],[107,67],[116,70],[116,77],[109,83],[91,94],[77,105],[60,111],[44,135]];
  const closed=[[14,127],[27,97],[29,79],[34,61],[42,53],[49,53],[54,58],[53,72],[48,49],[50,39],[58,35],[65,39],[68,62],[62,36],[65,29],[72,27],[80,31],[82,49],[84,31],[91,29],[103,34],[105,40],[99,45],[82,43],[85,59],[100,47],[106,47],[107,54],[91,73],[77,95],[60,111],[44,135]];
  host.insertAdjacentHTML('afterbegin',`<svg class="starlight-hand" viewBox="0 0 130 145" aria-hidden="true"><defs><linearGradient id="${host.id}-hand-fill" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#788bad" stop-opacity="0"/><stop offset=".55" stop-color="#f6d69b" stop-opacity=".1"/><stop offset="1" stop-color="#ffdda2" stop-opacity=".32"/></linearGradient><linearGradient id="${host.id}-hand-edge" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#a2b7d8" stop-opacity=".2"/><stop offset=".5" stop-color="#ecd4ad" stop-opacity=".7"/><stop offset="1" stop-color="#fff0ca"/></linearGradient><clipPath id="${host.id}-hand-clip"><path class="hand-contour"/></clipPath></defs><path class="hand-contour hand-aura"/><path class="hand-contour hand-skin" style="fill:url(#${host.id}-hand-fill);stroke:url(#${host.id}-hand-edge)"/><g clip-path="url(#${host.id}-hand-clip)" fill="#fff3cf"><circle cx="40" cy="94" r=".9"/><circle cx="57" cy="84" r=".6"/><circle cx="37" cy="111" r=".8"/><circle cx="72" cy="74" r=".7"/><circle cx="65" cy="98" r=".55"/><circle cx="83" cy="63" r=".9"/><path d="M49 74v5m-2.5-2.5h5" stroke="#ffe8b4" stroke-width=".65"/></g><path class="palm-line" d="M43 92 Q47 79 61 77 M58 101 Q72 88 79 70"/></svg>`);
  let stableSide=null,pendingSide=null,sideFrames=0;
  function handedness(category){
    if(!category||category.score<.7)return;
    // Keep the detector label; mirroring the preview must not also swap it.
    const side=['Left','Right'].includes(category.categoryName)?category.categoryName:null;
    if(!side)return;
    if(side!==pendingSide){pendingSide=side;sideFrames=1;}else sideFrames++;
    if(stableSide===null||sideFrames>=3){stableSide=side;host.dataset.handedness=side;host.classList.toggle('mirrored',side==='Right');}
  }
  const contours=host.querySelectorAll('.hand-contour');let blend=0,target=0;
  function pose(pinched){target=pinched?1:0;host.dataset.pose=pinched?'pinched':'open';}
  function render(){
    blend=reducedMotion?target:blend+(target-blend)*.27;
    const points=open.map((p,i)=>p.map((v,j)=>v+(closed[i][j]-v)*blend));
    const mid=(a,b)=>`${((a[0]+b[0])/2).toFixed(2)} ${((a[1]+b[1])/2).toFixed(2)}`;
    let d=`M ${mid(points.at(-1),points[0])}`;
    points.forEach((p,i)=>d+=` Q ${p[0].toFixed(2)} ${p[1].toFixed(2)} ${mid(p,points[(i+1)%points.length])}`);d+=' Z';
    contours.forEach(path=>path.setAttribute('d',d));
  }
  pose(false);render();return {pose,render,handedness};
}
